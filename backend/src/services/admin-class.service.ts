import prisma from '../config/prisma';
import { periodLabel } from '../utils/study-periods';

export interface AdminClassesFilter {
  search?: string;
  semester?: string;
}

export class AdminClassService {
  async getClassesOverview(filter: AdminClassesFilter) {
    const { search, semester } = filter;

    // 1. Lấy tất cả các khóa học & lớp học phần
    const courses = await prisma.course.findMany({
      where: search
        ? {
            OR: [
              { courseCode: { contains: search, mode: 'insensitive' } },
              { courseName: { contains: search, mode: 'insensitive' } },
              {
                courseClasses: {
                  some: {
                    OR: [
                      { classCode: { contains: search, mode: 'insensitive' } },
                      { teacher: { fullName: { contains: search, mode: 'insensitive' } } },
                    ],
                  },
                },
              },
            ],
          }
        : undefined,
      include: {
        courseClasses: {
          where: semester && semester !== 'ALL' ? { semester } : undefined,
          include: {
            teacher: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
              },
            },
            _count: {
              select: {
                enrollments: true,
                sessions: true,
              },
            },
            sessions: {
              include: {
                classroom: true,
                attendanceLogs: { select: { status: true } },
                _count: {
                  select: {
                    attendanceLogs: true,
                  },
                },
              },
              orderBy: [
                { sessionDate: 'asc' },
                { startTime: 'asc' },
              ],
            },
          },
        },
      },
      orderBy: { courseCode: 'asc' },
    });

    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeMinutes = currentHours * 60 + currentMinutes;

    let totalCoursesCount = courses.length;
    let totalClassesCount = 0;
    let totalEnrollmentsCount = 0;
    let liveClassesCount = 0;

    const semestersSet = new Set<string>();

    const treeData = courses.map((course) => {
      let courseTotalStudents = 0;

      const children = course.courseClasses.map((cClass) => {
        totalClassesCount++;
        const studentCount = cClass._count.enrollments;
        courseTotalStudents += studentCount;
        totalEnrollmentsCount += studentCount;

        if (cClass.semester) semestersSet.add(cClass.semester);

        // Phân tích lịch học & phòng học từ sessions
        const firstSession = cClass.sessions[0];
        const classroom = firstSession?.classroom;
        const scheduleSlots = Array.from(new Map(cClass.sessions.map((session) => {
          const sessionDate = new Date(session.sessionDate);
          const startTime = new Date(session.startTime);
          const endTime = new Date(session.endTime);
          const startText = `${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`;
          const endText = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`;
          const roomCode = session.classroom?.roomCode || '';
          const key = `${sessionDate.getDay()}|${startText}|${endText}|${roomCode}`;
          return [key, {
            dayOfWeek: sessionDate.getDay(),
            dayName: ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'][sessionDate.getDay()],
            startTime: startText,
            endTime: endText,
            periodStart: session.periodStart,
            periodEnd: session.periodEnd,
            periodLabel: periodLabel(session.periodStart, session.periodEnd),
            roomCode,
          } as const];
        }))).map(([, value]) => value);
        const allScheduleText = scheduleSlots.length
          ? scheduleSlots.map((slot) => `${slot.dayName} (${slot.periodLabel || `${slot.startTime} - ${slot.endTime}`}${slot.roomCode ? ` · ${slot.roomCode}` : ''})`).join('; ')
          : 'Chưa xếp lịch';

        // Ngày trong tuần và giờ
        let scheduleText = 'Chưa xếp lịch';
        if (firstSession) {
          const sDate = new Date(firstSession.sessionDate);
          const dayNames = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
          const dayOfWeek = dayNames[sDate.getDay()];

          const sTime = new Date(firstSession.startTime);
          const eTime = new Date(firstSession.endTime);
          const sStr = `${String(sTime.getHours()).padStart(2, '0')}:${String(sTime.getMinutes()).padStart(2, '0')}`;
          const eStr = `${String(eTime.getHours()).padStart(2, '0')}:${String(eTime.getMinutes()).padStart(2, '0')}`;
          scheduleText = `${dayOfWeek} (${sStr} - ${eStr})`;
        }
        scheduleText = allScheduleText;

        // Tình trạng camera
        const cameraStatus = classroom?.cameraStatus || 'OFFLINE';
        const cameraFps = classroom?.fps || 30;
        const cameraLatency = classroom?.latencyMs || 0;

        // Tiến độ buổi học
        const totalSessions = course.totalSessions || 15;
        const completedSessions = cClass.sessions.filter(
          (s) => s.status === 'COMPLETED'
        ).length;

        // Tỉ lệ chuyên cần trung bình
        const attendanceLogs = cClass.sessions.flatMap((session) => session.attendanceLogs);
        const attendanceRate = attendanceLogs.length > 0
          ? Number(((attendanceLogs.filter((log) => ['PRESENT', 'LATE', 'EXCUSED'].includes(log.status)).length / attendanceLogs.length) * 100).toFixed(1))
          : 0;

        // Trạng thái hôm nay
        let todayStatus: 'LIVE' | 'UPCOMING' | 'IDLE' = 'IDLE';
        const todaySession = cClass.sessions.find((s) => {
          const sDate = new Date(s.sessionDate);
          return (
            sDate.getFullYear() === now.getFullYear() &&
            sDate.getMonth() === now.getMonth() &&
            sDate.getDate() === now.getDate()
          );
        });

        if (todaySession) {
          const sTime = new Date(todaySession.startTime);
          const eTime = new Date(todaySession.endTime);
          const sMinutes = sTime.getHours() * 60 + sTime.getMinutes();
          const eMinutes = eTime.getHours() * 60 + eTime.getMinutes();

          if (currentTimeMinutes >= sMinutes && currentTimeMinutes <= eMinutes) {
            todayStatus = 'LIVE';
            liveClassesCount++;
          } else if (currentTimeMinutes < sMinutes) {
            todayStatus = 'UPCOMING';
          }
        }

        return {
          id: cClass.id,
          key: cClass.id,
          isCourse: false,
          courseCode: course.courseCode,
          courseName: course.courseName,
          classCode: cClass.classCode,
          teacherName: cClass.teacher?.fullName || 'Chưa phân công',
          teacherEmail: cClass.teacher?.email,
          totalStudents: studentCount,
          schedule: scheduleText,
          scheduleSlots,
          classroom: classroom
            ? `P.${classroom.roomCode} (${classroom.building})`
            : 'Chưa xếp phòng',
          cameraStatus,
          cameraFps,
          cameraLatency,
          completedSessions,
          totalSessions,
          attendanceRate,
          todayStatus,
          semester: cClass.semester,
        };
      });

      return {
        id: course.id,
        key: course.id,
        isCourse: true,
        courseCode: course.courseCode,
        courseName: course.courseName,
        credits: course.credits,
        totalClasses: course.courseClasses.length,
        totalStudents: courseTotalStudents,
        totalSessions: course.totalSessions || 15,
        children: children.length > 0 ? children : undefined,
      };
    });

    return {
      kpis: {
        totalCourses: totalCoursesCount,
        totalClasses: totalClassesCount,
        totalEnrollments: totalEnrollmentsCount,
        liveClasses: liveClassesCount,
      },
      semesters: Array.from(semestersSet),
      items: treeData,
    };
  }
}

export const adminClassService = new AdminClassService();
