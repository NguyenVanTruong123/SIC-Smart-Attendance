import { UserRole } from '@prisma/client';
import prisma from '../config/prisma';
import { aiClientService } from './ai-client.service';
import { evidenceService } from './evidence.service';

export class EkycService {
  async enrollInitial(userId: string, frames: Express.Multer.File[]) {
    if (frames.length < 3) {
      const error = new Error('Cần tối thiểu ba ảnh eKYC.');
      (error as Error & { statusCode: number }).statusCode = 422;
      throw error;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== UserRole.STUDENT) {
      const error = new Error('Không tìm thấy sinh viên hợp lệ.');
      (error as Error & { statusCode: number }).statusCode = 404;
      throw error;
    }
    if (user.isFaceEnrolled) {
      const error = new Error('Tài khoản đã đăng ký khuôn mặt. Chỉ admin mới có thể reset.');
      (error as Error & { statusCode: number }).statusCode = 409;
      throw error;
    }

    const enrollment = await aiClientService.enroll(user.userCode, frames);
    const previewFilename = await evidenceService.saveBase64Jpeg(enrollment.preview);
    try {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: user.id }, data: { isFaceEnrolled: true } });
        await tx.userBiometric.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            lastEnrolledAt: new Date(),
            modelVersion: 'facenet-512d',
            embeddingDimension: enrollment.embeddingDimension,
            enrolledFaceUrl: previewFilename,
          },
          update: {
            lastEnrolledAt: new Date(),
            modelVersion: 'facenet-512d',
            embeddingDimension: enrollment.embeddingDimension,
            enrolledFaceUrl: previewFilename,
            enrollmentVersion: { increment: 1 },
          },
        });
      });
    } catch (error) {
      await aiClientService.resetEnrollment(user.userCode).catch(() => undefined);
      throw error;
    }

    return { isFaceEnrolled: true, acceptedFrames: enrollment.acceptedFrames };
  }
}

export const ekycService = new EkycService();
