import { Router } from 'express';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest, verifyToken } from '../middlewares/auth.middlewares';

const router = Router();

router.use(verifyToken);

router.get('/sections', async (_req, res, next) => {
  try {
    const classes = await prisma.courseClass.findMany({
      include: { course: true, teacher: true, sessions: { include: { classroom: true }, orderBy: { sessionDate: 'asc' }, take: 1 } },
    });
    res.json({
      success: true,
      data: {
        sections: classes.map((item) => {
          const session = item.sessions[0];
          return {
            id: item.id,
            course_code: item.course.courseCode,
            title: item.course.courseName,
            room: session?.classroom.roomCode || '',
            weekday: session ? session.sessionDate.getDay() || 7 : 1,
            period: session?.sessionNumber || 1,
            start_time: session?.startTime.toISOString().slice(11, 16) || '',
            end_time: session?.endTime.toISOString().slice(11, 16) || '',
            teacher_id: item.teacher.userCode,
          };
        }),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/attendance/me', async (req: AuthenticatedRequest, res, next) => {
  try {
    const logs = await prisma.attendanceLog.findMany({
      where: { studentId: req.user!.userId },
      include: { session: { include: { courseClass: { include: { course: true } }, classroom: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      success: true,
      data: {
        attendance: logs.map((log) => ({
          date: log.session.sessionDate.toISOString(),
          status: log.status.toLowerCase(),
          course_code: log.session.courseClass.course.courseCode,
          title: log.session.courseClass.course.courseName,
          room: log.session.classroom.roomCode,
          period: log.session.sessionNumber,
          startTime: log.session.startTime.toISOString(),
          endTime: log.session.endTime.toISOString(),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/profile', async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { biometricProfile: { select: { lastEnrolledAt: true } } },
    });
    if (!user) return res.status(404).json({ success: false, error: { message: 'Không tìm thấy tài khoản.' } });
    res.json({
      success: true,
      data: {
        user: {
          id: user.userCode,
          fullName: user.fullName,
          role: user.role.toLowerCase(),
          enrolledAt: user.biometricProfile?.lastEnrolledAt?.toISOString(),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
