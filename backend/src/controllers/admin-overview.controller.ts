import { Request, Response, NextFunction } from 'express';
import { adminOverviewService } from '../services/admin-overview.service';

export class AdminOverviewController {
  /**
   * [GET] /api/v1/admin/overview
   * Lấy toàn bộ số liệu thời gian thực từ Database cho Dashboard Quản Trị
   */
  async getOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminOverviewService.getSystemOverview();

      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Lấy dữ liệu thông số hệ thống thành công.',
        data,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      next(error);
    }
  }
}

export const adminOverviewController = new AdminOverviewController();
