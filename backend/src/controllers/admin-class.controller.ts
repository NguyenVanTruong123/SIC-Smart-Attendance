import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middlewares';
import { adminClassService } from '../services/admin-class.service';

export class AdminClassController {
  /**
   * [GET] /api/v1/admin/classes
   * Lấy danh sách Học phần & Lớp học phân cấp dạng Cây kèm 4 Thẻ KPI
   */
  async getClasses(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { search, semester } = req.query;

      const result = await adminClassService.getClassesOverview({
        search: search as string,
        semester: semester as string,
      });

      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Lấy danh sách học phần và lớp học thành công.',
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      next(error);
    }
  }
}

export const adminClassController = new AdminClassController();
