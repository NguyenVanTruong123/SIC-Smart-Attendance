import { LeaveRequestType, RequestStatus } from '@prisma/client';
import prisma from '../config/prisma';
import { evidenceService } from './evidence.service';
import { periodFromClock, periodLabel } from '../utils/study-periods';

function serviceError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

function startOfWeek(value?: string) {
  const date = value ? new Date(`${value}T00:00:00.000Z`) : new Date();
  if (Number.isNaN(date.getTime())) throw serviceError('weekStart không hợp lệ.', 422);
  date.setUTCHours(0, 0, 0, 0);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1));
  return date;
}

function clock(value: Date) {
  return `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}`;
}

export class StudentService {
  async dashboard(studentId: string, requestedWeekStart?: string) {
    const weekStart = startOfWeek(requestedWeekStart);
    const weekEndExclusive = new Date(weekStart);
    weekEndExclusive.setUTCDate(weekEndExclusive.getUTCDate() + 7);

    const [student, enrollments, weeklySessions, attendanceLogs] = await Promise.all([
      prisma.user.findUnique({ where: { id: studentId }, select: { userCode: true, fullName: true, className: true } }),
      prisma.courseEnrollment.findMany({
        where: { studentId, courseClass: { status: 'ACTIVE' } },
        include: { courseClass: { include: { course: true } } },
        orderBy: { enrolledAt: 'asc' },
      }),
      prisma.classSession.findMany({
        where: {
          sessionDate: { gte: weekStart, lt: weekEndExclusive },
          courseClass: { status: 'ACTIVE', enrollments: { some: { studentId } } },
        },
        include: {
          classroom: { select: { roomCode: true } },
          courseClass: { include: { course: true } },
        },
        orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }],
      }),
      prisma.attendanceLog.findMany({ where: { studentId }, select: { status: true } }),
    ]);

    if (!student) throw serviceError('Không tìm thấy tài khoản sinh viên.', 404);

    const finalizedLogs = attendanceLogs.filter((log) => log.status !== 'UNCONFIRMED');
    const onTimeCount = attendanceLogs.filter((log) => log.status === 'PRESENT').length;
    const lateCount = attendanceLogs.filter((log) => log.status === 'LATE').length;
    const excusedAbsentCount = attendanceLogs.filter((log) => log.status === 'EXCUSED').length;
    const unexcusedAbsentCount = attendanceLogs.filter((log) => ['ABSENT', 'TRUANT'].includes(log.status)).length;
    const attendedCount = onTimeCount + lateCount + excusedAbsentCount;
    const overallRate = finalizedLogs.length ? Number(((attendedCount / finalizedLogs.length) * 100).toFixed(1)) : 0;
    const weekStartValue = weekStart.toISOString().slice(0, 10);
    const weekEndValue = new Date(weekEndExclusive.getTime() - 86_400_000).toISOString().slice(0, 10);

    const weeklySchedule = weeklySessions.map((session) => {
      const sessionDate = new Date(session.sessionDate);
      const weekday = sessionDate.getUTCDay() === 0 ? 7 : sessionDate.getUTCDay();
      const startTime = clock(new Date(session.startTime));
      const endTime = clock(new Date(session.endTime));
      const periodStart = session.periodStart ?? periodFromClock(startTime);
      const periodEnd = session.periodEnd ?? periodFromClock(endTime);
      return {
        id: session.id,
        sessionNumber: session.sessionNumber,
        sessionDate: sessionDate.toISOString().slice(0, 10),
        dayOfWeek: weekday,
        startTime,
        endTime,
        periodStart,
        periodEnd,
        periodLabel: periodLabel(periodStart, periodEnd),
        courseCode: session.courseClass.course.courseCode,
        courseName: session.courseClass.course.courseName,
        classCode: session.courseClass.classCode,
        roomCode: session.classroom.roomCode,
        topic: session.topic,
        status: session.status,
      };
    });

    return {
      student: { code: student.userCode, name: student.fullName, class: student.className || 'Chưa cập nhật' },
      semester: enrollments[0]?.courseClass.semester || 'Chưa cập nhật',
      overallRate,
      ranking: '—',
      stats: { onTimeCount, lateCount, unexcusedAbsentCount, excusedAbsentCount },
      urgentAlert: {
        hasRisk: unexcusedAbsentCount > 0,
        courseName: '',
        absentCount: unexcusedAbsentCount,
        totalSessions: finalizedLogs.length,
        absentPercentage: finalizedLogs.length ? Number(((unexcusedAbsentCount / finalizedLogs.length) * 100).toFixed(1)) : 0,
        message: unexcusedAbsentCount ? `Bạn có ${unexcusedAbsentCount} buổi chưa có phép.` : '',
      },
      enrolledCourses: enrollments.map(({ courseClass }) => ({
        courseCode: courseClass.course.courseCode,
        courseName: courseClass.course.courseName,
        room: 'Theo lịch tuần',
        progress: `${courseClass.classCode} · ${courseClass.semester}`,
        attendanceRate: overallRate,
        status: overallRate >= 80 ? 'SAFE' : overallRate >= 60 ? 'WARNING' : 'DANGER',
      })),
      weeklySchedule,
      weekStart: weekStartValue,
      weekEnd: weekEndValue,
    };
  }

  async attendanceHistory(studentId: string, search?: string) {
    const records = await prisma.attendanceLog.findMany({
      where: {
        studentId,
        ...(search ? { session: { courseClass: { course: { OR: [{ courseCode: { contains: search, mode: 'insensitive' } }, { courseName: { contains: search, mode: 'insensitive' } }] } } } } : {}),
      },
      include: { session: { include: { classroom: true, courseClass: { include: { course: true } } } } },
      orderBy: { session: { sessionDate: 'desc' } },
    });
    return records.map((record) => ({
      id: record.id,
      status: record.status,
      lateMinutes: record.lateMinutes,
      firstSeenAt: record.firstSeenAt,
      date: record.session.sessionDate.toISOString().slice(0, 10),
      sessionDate: record.session.sessionDate,
      startTime: clock(record.session.startTime),
      endTime: clock(record.session.endTime),
      courseCode: record.session.courseClass.course.courseCode,
      courseName: record.session.courseClass.course.courseName,
      roomCode: record.session.classroom.roomCode,
      evidenceId: record.bestEvidenceId,
      snapshotUrl: record.bestEvidenceId ? `/api/v1/student/evidence/${record.bestEvidenceId}` : undefined,
    }));
  }

  async readEvidence(studentId: string, evidenceId: string) {
    const record = await prisma.attendanceLog.findFirst({ where: { studentId, bestEvidenceId: evidenceId } });
    if (!record) throw serviceError('Không tìm thấy ảnh điểm danh của tài khoản này.', 404);
    const snapshot = await prisma.sessionProofSnapshot.findFirst({ where: { id: evidenceId, sessionId: record.sessionId, studentId } });
    if (!snapshot) throw serviceError('Không tìm thấy ảnh điểm danh.', 404);
    return evidenceService.read(snapshot.imageUrl);
  }

  async readEnrollmentPreview(studentId: string) {
    const profile = await prisma.userBiometric.findUnique({ where: { userId: studentId } });
    if (!profile?.enrolledFaceUrl) throw serviceError('Chưa có ảnh enrollment.', 404);
    return evidenceService.read(profile.enrolledFaceUrl);
  }

  async biometricProfile(studentId: string) {
    const user = await prisma.user.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        userCode: true,
        fullName: true,
        email: true,
        department: true,
        className: true,
        isFaceEnrolled: true,
        enrollmentImages: {
          orderBy: { imageIndex: 'asc' },
          select: { id: true, imageIndex: true, imageUrl: true, mimeType: true, pose: true },
        },
        biometricProfile: {
          select: {
            faissVectorId: true,
            enrolledFaceUrl: true,
            lastEnrolledAt: true,
            modelVersion: true,
            embeddingDimension: true,
            enrollmentVersion: true,
          },
        },
      },
    });

    if (!user) throw serviceError('Không tìm thấy tài khoản sinh viên.', 404);

    const profile = user.biometricProfile;
    const enrollmentImages = user.enrollmentImages
      ? (await Promise.all(user.enrollmentImages.map(async (image) => {
          try {
            return {
              id: image.id,
              imageIndex: image.imageIndex,
              pose: image.pose,
              previewBase64: await evidenceService.readDataUrl(image.imageUrl, image.mimeType),
            };
          } catch {
            return null;
          }
        }))).filter((image): image is NonNullable<typeof image> => image !== null)
      : [];
    return {
      student: {
        id: user.id,
        userCode: user.userCode,
        fullName: user.fullName,
        email: user.email,
        department: user.department,
        className: user.className,
      },
      status: user.isFaceEnrolled ? 'ENROLLED' : 'NOT_ENROLLED',
      biometric: profile && (user.isFaceEnrolled || profile.lastEnrolledAt || profile.enrolledFaceUrl)
        ? {
            vectorId: profile.faissVectorId === null ? null : `#V-${profile.faissVectorId.toString()}`,
            modelVersion: profile.modelVersion,
            embeddingDimension: profile.embeddingDimension,
            enrollmentVersion: profile.enrollmentVersion,
            enrolledAt: profile.lastEnrolledAt,
          }
        : null,
      previewUrl: profile?.enrolledFaceUrl ? '/api/v1/student/face-preview' : null,
      enrollmentImages,
    };
  }

  async listLeaveRequests(studentId: string) {
    return prisma.leaveRequest.findMany({
      where: { studentId },
      include: { session: { include: { courseClass: { include: { course: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createLeaveRequest(studentId: string, sessionId: string, requestType: LeaveRequestType, reason: string, attachment?: Express.Multer.File) {
    const session = await prisma.classSession.findFirst({
      where: { id: sessionId, courseClass: { enrollments: { some: { studentId } } } },
    });
    if (!session) throw serviceError('Bạn không thuộc lớp học phần của phiên này.', 403);
    const existing = await prisma.leaveRequest.findFirst({ where: { studentId, sessionId, status: RequestStatus.PENDING } });
    if (existing) throw serviceError('Đã có đơn chờ duyệt cho phiên học này.', 409);
    const attachmentUrl = attachment ? await evidenceService.saveBuffer(attachment.buffer, attachment.originalname.split('.').pop() || 'bin') : undefined;
    return prisma.leaveRequest.create({ data: { studentId, sessionId, requestType, reason, attachmentUrl } });
  }
}

export const studentService = new StudentService();
