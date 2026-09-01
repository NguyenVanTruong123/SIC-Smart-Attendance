import { AttendanceStatus, AuditActionType, Prisma, SessionStatus, UserRole } from '@prisma/client';
import prisma from '../config/prisma';
import { aiClientService, type RecognitionFrame } from './ai-client.service';
import { evidenceService } from './evidence.service';
import { emitSessionEvent } from '../realtime/socket';
import { isBrowserCameraUrl } from '../utils/camera-source';

const demoMode = process.env.DEMO_MODE !== 'false';
const lateCutoffMinutes = Number(process.env.LATE_CUTOFF_MINUTES || (demoMode ? 1 : 15));
const earlyEndMinutes = demoMode ? 0 : Number(process.env.EARLY_END_MINUTES || 30);
const unknownEvidenceCooldownMs = 5_000;

export type CaptureMode = 'OBSERVE' | 'CHECKPOINT' | 'FINAL';

export function isCaptureMode(value: unknown): value is CaptureMode {
  return value === 'OBSERVE' || value === 'CHECKPOINT' || value === 'FINAL';
}

function serviceError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

type AuthorizedSession = Awaited<ReturnType<TeacherSessionService['getAuthorizedSession']>>;

export class TeacherSessionService {
  private readonly captureTimers = new Map<string, NodeJS.Timeout>();
  private readonly captureInFlight = new Set<string>();
  private readonly unknownEvidenceAt = new Map<string, number>();
  private readonly checkpointFaces = new Map<string, Map<string, RecognitionFrame['faces'][number]>>();
  private scheduler?: NodeJS.Timeout;

  startScheduler() {
    if (this.scheduler) return;
    this.scheduler = setInterval(() => void this.autoStartDueSessions(), 30_000);
    this.scheduler.unref();
    void this.autoStartDueSessions();
  }

  private async autoStartDueSessions() {
    if (process.env.AUTO_START_SESSIONS === 'false') return;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sessions = await prisma.classSession.findMany({
      where: { sessionDate: today, status: SessionStatus.SCHEDULED },
      select: { id: true, startTime: true, courseClass: { select: { teacherId: true } } },
      take: 20,
    }).catch(() => []);
    for (const session of sessions) {
      const start = new Date(session.startTime);
      if (now.getHours() * 60 + now.getMinutes() < start.getHours() * 60 + start.getMinutes()) continue;
      await this.start(session.id, session.courseClass.teacherId, UserRole.TEACHER).catch(() => undefined);
    }
  }

  private startCaptureLoop(sessionId: string, actorId: string, actorRole: UserRole) {
    if (this.captureTimers.has(sessionId)) return;
    const interval = Math.max(5_000, Number(process.env.AI_CAPTURE_INTERVAL_MS || 15 * 60_000));
    const timer = setInterval(() => {
      if (this.captureInFlight.has(sessionId)) return;
      this.captureInFlight.add(sessionId);
      void this.capture(sessionId, actorId, actorRole, 'CHECKPOINT').catch(() => undefined).finally(() => this.captureInFlight.delete(sessionId));
    }, interval);
    timer.unref();
    this.captureTimers.set(sessionId, timer);
  }

  private stopCaptureLoop(sessionId: string) {
    const timer = this.captureTimers.get(sessionId);
    if (timer) clearInterval(timer);
    this.captureTimers.delete(sessionId);
    this.captureInFlight.delete(sessionId);
  }

  private collectCheckpointFaces(sessionId: string, faces: RecognitionFrame['faces']) {
    const collected = this.checkpointFaces.get(sessionId) || new Map<string, RecognitionFrame['faces'][number]>();
    for (const face of faces) {
      if (face.result !== 'MATCHED' || !face.studentId) continue;
      const previous = collected.get(face.studentId);
      if (!previous || face.score >= previous.score) collected.set(face.studentId, face);
    }
    this.checkpointFaces.set(sessionId, collected);
    return collected;
  }

  private consumeCheckpointFaces(sessionId: string, faces: RecognitionFrame['faces']) {
    const collected = this.collectCheckpointFaces(sessionId, faces);
    const merged = [...collected.values(), ...faces.filter((face) => face.result !== 'MATCHED' || !face.studentId)];
    this.checkpointFaces.delete(sessionId);
    return merged;
  }

  private nextCheckpointMinute(logs: Array<{ checkpoints: unknown }>) {
    let lastMinute = 0;
    for (const log of logs) {
      if (!log.checkpoints || typeof log.checkpoints !== 'object' || Array.isArray(log.checkpoints)) continue;
      for (const [key, value] of Object.entries(log.checkpoints as Record<string, unknown>)) {
        const match = /^(\d+)m$/.exec(key);
        if (match && value) lastMinute = Math.max(lastMinute, Number(match[1]));
      }
    }
    return lastMinute + 15;
  }

  private checkpointValues(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? { ...(value as Record<string, unknown>) }
      : {};
  }
  private async getAuthorizedSession(sessionId: string, actorId: string, actorRole: UserRole) {
    const session = await prisma.classSession.findUnique({
      where: { id: sessionId },
      include: {
        classroom: true,
        courseClass: {
          include: {
            course: true,
            enrollments: { include: { student: true } },
          },
        },
      },
    });
    if (!session) throw serviceError('Không tìm thấy phiên học.', 404);
    if (actorRole !== UserRole.ADMIN && session.courseClass.teacherId !== actorId) {
      throw serviceError('Bạn không có quyền thao tác phiên học này.', 403);
    }
    return session;
  }

  private async resetCompletedDemoSession(sessionId: string) {
    this.stopCaptureLoop(sessionId);
    this.unknownEvidenceAt.delete(sessionId);
    this.checkpointFaces.delete(sessionId);
    await aiClientService.unloadRoster(sessionId).catch(() => undefined);
    await prisma.$transaction(async (tx) => {
      await tx.attendanceLog.updateMany({
        where: { sessionId },
        data: {
          status: AttendanceStatus.UNCONFIRMED,
          lateMinutes: 0,
          firstSeenAt: null,
          bestScore: null,
          bestEvidenceId: null,
          manualOverrideBy: null,
          overrideReason: null,
          overrideAt: null,
        },
      });
      await tx.sessionProofSnapshot.deleteMany({ where: { sessionId } });
      await tx.sessionFaceDetection.deleteMany({ where: { sessionId } });
      await tx.classSession.update({
        where: { id: sessionId },
        data: { status: SessionStatus.SCHEDULED, startedAt: null, endedAt: null, rosterVersion: null, failureReason: null },
      });
    });
  }

  async start(sessionId: string, actorId: string, actorRole: UserRole) {
    let session = await this.getAuthorizedSession(sessionId, actorId, actorRole);
    if (session.status === SessionStatus.CANCELLED || (session.status === SessionStatus.COMPLETED && !demoMode)) {
      throw serviceError('Phiên học đã kết thúc hoặc bị hủy.', 409);
    }
    if (session.status === SessionStatus.COMPLETED) {
      await this.resetCompletedDemoSession(session.id);
      session = await this.getAuthorizedSession(sessionId, actorId, actorRole);
    }

    const roster = session.courseClass.enrollments.map((enrollment) => enrollment.student);
    const enrolled = roster.filter((student) => student.isFaceEnrolled);
    if (!enrolled.length) throw serviceError('Lớp chưa có sinh viên nào hoàn tất đăng ký khuôn mặt.', 422);

    const rosterVersion = `${session.createdAt.toISOString()}:${enrolled.length}`;
    await aiClientService.loadRoster(session.id, rosterVersion, enrolled.map((student) => student.userCode));

    if (session.status === SessionStatus.LIVE_NOW) return this.getDetail(sessionId, actorId, actorRole);

    await prisma.$transaction(async (tx) => {
      await tx.classSession.update({
        where: { id: session.id },
        data: { status: SessionStatus.LIVE_NOW, startedAt: new Date(), rosterVersion, failureReason: null },
      });
      await tx.attendanceLog.createMany({
        data: roster.map((student) => ({ sessionId: session.id, studentId: student.id, status: AttendanceStatus.UNCONFIRMED })),
        skipDuplicates: true,
      });
      await tx.systemAuditLog.create({
        data: {
          actorId,
          actionType: AuditActionType.SESSION_STARTED,
          targetTable: 'class_sessions',
          targetId: session.id,
          description: 'Giảng viên mở phiên điểm danh và nạp roster AI.',
        },
      });
    });
    this.checkpointFaces.delete(session.id);
    if (!demoMode && !isBrowserCameraUrl(session.classroom.rtspUrl)) {
      this.startCaptureLoop(session.id, actorId, actorRole);
    }
    return this.getDetail(session.id, actorId, actorRole);
  }

  async capture(sessionId: string, actorId: string, actorRole: UserRole, mode: CaptureMode = 'CHECKPOINT') {
    const session = await this.getAuthorizedSession(sessionId, actorId, actorRole);
    if (session.status !== SessionStatus.LIVE_NOW && session.status !== SessionStatus.DEGRADED) throw serviceError('Cần mở phiên điểm danh trước khi quét camera.', 409);
    if (!session.classroom.rtspUrl) throw serviceError('Phòng học chưa có RTSP camera.', 422);
    if (isBrowserCameraUrl(session.classroom.rtspUrl)) throw serviceError('Phòng học đang dùng webcam trình duyệt. Hãy gửi frame từ máy giáo viên.', 409);

    let recognition: RecognitionFrame;
    try {
      if (mode !== 'CHECKPOINT') {
        recognition = await aiClientService.captureRtsp(session.id, session.classroom.rtspUrl);
      } else {
        this.checkpointFaces.delete(session.id);
        const deadline = Date.now() + 5_000;
        const enrolledCount = session.courseClass.enrollments.filter(({ student }) => student.isFaceEnrolled).length;
        do {
          recognition = await aiClientService.captureRtsp(session.id, session.classroom.rtspUrl);
          await this.processRecognition(session, actorId, actorRole, recognition, true, 'OBSERVE');
          if ((this.checkpointFaces.get(session.id)?.size || 0) >= enrolledCount || Date.now() >= deadline) break;
          await new Promise((resolve) => setTimeout(resolve, Math.min(1_000, deadline - Date.now())));
        } while (true);
      }
    } catch (error) {
      await prisma.classSession.update({ where: { id: session.id }, data: { status: SessionStatus.DEGRADED, failureReason: error instanceof Error ? error.message : 'AI or camera unavailable.' } });
      throw error;
    }

    return this.processRecognition(session, actorId, actorRole, recognition, true, mode);
  }

  async captureImage(sessionId: string, actorId: string, actorRole: UserRole, image: Express.Multer.File, mode: CaptureMode = 'CHECKPOINT') {
    const session = await this.getAuthorizedSession(sessionId, actorId, actorRole);
    if (session.status !== SessionStatus.LIVE_NOW && session.status !== SessionStatus.DEGRADED) throw serviceError('Cần mở phiên điểm danh trước khi quét camera.', 409);

    try {
      const recognition = await aiClientService.recognize(session.id, image);
      return this.processRecognition(session, actorId, actorRole, recognition, false, mode);
    } catch (error) {
      await prisma.classSession.update({ where: { id: session.id }, data: { status: SessionStatus.DEGRADED, failureReason: error instanceof Error ? error.message : 'AI unavailable.' } });
      throw error;
    }
  }

  private async processRecognition(session: AuthorizedSession, actorId: string, actorRole: UserRole, recognition: RecognitionFrame, includeFramePreview = true, mode: CaptureMode = 'CHECKPOINT') {
    if (mode === 'OBSERVE') {
      this.collectCheckpointFaces(session.id, recognition.faces);
      return {
        capturedAt: new Date(),
        matched: recognition.faces.filter((face) => face.result === 'MATCHED').length,
        unknown: recognition.faces.filter((face) => face.result !== 'MATCHED').length,
        detectedFacesCount: recognition.faces.length,
        framePreview: includeFramePreview ? recognition.framePreview : undefined,
        frameWidth: recognition.frameWidth,
        frameHeight: recognition.frameHeight,
        faces: recognition.faces.map((face) => ({
          result: face.result,
          studentCode: face.studentId,
          fullName: face.studentId ? session.courseClass.enrollments.find(({ student }) => student.userCode === face.studentId)?.student.fullName : undefined,
          score: face.score,
          bbox: face.bbox,
        })),
      };
    }
    const studentsByCode = new Map(session.courseClass.enrollments.map(({ student }) => [student.userCode, student]));
    const startedAt = session.startedAt || new Date();
    const now = new Date();
    const late = mode !== 'CHECKPOINT' || !demoMode
      ? (now.getTime() - startedAt.getTime()) / 60_000 > lateCutoffMinutes
      : false;
    let matched = 0;
    let unknown = 0;
    const unknownDetectionIds: string[] = [];
    const existingLogs = await prisma.attendanceLog.findMany({
      where: { sessionId: session.id },
      select: { studentId: true, status: true, bestScore: true, firstSeenAt: true, bestEvidenceId: true, checkpoints: true, manualOverrideBy: true },
    });
    const milestone = mode === 'FINAL'
      ? -1
      : mode === 'CHECKPOINT'
        ? this.nextCheckpointMinute(existingLogs)
        : Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 60_000));
    const faces = mode === 'CHECKPOINT'
      ? this.consumeCheckpointFaces(session.id, recognition.faces)
      : recognition.faces;
    const logsByStudentId = new Map(existingLogs.map((log) => [log.studentId, log]));
    const processedStudentIds = new Set<string>();
    const detectedStudentIds = new Set<string>();
    const evidenceByStudentId = new Map<string, { score: number; evidenceId: string }>();
    const canStoreUnknownEvidence = Date.now() - (this.unknownEvidenceAt.get(session.id) || 0) >= unknownEvidenceCooldownMs;

    for (const face of faces) {
      const student = face.studentId ? studentsByCode.get(face.studentId) : undefined;
      if (face.result !== 'MATCHED' || !student) {
        unknown += 1;
        if (!canStoreUnknownEvidence) continue;
        const filename = await evidenceService.saveBase64Jpeg(face.evidenceCrop);
        const detection = await prisma.sessionFaceDetection.create({
          data: {
            sessionId: session.id,
            result: face.result,
            frameId: `${Date.now()}-${face.bbox.x}-${face.bbox.y}`,
            imageUrl: filename,
            score: face.score,
            runnerUpScore: face.runnerUpScore,
            quality: face.quality,
            pose: face.pose,
            boundingBox: face.bbox,
          },
        });
        unknownDetectionIds.push(detection.id);
        continue;
      }
      matched += 1;
      const currentLog = logsByStudentId.get(student.id);
      detectedStudentIds.add(student.id);
      if (processedStudentIds.has(student.id)) continue;
      processedStudentIds.add(student.id);
      const filename = await evidenceService.saveBase64Jpeg(face.evidenceCrop);
      await prisma.sessionFaceDetection.create({
        data: {
          sessionId: session.id,
          studentId: student.id,
          result: face.result,
          frameId: `${Date.now()}-${face.bbox.x}-${face.bbox.y}`,
          imageUrl: filename,
          score: face.score,
          runnerUpScore: face.runnerUpScore,
          quality: face.quality,
          pose: face.pose,
          boundingBox: face.bbox,
        },
      });
      const existingProof = await prisma.sessionProofSnapshot.findFirst({ where: { sessionId: session.id, studentId: student.id, milestoneMinutes: milestone } });
      const evidence = existingProof || await prisma.sessionProofSnapshot.create({
        data: { sessionId: session.id, studentId: student.id, milestoneMinutes: milestone, imageUrl: filename, aiMatchScore: face.score, boundingBox: face.bbox },
      });
      const previousEvidence = evidenceByStudentId.get(student.id);
      if (!previousEvidence || face.score >= previousEvidence.score) evidenceByStudentId.set(student.id, { score: face.score, evidenceId: evidence.id });
      emitSessionEvent(session.id, 'attendance:face_detected', { studentCode: student.userCode, fullName: student.fullName, matchPercentage: face.score * 100, boundingBox: face.bbox, capturedAt: now.toISOString() });
    }

    if (mode === 'CHECKPOINT') {
      const checkpointKey = `${milestone}m`;
      await Promise.all(existingLogs.map((log) => {
        if (log.manualOverrideBy || log.status === AttendanceStatus.EXCUSED) return null;
        const evidence = evidenceByStudentId.get(log.studentId);
        const isPresent = detectedStudentIds.has(log.studentId);
        const currentScore = log.bestScore ? Number(log.bestScore) : -1;
        const isBetter = Boolean(evidence && evidence.score >= currentScore);
        const checkpoints = this.checkpointValues(log.checkpoints);
        checkpoints[checkpointKey] = isPresent ? 'PRESENT' : 'ABSENT';
        return prisma.attendanceLog.update({
          where: { uq_session_student: { sessionId: session.id, studentId: log.studentId } },
          data: {
            status: isPresent ? (late ? AttendanceStatus.LATE : AttendanceStatus.PRESENT) : AttendanceStatus.ABSENT,
            lateMinutes: isPresent && late ? Math.max(1, Math.floor((now.getTime() - startedAt.getTime()) / 60_000)) : 0,
            firstSeenAt: isPresent ? log.firstSeenAt || now : log.firstSeenAt,
            bestScore: isBetter ? evidence!.score : log.bestScore,
            bestEvidenceId: isBetter ? evidence!.evidenceId : log.bestEvidenceId,
            checkpoints: checkpoints as Prisma.InputJsonValue,
          },
        });
      }));
    } else if (mode === 'FINAL') {
      await Promise.all([...evidenceByStudentId.entries()].map(([studentId, evidence]) =>
        prisma.attendanceLog.update({
          where: { uq_session_student: { sessionId: session.id, studentId } },
          data: { bestScore: evidence.score, bestEvidenceId: evidence.evidenceId },
        }),
      ));
    }

    if (unknownDetectionIds.length) this.unknownEvidenceAt.set(session.id, Date.now());
    if (session.status === SessionStatus.DEGRADED) await prisma.classSession.update({ where: { id: session.id }, data: { status: SessionStatus.LIVE_NOW, failureReason: null } });
    const detail = await this.getDetail(session.id, actorId, actorRole);
    const framePreview = includeFramePreview ? recognition.framePreview : undefined;
    emitSessionEvent(session.id, 'attendance:stat_update', detail.counts);
    emitSessionEvent(session.id, 'attendance:frame_captured', {
      capturedAt: new Date().toISOString(),
      framePreview,
      frameWidth: recognition.frameWidth,
      frameHeight: recognition.frameHeight,
      faces: recognition.faces.map((face) => ({
        result: face.result,
        studentCode: face.studentId,
        fullName: face.studentId ? studentsByCode.get(face.studentId)?.fullName : undefined,
        score: face.score,
        bbox: face.bbox,
      })),
    });
    unknownDetectionIds.forEach((id) => emitSessionEvent(session.id, 'security:intruder_alert', { alert: 'INTRUDER_DETECTED', cropUrl: `/api/v1/teacher/sessions/${session.id}/evidence/${id}` }));
    return {
      capturedAt: new Date(),
      mode,
      checkpointMinutes: mode === 'CHECKPOINT' ? milestone : undefined,
      matched,
      unknown,
      detectedFacesCount: recognition.faces.length,
      counts: detail.counts,
      framePreview,
      frameWidth: recognition.frameWidth,
      frameHeight: recognition.frameHeight,
      faces: recognition.faces.map((face) => ({
        result: face.result,
        studentCode: face.studentId,
        fullName: face.studentId ? studentsByCode.get(face.studentId)?.fullName : undefined,
        score: face.score,
        bbox: face.bbox,
      })),
    };
  }

  async resolveByCourseCode(courseCode: string, actorId: string, actorRole: UserRole) {
    const normalizedCode = courseCode.trim();
    if (!normalizedCode) throw serviceError('Mã môn học là bắt buộc.', 422);
    const sessions = await prisma.classSession.findMany({
      where: {
        status: { not: SessionStatus.CANCELLED },
        courseClass: {
          ...(actorRole === UserRole.ADMIN ? {} : { teacherId: actorId }),
          course: { courseCode: { equals: normalizedCode, mode: 'insensitive' } },
        },
      },
      include: { courseClass: { include: { course: true } }, classroom: true },
      orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }],
      take: 20,
    });
    return sessions.map((session) => ({
      id: session.id,
      courseCode: session.courseClass.course.courseCode,
      courseName: session.courseClass.course.courseName,
      classCode: session.courseClass.classCode,
      sessionDate: session.sessionDate,
      sessionNumber: session.sessionNumber,
      roomCode: session.classroom.roomCode,
      status: session.status,
      cameraMode: isBrowserCameraUrl(session.classroom.rtspUrl) ? 'BROWSER' as const : 'RTSP' as const,
    }));
  }

  async override(sessionId: string, studentId: string, actorId: string, actorRole: UserRole, newStatus: AttendanceStatus, reason: string) {
    const session = await this.getAuthorizedSession(sessionId, actorId, actorRole);
    const record = await prisma.attendanceLog.findUnique({ where: { uq_session_student: { sessionId, studentId } } });
    if (!record) throw serviceError('Sinh viên không thuộc phiên học này.', 404);
    await prisma.$transaction(async (tx) => {
      await tx.attendanceLog.update({
        where: { id: record.id },
        data: { status: newStatus, manualOverrideBy: actorId, overrideReason: reason, overrideAt: new Date() },
      });
      await tx.systemAuditLog.create({
        data: {
          actorId,
          actionType: AuditActionType.MANUAL_OVERRIDE,
          targetTable: 'attendance_logs',
          targetId: record.id,
          beforeState: { status: record.status },
          afterState: { status: newStatus },
          description: reason,
        },
      });
    });
    return this.getDetail(session.id, actorId, actorRole);
  }

  async end(sessionId: string, actorId: string, actorRole: UserRole, confirmEarly = false) {
    const session = await this.getAuthorizedSession(sessionId, actorId, actorRole);
    if (session.status !== SessionStatus.LIVE_NOW && session.status !== SessionStatus.DEGRADED) {
      throw serviceError('Phiên học không ở trạng thái đang diễn ra.', 409);
    }
    if (earlyEndMinutes > 0) {
      const today = session.sessionDate.toISOString().slice(0, 10);
      const plannedEnd = new Date(`${today}T${session.endTime.toISOString().slice(11, 19)}`);
      if (!confirmEarly && plannedEnd.getTime() - Date.now() > earlyEndMinutes * 60_000) {
        throw serviceError('Phiên học còn quá 30 phút. Gửi confirmEarly=true để xác nhận kết thúc sớm.', 409);
      }
    }
    if (!isBrowserCameraUrl(session.classroom.rtspUrl)) await this.capture(sessionId, actorId, actorRole, 'FINAL').catch(() => undefined);
    this.stopCaptureLoop(sessionId);
    this.unknownEvidenceAt.delete(sessionId);
    this.checkpointFaces.delete(sessionId);
    await prisma.$transaction(async (tx) => {
      await tx.attendanceLog.updateMany({ where: { sessionId, status: AttendanceStatus.UNCONFIRMED }, data: { status: AttendanceStatus.ABSENT } });
      await tx.classSession.update({ where: { id: sessionId }, data: { status: SessionStatus.COMPLETED, endedAt: new Date() } });
      await tx.systemAuditLog.create({
        data: { actorId, actionType: AuditActionType.SESSION_ENDED, targetTable: 'class_sessions', targetId: sessionId, description: 'Giảng viên kết thúc và chốt phiên điểm danh.' },
      });
    });
    await aiClientService.unloadRoster(sessionId).catch(() => undefined);
    return this.getDetail(sessionId, actorId, actorRole);
  }

  async getDetail(sessionId: string, actorId: string, actorRole: UserRole) {
    const session = await this.getAuthorizedSession(sessionId, actorId, actorRole);
    const logs = await prisma.attendanceLog.findMany({
      where: { sessionId },
      include: { student: { select: { id: true, userCode: true, fullName: true, avatarUrl: true } } },
      orderBy: { student: { userCode: 'asc' } },
    });
    const detections = await prisma.sessionFaceDetection.findMany({
      where: { sessionId, result: { in: ['UNKNOWN_PERSON', 'AMBIGUOUS'] } },
      orderBy: { capturedAt: 'desc' },
      take: 20,
    });
    const counts = logs.reduce(
      (total, log) => ({ ...total, [log.status]: (total[log.status] || 0) + 1 }),
      {} as Record<string, number>,
    );
    return {
      session: { id: session.id, status: session.status, courseName: session.courseClass.course.courseName, className: session.courseClass.classCode, roomCode: session.classroom.roomCode, cameraMode: isBrowserCameraUrl(session.classroom.rtspUrl) ? 'BROWSER' as const : 'RTSP' as const, startedAt: session.startedAt, endedAt: session.endedAt },
      counts: { total: logs.length, present: counts.PRESENT || 0, late: counts.LATE || 0, absent: counts.ABSENT || 0, truant: counts.TRUANT || 0, unconfirmed: counts.UNCONFIRMED || 0 },
      students: logs.map((log) => ({ studentId: log.studentId, studentCode: log.student.userCode, fullName: log.student.fullName, avatarUrl: log.student.avatarUrl, firstDetectedAt: log.firstSeenAt, matchPercentage: log.bestScore ? Number(log.bestScore) * 100 : undefined, status: log.status, evidenceUrl: log.bestEvidenceId ? `/api/v1/teacher/sessions/${session.id}/evidence/${log.bestEvidenceId}` : undefined })),
      unknownFaces: detections.map((detection) => ({ id: detection.id, result: detection.result, capturedAt: detection.capturedAt, cropUrl: `/api/v1/teacher/sessions/${session.id}/evidence/${detection.id}` })),
    };
  }

  async readEvidence(sessionId: string, evidenceId: string, actorId: string, actorRole: UserRole) {
    await this.getAuthorizedSession(sessionId, actorId, actorRole);
    const [detection, snapshot] = await Promise.all([
      prisma.sessionFaceDetection.findFirst({ where: { id: evidenceId, sessionId } }),
      prisma.sessionProofSnapshot.findFirst({ where: { id: evidenceId, sessionId } }),
    ]);
    const imageUrl = detection?.imageUrl || snapshot?.imageUrl;
    if (!imageUrl) throw serviceError('Không tìm thấy ảnh bằng chứng.', 404);
    return evidenceService.read(imageUrl);
  }
}

export const teacherSessionService = new TeacherSessionService();
