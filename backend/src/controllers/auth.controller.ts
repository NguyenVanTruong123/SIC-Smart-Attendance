import { Request, Response, NextFunction } from 'express';
// -> Lấy 3 kiểu dữ liệu cốt lõi của Express:
//    req: chứa gói tin người dùng gửi lên (body, headers, url).
//    res: công cụ để gửi dữ liệu JSON về lại cho người dùng.
//    next: dùng để chuyển tiếp nếu có middleware.
import { authService } from '../services/auth.service';
import { AuthenticatedRequest } from '../middlewares/auth.middlewares';
import prisma from '../config/prisma';


export class AuthController {


  async getMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      // Tìm thông tin chi tiết người dùng trong Database
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          userCode: true,
          fullName: true,
          email: true,
          role: true,
          department: true,
          className: true,
          avatarUrl: true,
          isFaceEnrolled: true,
          status: true,
          createdAt: true,
        },
      });
      if (!user) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'Không tìm thấy thông tin người dùng.',
          },
          timestamp: new Date().toISOString(),
        });
      }
      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Lấy thông tin tài khoản thành công.',
        data: user,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * [POST] /api/v1/auth/login
   * Xử lý yêu cầu đăng nhập từ phía người dùng / Frontend
   */
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password } = req.body;

      // 1. Kiểm tra nếu thiếu dữ liệu đầu vào
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Vui lòng cung cấp đầy đủ tên đăng nhập và mật khẩu.',
          },
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
      }

      // 2. Gọi tầng Service để xử lý nghiệp vụ xác thực
      const result = await authService.login(username, password);

      // 3. Trả về kết quả thành công HTTP 200 OK theo chuẩn Response Envelope
      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Đăng nhập hệ thống thành công.',
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      // 4. Xử lý khi đăng nhập thất bại (Sai mật khẩu / Tài khoản bị khóa)
      return res.status(401).json({
        success: false,
        statusCode: 401,
        error: {
          code: 'UNAUTHORIZED',
          message: error.message || 'Tài khoản hoặc mật khẩu không chính xác.',
        },
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      });
    }
  }
}

export const authController = new AuthController();
