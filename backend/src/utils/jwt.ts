import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';

// Cấu trúc dữ liệu chứa bên trong mã Token JWT
export interface JwtPayload {
  userId: string;
  userCode: string;
  role: UserRole;
  isFaceEnrolled: boolean;
}

// 1. Hàm tạo bộ đôi Access Token & Refresh Token
export const generateTokens = (payload: JwtPayload) => {
  const accessSecret = process.env.JWT_ACCESS_SECRET || 'spas_access_secret_2026';
  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'spas_refresh_secret_2026';
  const accessExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
  const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

  const accessToken = jwt.sign(payload, accessSecret, {
    expiresIn: accessExpiresIn as any,
  });

  const refreshToken = jwt.sign(payload, refreshSecret, {
    expiresIn: refreshExpiresIn as any,
  });

  return { accessToken, refreshToken };
};

// 2. Hàm giải mã và kiểm tra chữ ký Token
export const verifyAccessToken = (token: string): JwtPayload => {
  const secret = process.env.JWT_ACCESS_SECRET || 'spas_access_secret_2026';
  return jwt.verify(token, secret) as JwtPayload;
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  const secret = process.env.JWT_REFRESH_SECRET || 'spas_refresh_secret_2026';
  return jwt.verify(token, secret) as JwtPayload;
};












