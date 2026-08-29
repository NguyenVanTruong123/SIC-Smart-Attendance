import prisma from '../config/prisma';
import { UserRole, RequestStatus, Prisma } from '@prisma/client';
import { aiClientService } from './ai-client.service';
import { evidenceService } from './evidence.service';

export interface BiometricsFilterParams {
  role?: UserRole;
  search?: string;
  department?: string;
  status?: 'ALL' | 'ENROLLED' | 'NOT_ENROLLED' | 'PENDING_RESET';
  page?: number;
  limit?: number;
}

export class BiometricService {
  async getBiometricDetail(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        biometricProfile: true,
        enrollments: { include: { courseClass: { include: { course: true } } } },
      },
    });
    if (!user) throw Object.assign(new Error('Không tìm thấy người dùng.'), { statusCode: 404 });
    const preview = user.biometricProfile?.enrolledFaceUrl
      ? await evidenceService.read(user.biometricProfile.enrolledFaceUrl).then((buffer) => buffer.toString('base64')).catch(() => null)
      : null;
    return {
      user: {
        userCode: user.userCode,
        fullName: user.fullName,
        role: user.role,
        department: user.department,
        className: user.className,
        vectorId: user.biometricProfile?.faissVectorId ? Number(user.biometricProfile.faissVectorId) : 0,
        masterImageUrl: user.biometricProfile?.enrolledFaceUrl || '',
        previewBase64: preview ? `data:image/jpeg;base64,${preview}` : null,
        aiModel: user.biometricProfile?.modelVersion || 'facenet-512d',
        matchScore: user.biometricProfile?.matchConfidence ? Number(user.biometricProfile.matchConfidence) : null,
      },
      recentCctvSnapshots: [],
      id: user.id,
      userCode: user.userCode,
      fullName: user.fullName,
      role: user.role,
      department: user.department,
      className: user.className,
      isFaceEnrolled: user.isFaceEnrolled,
      biometric: user.biometricProfile ? {
        modelVersion: user.biometricProfile.modelVersion,
        embeddingDimension: user.biometricProfile.embeddingDimension,
        enrollmentVersion: user.biometricProfile.enrollmentVersion,
        enrolledAt: user.biometricProfile.lastEnrolledAt,
        previewUrl: user.biometricProfile.enrolledFaceUrl,
        previewBase64: preview ? `data:image/jpeg;base64,${preview}` : null,
      } : null,
      courseClasses: user.enrollments.map((enrollment) => ({
        id: enrollment.courseClass.id,
        courseCode: enrollment.courseClass.course.courseCode,
        courseName: enrollment.courseClass.course.courseName,
      })),
    };
  }

  async readPreview(userId: string) {
    const profile = await prisma.userBiometric.findUnique({ where: { userId } });
    if (!profile?.enrolledFaceUrl) throw Object.assign(new Error('Sinh viên chưa có ảnh enrollment.'), { statusCode: 404 });
    return evidenceService.read(profile.enrolledFaceUrl);
  }

  async resetBiometric(userId: string, actorId: string, reason: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw Object.assign(new Error('Không tìm thấy người dùng.'), { statusCode: 404 });
    if (user.isFaceEnrolled) await aiClientService.resetEnrollment(user.userCode);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { isFaceEnrolled: false, avatarUrl: null } });
      await tx.userBiometric.updateMany({
        where: { userId: user.id },
        data: { faissVectorId: null, enrolledFaceUrl: null, lastEnrolledAt: null, matchConfidence: null },
      });
      await tx.systemAuditLog.create({
        data: {
          actorId,
          actionType: 'EKYC_RESET',
          targetTable: 'users',
          targetId: user.id,
          beforeState: { isFaceEnrolled: user.isFaceEnrolled },
          afterState: { isFaceEnrolled: false },
          description: reason,
        },
      });
    });
    return { userId: user.id, isFaceEnrolled: false };
  }

  /**
   * Lấy danh sách hồ sơ sinh trắc học và tính toán 4 Thẻ KPI thời gian thực
   */
  async getBiometricsOverview(params: BiometricsFilterParams) {
    const {
      role = UserRole.STUDENT,
      search,
      department,
      status = 'ALL',
      page = 1,
      limit = 10,
    } = params;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    // 1. TÍNH TOÁN 4 THẺ KPI ĐẦU TRANG (Thời gian thực)
    const [
      totalStudents,
      enrolledStudents,
      notEnrolledStudents,
      pendingResetRequests,
      totalTeachers,
    ] = await Promise.all([
      // Tổng số sinh viên
      prisma.user.count({ where: { role: UserRole.STUDENT } }),
      // Sinh viên đã nạp Vector khuôn mặt
      prisma.user.count({ where: { role: UserRole.STUDENT, isFaceEnrolled: true } }),
      // Sinh viên chưa hoàn thành eKYC
      prisma.user.count({ where: { role: UserRole.STUDENT, isFaceEnrolled: false } }),
      // Số đơn yêu cầu Reset eKYC đang chờ duyệt
      prisma.biometricUpdateRequest.count({ where: { status: RequestStatus.PENDING } }),
      // Tổng số giảng viên
      prisma.user.count({ where: { role: UserRole.TEACHER } }),
    ]);

    const enrolledRate =
      totalStudents > 0
        ? ((enrolledStudents / totalStudents) * 100).toFixed(1) + '%'
        : '0.0%';

    // 2. XÂY DỰNG BỘ LỌC DANH SÁCH (WHERE CLAUSE)
    const where: Prisma.UserWhereInput = {
      role,
    };

    // Tìm kiếm theo MSSV hoặc Họ tên
    if (search && search.trim() !== '') {
      where.OR = [
        { userCode: { contains: search.trim(), mode: 'insensitive' } },
        { fullName: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    // Lọc theo Khoa
    if (department && department !== 'ALL') {
      where.department = department;
    }

    // Lọc theo Trạng thái eKYC
    if (status === 'ENROLLED') {
      where.isFaceEnrolled = true;
    } else if (status === 'NOT_ENROLLED') {
      where.isFaceEnrolled = false;
    } else if (status === 'PENDING_RESET') {
      where.biometricRequests = {
        some: { status: RequestStatus.PENDING },
      };
    }

    // 3. TRUY VẤN DANH SÁCH USER VÀ TỔNG SỐ BẢN GHI
    const [users, totalItems] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userCode: true,
          fullName: true,
          role: true,
          className: true,
          department: true,
          email: true,
          phone: true,
          avatarUrl: true,
          isFaceEnrolled: true,
          createdAt: true,
          biometricProfile: {
            select: {
              faissVectorId: true,
              enrolledFaceUrl: true,
              lastEnrolledAt: true,
              matchConfidence: true,
            },
          },
          biometricRequests: {
            where: { status: RequestStatus.PENDING },
            select: { id: true, requestCode: true, createdAt: true },
            take: 1,
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    // 4. CHUẨN HÓA DỮ LIỆU TRẢ VỀ CHO FRONTEND
    const items = users.map((user) => {
      const hasPendingResetRequest = user.biometricRequests.length > 0;
      const pendingRequest = user.biometricRequests[0] || null;

      return {
        id: user.id,
        userCode: user.userCode,
        fullName: user.fullName,
        role: user.role,
        className: user.className,
        department: user.department,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl || user.biometricProfile?.enrolledFaceUrl || null,
        isFaceEnrolled: user.isFaceEnrolled,
        vectorId: user.biometricProfile?.faissVectorId
          ? `#V-${user.biometricProfile.faissVectorId}`
          : null,
        enrolledDate: user.biometricProfile?.lastEnrolledAt
          ? user.biometricProfile.lastEnrolledAt.toISOString().split('T')[0]
          : null,
        hasPendingResetRequest,
        pendingRequestId: pendingRequest ? pendingRequest.id : null,
      };
    });

    const totalPages = Math.ceil(totalItems / take) || 1;

    return {
      kpis: {
        totalStudents,
        enrolledCount: enrolledStudents,
        enrolledRate,
        notEnrolledCount: notEnrolledStudents,
        pendingResetRequests,
      },
      tabCounts: {
        students: totalStudents,
        teachers: totalTeachers,
      },
      items,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        totalItems,
        totalPages,
      },
    };
  }
}

export const biometricService = new BiometricService();
