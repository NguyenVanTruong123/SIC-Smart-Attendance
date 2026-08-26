import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middlewares';
import { biometricService } from '../services/biometric.service';
import { UserRole } from '@prisma/client';

export class BiometricController {
  /**
   * [GET] /api/v1/admin/biometrics
   * Lấy danh sách hồ sơ sinh trắc học và 4 Thẻ KPI thống kê
   */
  async getBiometrics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { role, search, department, status, page, limit } = req.query;

      const result = await biometricService.getBiometricsOverview({
        role: role as UserRole,
        search: search as string,
        department: department as string,
        status: status as any,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 10,
      });

      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Lấy danh sách sinh trắc học và KPI thành công.',
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      next(error);
    }
  }
}

export const biometricController = new BiometricController();
