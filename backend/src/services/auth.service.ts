import bcrypt from 'bcrypt';
import { UserRole, UserStatus } from '@prisma/client';
import prisma from '../config/prisma';
import { generateTokens, verifyRefreshToken } from '../utils/jwt';

export class AuthService {
  /**
   * Xử lý nghiệp vụ Đăng nhập hệ thống SPAS
   */
  async login(username: string, password: string) {
    // 1. Kiểm tra đầu vào cơ bản
    if (!username || !password) {
      throw new Error('Vui lòng nhập đầy đủ tài khoản và mật khẩu.');
    }

    // 2. Tìm người dùng theo Email HOẶC Mã định danh (userCode: MSSV / Mã GV)
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: username.trim().toLowerCase() },
          { userCode: username.trim() },
        ],
      },
    });
    // kiểm tra người dùng tồn tại không
    if (!user) {
      throw new Error('Tài khoản hoặc mật khẩu không chính xác.');
    }

    // 3. Kiểm tra trạng thái tài khoản
    if (user.status !== UserStatus.ACTIVE) {
      throw new Error('Tài khoản của bạn đã bị khóa hoặc chưa kích hoạt. Vui lòng liên hệ Phòng Đào Tạo.');
    }

    // 4. So khớp mật khẩu người dùng gõ với mật khẩu băm trong CSDL
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Tài khoản hoặc mật khẩu không chính xác.');
    }

    // 5. Tự động xác định đường dẫn điều hướng (redirectUrl) theo Vai trò
    let redirectUrl = '/student/dashboard';

    if (user.role === UserRole.ADMIN) {
      redirectUrl = '/admin/classrooms';
    } else if (user.role === UserRole.TEACHER) {
      redirectUrl = '/teacher/schedule';
    } else if (user.role === UserRole.STUDENT) {
      // Nếu sinh viên chưa hoàn thành eKYC -> Bắt buộc vào màn hình quay video xác thực
      redirectUrl = user.isFaceEnrolled
        ? '/student/dashboard'
        : '/student/onboarding-ekyc';
    }

    // 6. Sinh bộ đôi Access Token (15m) & Refresh Token (7d)
    const { accessToken, refreshToken } = generateTokens({
      userId: user.id,
      userCode: user.userCode,
      role: user.role,
      isFaceEnrolled: user.isFaceEnrolled,
    });

    // 7. Trả về kết quả hoàn chỉnh (Không bao gồm trường passwordHash để bảo mật)
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        userCode: user.userCode,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        department: user.department,
        className: user.className,
        avatarUrl: user.avatarUrl,
        isFaceEnrolled: user.isFaceEnrolled,
      },
      redirectUrl,
    };
  }

  /**
   * Tự động cấp lại Access Token mới từ Refresh Token hợp lệ
   */
  async refreshToken(refreshTokenString: string) {
    if (!refreshTokenString) {
      throw new Error('Vui lòng cung cấp Refresh Token.');
    }

    // 1. Giải mã và kiểm tra chữ ký của Refresh Token
    const decoded = verifyRefreshToken(refreshTokenString);

    // 2. Tìm người dùng trong cơ sở dữ liệu
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new Error('Tài khoản không hợp lệ hoặc đã bị khóa.');
    }

    // 3. Tạo bộ đôi Token mới
    const tokens = generateTokens({
      userId: user.id,
      userCode: user.userCode,
      role: user.role,
      isFaceEnrolled: user.isFaceEnrolled,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }
}

export const authService = new AuthService();
