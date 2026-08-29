import { AttendanceStatus, AuditActionType, SessionStatus, UserRole } from '@prisma/client';
import prisma from '../config/prisma';
import { aiClientService } from './ai-client.service';
import { evidenceService } from './evidence.service';
import { emitSessionEvent } from '../realtime/socket';

const lateCutoffMinutes = Number(process.env.LATE_CUTOFF_MINUTES || 15);
const earlyEndMinutes = Number(process.env.EARLY_END_MINUTES || 30);

function serviceError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

export class TeacherSessionService {
  private readonly captureTimers = new Map<string, NodeJS.Timeout>();
  private readonly captureInFlight = new Set<string>();
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
    const interval = Math.max(1_000, Number(process.env.AI_CAPTURE_INTERVAL_MS || 5_000));
    const timer = setInterval(() => {
      if (this.captureInFlight.has(sessionId)) return;
      this.captureInFlight.add(sessionId);
      void this.capture(sessionId, actorId, actorRole).catch(() => undefined).finally(() => this.captureInFlight.delete(sessionId));
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

  async start(sessionId: string, actorId: string, actorRole: UserRole) {
    const session = await this.getAuthorizedSession(sessionId, actorId, actorRole);
    if (session.status === SessionStatus.COMPLETED || session.status === SessionStatus.CANCELLED) {
      throw serviceError('Phiên học đã kết thúc hoặc bị hủy.', 409);
    }
    if (session.status === SessionStatus.LIVE_NOW) return this.getDetail(sessionId, actorId, actorRole);

    const roster = session.courseClass.enrollments.map((enrollment) => enrollment.student);
    const enrolled = roster.filter((student) => student.isFaceEnrolled);
    if (!enrolled.length) throw serviceError('Lớp chưa có sinh viên nào hoàn tất đăng ký khuôn mặt.', 422);

    const rosterVersion = `${session.createdAt.toISOString()}:${enrolled.length}`;
    await aiClientService.loadRoster(session.id, rosterVersion, enrolled.map((student) => student.userCode));

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
    this.startCaptureLoop(session.id, actorId, actorRole);
    return this.getDetail(session.id, actorId, actorRole);
  }

  async capture(sessionId: string, actorId: string, actorRole: UserRole) {
    const session = await this.getAuthorizedSession(sessionId, actorId, actorRole);
    if (session.status !== SessionStatus.LIVE_NOW && session.status !== SessionStatus.DEGRADED) throw serviceError('Cần mở phiên điểm danh trước khi quét camera.', 409);
    if (!session.classroom.rtspUrl) throw serviceError('Phòng học chưa có RTSP camera.', 422);

    let recognition: Awaited<ReturnType<typeof aiClientService.captureRtsp>>;
    try {
      recognition = await aiClientService.captureRtsp(session.id, session.classroom.rtspUrl);
    } catch (error) {
      await prisma.classSession.update({ where: { id: session.id }, data: { status: SessionStatus.DEGRADED, failureReason: error instanceof Error ? error.message : 'AI or camera unavailable.' } });
      throw error;
    }

    const studentsByCode = new Map(session.courseClass.enrollments.map(({ student }) => [student.userCode, student]));
    const startedAt = session.startedAt || new Date();
    const late = (Date.now() - startedAt.getTime()) / 60_000 > lateCutoffMinutes;
    const milestone = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 60_000));
    let matched = 0;
    let unknown = 0;
    const unknownDetectionIds: string[] = [];

    for (const face of recognition.faces) {
      const filename = await evidenceService.saveBase64Jpeg(face.evidenceCrop);
      const student = face.studentId ? studentsByCode.get(face.studentId) : undefined;
      const detection = await prisma.sessionFaceDetection.create({
        data: {
          sessionId: session.id,
          studentId: student?.id,
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

      if (face.result !== 'MATCHED' || !student) {
        unknown += 1;
        unknownDetectionIds.push(detection.id);
        continue;
      }
      matched += 1;
      const existingProof = await prisma.sessionProofSnapshot.findFirst({ where: { sessionId: session.id, studentId: student.id, milestoneMinutes: milestone } });
      const evidence = existingProof || await prisma.sessionProofSnapshot.create({
        data: { sessionId: session.id, studentId: student.id, milestoneMinutes: milestone, imageUrl: filename, aiMatchScore: face.score, boundingBox: face.bbox },
      });
      const targetStatus = late ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;
      const currentLog = await prisma.attendanceLog.findUnique({ where: { uq_session_student: { sessionId: session.id, studentId: student.id } } });
      const currentScore = currentLog?.bestScore ? Number(currentLog.bestScore) : -1;
      const isBetter = face.score >= currentScore;
      await prisma.attendanceLog.update({
        where: { uq_session_student: { sessionId: session.id, studentId: student.id } },
        data: {
          status: targetStatus,
          firstSeenAt: currentLog?.firstSeenAt || new Date(),
          bestScore: isBetter ? face.score : currentLog?.bestScore,
          bestEvidenceId: isBetter ? evidence.id : currentLog?.bestEvidenceId,
          lateMinutes: late ? Math.max(1, Math.floor((Date.now() - startedAt.getTime()) / 60_000)) : 0,
        },
      });
      emitSessionEvent(session.id, 'attendance:face_detected', { studentCode: student.userCode, fullName: student.fullName, matchPercentage: face.score * 100, boundingBox: face.bbox, capturedAt: new Date().toISOString() });
    }

    if (session.status === SessionStatus.DEGRADED) await prisma.classSession.update({ where: { id: session.id }, data: { status: SessionStatus.LIVE_NOW, failureReason: null } });
    const detail = await this.getDetail(session.id, actorId, actorRole);
    emitSessionEvent(session.id, 'attendance:stat_update', detail.counts);
    unknownDetectionIds.forEach((id) => emitSessionEvent(session.id, 'security:intruder_alert', { alert: 'INTRUDER_DETECTED', cropUrl: `/api/v1/teacher/sessions/${session.id}/evidence/${id}` }));
    return { capturedAt: new Date(), matched, unknown, detectedFacesCount: recognition.faces.length, counts: detail.counts };
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
    const today = session.sessionDate.toISOString().slice(0, 10);
    const plannedEnd = new Date(`${today}T${session.endTime.toISOString().slice(11, 19)}`);
    if (!confirmEarly && plannedEnd.getTime() - Date.now() > earlyEndMinutes * 60_000) {
      throw serviceError('Phiên học còn quá 30 phút. Gửi confirmEarly=true để xác nhận kết thúc sớm.', 409);
    }
    this.stopCaptureLoop(sessionId);
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
      session: { id: session.id, status: session.status, courseName: session.courseClass.course.courseName, roomCode: session.classroom.roomCode, startedAt: session.startedAt, endedAt: session.endedAt },
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
