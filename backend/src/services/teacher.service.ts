import prisma from '../config/prisma';
import { SessionStatus } from '@prisma/client';

export interface TeacherScheduleFilter {
  teacherId: string;
  startDate: Date;
  endDate: Date;
}

export class TeacherService {
  /**
   * [GET] /api/v1/teacher/schedule
   * Lấy danh sách ca dạy trong tuần của giảng viên phục vụ Time Grid Calendar
   */
  async getTeacherSchedule(filter: TeacherScheduleFilter) {
    const { teacherId, startDate, endDate } = filter;

    // Truy vấn tất cả ca học thuộc các lớp do giảng viên này phụ trách trong khoảng thời gian
    const sessions = await prisma.classSession.findMany({
      where: {
        courseClass: {
          teacherId,
        },
        sessionDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        classroom: true,
        courseClass: {
          include: {
            course: true,
            _count: {
              select: {
                enrollments: true,
              },
            },
          },
        },
        attendanceLogs: {
          select: {
            status: true,
          },
        },
        _count: {
          select: {
            attendanceLogs: true,
            proofSnapshots: true,
          },
        },
      },
      orderBy: [
        { sessionDate: 'asc' },
        { startTime: 'asc' },
      ],
    });

    const now = new Date();
    const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

    // Chuẩn hóa dữ liệu ca học trả về cho Calendar
    const formattedSessions = sessions.map((session) => {
      const sDate = new Date(session.sessionDate);
      const sTime = new Date(session.startTime);
      const eTime = new Date(session.endTime);

      const startHours = sTime.getHours();
      const startMinutes = sTime.getMinutes();
      const endHours = eTime.getHours();
      const endMinutes = eTime.getMinutes();

      const startMinutesTotal = startHours * 60 + startMinutes;
      const endMinutesTotal = endHours * 60 + endMinutes;

      const startTimeStr = `${String(startHours).padStart(2, '0')}:${String(startMinutes).padStart(2, '0')}`;
      const endTimeStr = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
      const dateStr = sDate.toISOString().split('T')[0];

      // Xác định trạng thái thời gian thực
      let liveStatus: 'LIVE' | 'UPCOMING' | 'COMPLETED' = 'UPCOMING';

      const isToday =
        sDate.getFullYear() === now.getFullYear() &&
        sDate.getMonth() === now.getMonth() &&
        sDate.getDate() === now.getDate();

      if (session.status === SessionStatus.COMPLETED || (!isToday && sDate < now)) {
        liveStatus = 'COMPLETED';
      } else if (session.status === SessionStatus.LIVE_NOW) {
        liveStatus = 'LIVE';
      } else if (isToday) {
        if (currentTimeMinutes >= startMinutesTotal && currentTimeMinutes <= endMinutesTotal) {
          liveStatus = 'LIVE';
        } else if (currentTimeMinutes > endMinutesTotal) {
          liveStatus = 'COMPLETED';
        } else {
          liveStatus = 'UPCOMING';
        }
      } else if (sDate < now) {
        liveStatus = 'COMPLETED';
      } else {
        liveStatus = 'UPCOMING';
      }

      // Thống kê điểm danh
      let presentCount = 0;
      let lateCount = 0;
      let absentCount = 0;

      session.attendanceLogs.forEach((log) => {
        if (log.status === 'PRESENT') presentCount++;
        else if (log.status === 'LATE') lateCount++;
        else if (log.status === 'ABSENT') absentCount++;
      });

      const totalStudents = session.courseClass._count.enrollments;

      return {
        id: session.id,
        sessionId: session.id,
        sessionNumber: session.sessionNumber,
        sessionDate: dateStr,
        dayOfWeek: sDate.getDay() === 0 ? 8 : sDate.getDay() + 1, // 2: Thứ 2 ... 8: Chủ nhật
        startTime: startTimeStr,
        endTime: endTimeStr,
        startMinutes: startMinutesTotal,
        endMinutes: endMinutesTotal,
        durationMinutes: endMinutesTotal - startMinutesTotal,
        courseId: session.courseClass.course.id,
        courseCode: session.courseClass.course.courseCode,
        courseName: session.courseClass.course.courseName,
        classCode: session.courseClass.classCode,
        totalStudents,
        classroomId: session.classroom?.id,
        roomCode: session.classroom?.roomCode || 'P.---',
        building: session.classroom?.building || '',
        cameraStatus: session.classroom?.cameraStatus || 'OFFLINE',
        cameraRtsp: session.classroom?.rtspUrl,
        liveStatus,
        summary: {
          total: totalStudents,
          present: presentCount,
          late: lateCount,
          absent: absentCount,
          hasProof: session._count.proofSnapshots > 0,
        },
      };
    });

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      totalSessions: formattedSessions.length,
      sessions: formattedSessions,
    };
  }
}

export const teacherService = new TeacherService();
