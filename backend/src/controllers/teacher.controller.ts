import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middlewares';
import { teacherService } from '../services/teacher.service';

export class TeacherController {
  /**
   * [GET] /api/v1/teacher/schedule
   * Lấy lịch dạy trong tuần cho Giảng viên
   */
  async getSchedule(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const teacherId = req.user?.userId;

      if (!teacherId) {
        return res.status(401).json({
          success: false,
          statusCode: 401,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Không tìm thấy thông tin giảng viên.',
          },
          timestamp: new Date().toISOString(),
        });
      }

      const { startDate, endDate, week, year } = req.query;

      let start: Date;
      let end: Date;

      if (startDate && endDate) {
        start = new Date(startDate as string);
        start.setHours(0, 0, 0, 0);
        end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
      } else {
        // Mặc định tính khoảng 7 ngày của tuần hiện tại (Thứ 2 đến Chủ nhật)
        const now = new Date();
        const currentDay = now.getDay(); // 0 là CN, 1 là T2...
        const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;

        start = new Date(now);
        start.setDate(now.getDate() + distanceToMonday);
        start.setHours(0, 0, 0, 0);

        end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
      }

      const result = await teacherService.getTeacherSchedule({
        teacherId,
        startDate: start,
        endDate: end,
      });

      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Lấy lịch giảng dạy thành công.',
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      next(error);
    }
  }
}

export const teacherController = new TeacherController();
