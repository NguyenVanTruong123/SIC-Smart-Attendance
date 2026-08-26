import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middlewares';
import { classroomService } from '../services/classroom.service';

export class ClassroomController {
  /**
   * [GET] /api/v1/admin/classrooms
   * Lấy danh sách phòng học, 3 Thẻ KPI và danh sách Tòa nhà (Màn hình 1.1)
   */
  async getClassrooms(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { search, building, status, page, limit } = req.query;

      const result = await classroomService.getClassroomsOverview({
        search: search as string,
        building: building as string,
        status: status as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 10,
      });

      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Lấy danh sách phòng học và KPI thành công.',
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      next(error);
    }
  }
}

export const classroomController = new ClassroomController();
