import prisma from '../config/prisma';
import { UserRole, CameraStatus, SessionStatus } from '@prisma/client';

export class AdminOverviewService {
  /**
   * [GET] /api/v1/admin/overview
   * Lấy toàn bộ thông số và số liệu thực tế 100% từ Database PostgreSQL
   */
  async getSystemOverview() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // 1. Thống kê số lượng người dùng & eKYC
    const [
      totalStudents,
      totalTeachers,
      enrolledStudents,
      totalClassrooms,
      onlineCameras,
      offlineCameras,
      todaySessions,
      todayAttendanceLogs,
      recentAuditLogs,
    ] = await Promise.all([
      // Tổng sinh viên
      prisma.user.count({ where: { role: UserRole.STUDENT } }),
      // Tổng giảng viên
      prisma.user.count({ where: { role: UserRole.TEACHER } }),
      // Sinh viên đã nạp eKYC
      prisma.user.count({ where: { role: UserRole.STUDENT, isFaceEnrolled: true } }),
      // Tổng phòng học
      prisma.classroom.count(),
      // Camera Online
      prisma.classroom.count({ where: { cameraStatus: CameraStatus.ONLINE } }),
      // Camera Offline
      prisma.classroom.count({ where: { cameraStatus: CameraStatus.OFFLINE } }),
      // Ca học hôm nay
      prisma.classSession.findMany({
        where: {
          sessionDate: {
            gte: startOfToday,
            lte: endOfToday,
          },
        },
        include: {
          classroom: true,
          courseClass: {
            include: {
              course: true,
              teacher: true,
              _count: { select: { enrollments: true } },
            },
          },
          _count: {
            select: { attendanceLogs: true },
          },
        },
        orderBy: { startTime: 'asc' },
      }),
      // Logs điểm danh hôm nay
      prisma.attendanceLog.findMany({
        where: {
          createdAt: {
            gte: startOfToday,
            lte: endOfToday,
          },
        },
        select: { status: true },
      }),
      // Hoạt động mới nhất từ Audit Log
      prisma.systemAuditLog.findMany({
        take: 6,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { fullName: true, role: true } },
        },
      }),
    ]);

    // Tỉ lệ hoàn tất eKYC
    const enrolledRateNum = totalStudents > 0 ? (enrolledStudents / totalStudents) * 100 : 0;
    const enrolledRate = `${enrolledRateNum.toFixed(1)}%`;

    // Tỉ lệ phủ sóng camera
    const cameraCoverageRateNum = totalClassrooms > 0 ? (onlineCameras / totalClassrooms) * 100 : 0;
    const cameraCoverageRate = `${cameraCoverageRateNum.toFixed(0)}%`;

    // Phân loại điểm danh hôm nay
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;

    todayAttendanceLogs.forEach((log) => {
      if (log.status === 'PRESENT') presentCount++;
      else if (log.status === 'LATE') lateCount++;
      else if (log.status === 'ABSENT') absentCount++;
    });

    const totalLogs = todayAttendanceLogs.length;
    const todayAttendanceRate = totalLogs > 0 ? Number(((presentCount / totalLogs) * 100).toFixed(1)) : 0;

    // Chuẩn hóa ca học hôm nay với trạng thái thời gian thực
    const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

    const formattedTodaySessions = todaySessions.map((session) => {
      const sTime = new Date(session.startTime);
      const eTime = new Date(session.endTime);

      const startMinutes = sTime.getHours() * 60 + sTime.getMinutes();
      const endMinutes = eTime.getHours() * 60 + eTime.getMinutes();

      const startTimeStr = `${String(sTime.getHours()).padStart(2, '0')}:${String(sTime.getMinutes()).padStart(2, '0')}`;
      const endTimeStr = `${String(eTime.getHours()).padStart(2, '0')}:${String(eTime.getMinutes()).padStart(2, '0')}`;

      let liveStatus: 'LIVE' | 'UPCOMING' | 'COMPLETED' = 'UPCOMING';
      if (session.status === SessionStatus.COMPLETED || currentTimeMinutes > endMinutes) {
        liveStatus = 'COMPLETED';
      } else if (session.status === SessionStatus.LIVE_NOW || (currentTimeMinutes >= startMinutes && currentTimeMinutes <= endMinutes)) {
        liveStatus = 'LIVE';
      } else {
        liveStatus = 'UPCOMING';
      }

      return {
        id: session.id,
        sessionNumber: session.sessionNumber,
        courseCode: session.courseClass.course.courseCode,
        courseName: session.courseClass.course.courseName,
        classCode: session.courseClass.classCode,
        teacherName: session.courseClass.teacher?.fullName || 'Chưa phân công',
        roomCode: session.classroom?.roomCode || 'P.---',
        startTime: startTimeStr,
        endTime: endTimeStr,
        totalStudents: session.courseClass._count.enrollments,
        attendedCount: session._count.attendanceLogs,
        liveStatus,
      };
    });

    return {
      kpis: {
        totalStudents,
        totalTeachers,
        enrolledStudents,
        enrolledRate,
        totalClassrooms,
        onlineCameras,
        offlineCameras,
        cameraCoverageRate,
        todayActiveSessions: todaySessions.length,
        todayAttendanceRate,
      },
      attendanceBreakdown: {
        totalLogs,
        present: presentCount,
        late: lateCount,
        absent: absentCount,
      },
      todaySessions: formattedTodaySessions,
      recentActivities: recentAuditLogs.map((log) => ({
        id: log.id,
        action: log.actionType,
        description: log.description || log.actionType,
        userName: log.actor?.fullName || 'Hệ thống',
        userRole: log.actor?.role || 'SYSTEM',
        ipAddress: log.ipAddress,
        createdAt: log.createdAt,
      })),
    };
  }
}

export const adminOverviewService = new AdminOverviewService();
