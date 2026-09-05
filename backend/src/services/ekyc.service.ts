import { UserRole } from '@prisma/client';
import prisma from '../config/prisma';
import { aiClientService } from './ai-client.service';
import { evidenceService } from './evidence.service';

function inferPose(filename: string) {
  const normalized = filename.toLowerCase();
  if (normalized.includes('left')) return 'left';
  if (normalized.includes('right')) return 'right';
  if (normalized.includes('front')) return 'front';
  return null;
}

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
    const savedImages: Array<{ imageUrl: string; mimeType: string; imageIndex: number; pose: string | null }> = [];

    try {
      for (const [index, frame] of frames.entries()) {
        const extension = frame.mimetype === 'image/png' ? 'png' : 'jpg';
        const imageUrl = await evidenceService.saveBuffer(frame.buffer, extension);
        savedImages.push({
          imageUrl,
          mimeType: frame.mimetype,
          imageIndex: index + 1,
          pose: inferPose(frame.originalname),
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: user.id }, data: { isFaceEnrolled: true } });
        await tx.userBiometric.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            lastEnrolledAt: new Date(),
            modelVersion: 'facenet-512d',
            embeddingDimension: enrollment.embeddingDimension,
            enrolledFaceUrl: savedImages[0]?.imageUrl || null,
          },
          update: {
            lastEnrolledAt: new Date(),
            modelVersion: 'facenet-512d',
            embeddingDimension: enrollment.embeddingDimension,
            enrolledFaceUrl: savedImages[0]?.imageUrl || null,
            enrollmentVersion: { increment: 1 },
          },
        });
        await tx.userEnrollmentImage.deleteMany({ where: { userId: user.id } });
        await tx.userEnrollmentImage.createMany({
          data: savedImages.map((image) => ({
            userId: user.id,
            imageIndex: image.imageIndex,
            imageUrl: image.imageUrl,
            mimeType: image.mimeType,
            pose: image.pose,
          })),
        });
      });
    } catch (error) {
      await Promise.all(savedImages.map((image) => evidenceService.delete(image.imageUrl)));
      await aiClientService.resetEnrollment(user.userCode).catch(() => undefined);
      throw error;
    }

    return {
      isFaceEnrolled: true,
      acceptedFrames: enrollment.acceptedFrames,
      savedOriginalFrames: savedImages.length,
    };
  }
}

export const ekycService = new EkycService();
