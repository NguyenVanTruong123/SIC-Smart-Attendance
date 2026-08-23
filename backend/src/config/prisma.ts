import { PrismaClient } from '@prisma/client';

// Khởi tạo biến toàn cục để tránh tạo lại kết nối khi server tự reload trong môi trường dev
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    // Trong môi trường development, in ra các câu lệnh SQL để bạn dễ theo dõi
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
