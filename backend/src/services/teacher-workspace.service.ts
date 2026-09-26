import { AttendanceStatus, RequestStatus, UserRole } from '@prisma/client';
import prisma from '../config/prisma';

function serviceError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

export class TeacherWorkspaceService {
  async leaveRequests(teacherId: string, role: UserRole) {
    const requests = await prisma.leaveRequest.findMany({
      where: role === UserRole.ADMIN ? {} : { session: { courseClass: { teacherId } } },
      include: { student: true, session: { include: { courseClass: { include: { course: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return requests.map((request) => ({
      leaveRequestId: request.id,
      sessionId: request.sessionId,
      studentCode: request.student.userCode,
      studentName: request.student.fullName,
      courseName: request.session.courseClass.course.courseName,
      requestType: request.requestType,
      reason: request.reason,
      attachmentUrl: request.attachmentUrl,
      status: request.status,
      createdAt: request.createdAt,
    }));
  }

  async reviewLeave(sessionId: string, leaveRequestId: string, decision: RequestStatus, actorId: string, role: UserRole) {
    if (decision !== RequestStatus.APPROVED && decision !== RequestStatus.REJECTED) throw serviceError('decision phải là APPROVED hoặc REJECTED.', 422);
    const request = await prisma.leaveRequest.findUnique({
      where: { id: leaveRequestId },
      include: { session: { include: { courseClass: true } } },
    });
    if (!request || request.sessionId !== sessionId) throw serviceError('Không tìm thấy đơn xin phép của phiên học.', 404);
    if (role !== UserRole.ADMIN && request.session.courseClass.teacherId !== actorId) throw serviceError('Bạn không có quyền duyệt đơn này.', 403);
    if (request.status !== RequestStatus.PENDING) throw serviceError('Đơn đã được xử lý.', 409);
    await prisma.$transaction(async (tx) => {
      await tx.leaveRequest.update({ where: { id: request.id }, data: { status: decision, reviewerId: actorId, reviewedAt: new Date() } });
      if (decision === RequestStatus.APPROVED && request.requestType === 'FULL_SESSION') {
        await tx.attendanceLog.upsert({
          where: { uq_session_student: { sessionId, studentId: request.studentId } },
          create: { sessionId, studentId: request.studentId, status: AttendanceStatus.EXCUSED },
          update: { status: AttendanceStatus.EXCUSED },
        });
      }
    });
    return { leaveRequestId, status: decision };
  }

  async reportMatrix(courseClassId: string, teacherId: string, role: UserRole) {
    const courseClass = await prisma.courseClass.findUnique({
      where: { id: courseClassId },
      include: {
        course: true,
        enrollments: { include: { student: true } },
        sessions: { where: { status: { in: ['COMPLETED', 'REVIEW'] } }, include: { attendanceLogs: true }, orderBy: { sessionDate: 'asc' } },
      },
    });
    if (!courseClass) throw serviceError('Không tìm thấy lớp học phần.', 404);
    if (role !== UserRole.ADMIN && courseClass.teacherId !== teacherId) throw serviceError('Bạn không có quyền xem báo cáo lớp này.', 403);
    const matrix = courseClass.enrollments.map(({ student }) => {
      const sessions = courseClass.sessions.map((session) => session.attendanceLogs.find((log) => log.studentId === student.id)?.status || null);
      const absences = sessions.filter((status) => status === AttendanceStatus.ABSENT || status === AttendanceStatus.TRUANT).length;
      const attendanceRate = sessions.length ? Number((((sessions.length - absences) / sessions.length) * 100).toFixed(1)) : 0;
      return { studentCode: student.userCode, fullName: student.fullName, sessions, totalAbsences: absences, attendanceRate, isBannedFromExam: attendanceRate < 80 && sessions.length > 0 };
    });
    return {
      kpis: {
        averageAttendanceRate: matrix.length ? Number((matrix.reduce((total, item) => total + item.attendanceRate, 0) / matrix.length).toFixed(1)) : 0,
        growthRate: 0,
        completedSessions: courseClass.sessions.length,
        examBanCount: matrix.filter((item) => item.isBannedFromExam).length,
      },
      matrix,
    };
  }
}

export const teacherWorkspaceService = new TeacherWorkspaceService();
