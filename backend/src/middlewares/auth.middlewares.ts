import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { verifyAccessToken, JwtPayload } from '../utils/jwt';

// Mở rộng kiểu dữ liệu Request của Express để chứa thông tin req.user
export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}


//Middleware 1: Xác thực tính hợp lệ của Token JWT (Authentication)
export const verifyToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    // 1. Kiểm tra xem có gửi kèm Header Authorization dạng "Bearer <token>" không
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Không tìm thấy Token xác thực. Vui lòng đăng nhập lại.',
        },
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      });
    }

    // 2. Tách lấy chuỗi token sau chữ "Bearer "
    const token = authHeader.split(' ')[1];

    // 3. Giải mã và kiểm tra chữ ký token
    const decoded = verifyAccessToken(token);

    // 4. Gắn thông tin người dùng vào req.user để các controller/middleware phía sau dùng
    req.user = decoded;

    return next();
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      statusCode: 401,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Token xác thực không hợp lệ hoặc đã hết hạn.',
      },
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    });
  }
};

/**
 * Middleware 2: Phân quyền theo Vai trò (Role-Based Access Control - RBAC)
 * @param allowedRoles Danh sách các vai trò được phép truy cập (ADMIN, TEACHER, STUDENT)
 */
export const authorizeRoles = (...allowedRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Chưa xác thực danh tính người dùng.',
        },
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      });
    }

    // Kiểm tra quyền của người dùng hiện tại có nằm trong danh sách cho phép không
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        error: {
          code: 'FORBIDDEN',
          message: 'Bạn không có quyền truy cập vào tài nguyên này.',
        },
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      });
    }

    return next();
  };
};




// Middleware 3: Khóa eKYC - Bắt buộc Sinh viên phải hoàn tất xác thực khuôn mặt lần đấu
export const requireFaceEnrolled = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  // Chỉ áp dụng khóa đối với Sinh viên (Admin và Giảng viên không bị chặn)
  if (req.user?.role === UserRole.STUDENT && !req.user.isFaceEnrolled) {
    return res.status(403).json({
      success: false,
      statusCode: 403,
      error: {
        code: 'FACE_NOT_ENROLLED',
        message: 'Bạn chưa hoàn tất xác thực khuôn mặt lần đầu. Vui lòng hoàn thành eKYC để tiếp tục.',
      },
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    });
  }

  return next();
};
