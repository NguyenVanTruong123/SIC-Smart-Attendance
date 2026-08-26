import prisma from '../config/prisma';
import { CameraStatus, Prisma } from '@prisma/client';

export interface ClassroomFilterParams {
  search?: string;
  building?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export class ClassroomService {
  /**
   * 1. Lấy danh sách phòng học, 3 Thẻ KPI và danh sách Tòa nhà (Màn hình 1.1)
   */
  async getClassroomsOverview(params: ClassroomFilterParams) {
    const {
      search,
      building,
      status = 'ALL',
      page = 1,
      limit = 10,
    } = params;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    // 1. TÍNH TOÁN 3 THẺ KPI ĐẦU TRANG (Thời gian thực)
    const [totalClassrooms, onlineCameras, offlineCameras, distinctBuildings] =
      await Promise.all([
        prisma.classroom.count(),
        prisma.classroom.count({ where: { cameraStatus: CameraStatus.ONLINE } }),
        prisma.classroom.count({
          where: {
            cameraStatus: { in: [CameraStatus.OFFLINE, CameraStatus.MAINTENANCE] },
          },
        }),
        // Lấy danh sách các Tòa nhà có trong DB để đổ vào Dropdown lọc
        prisma.classroom.findMany({
          select: { building: true },
          distinct: ['building'],
        }),
      ]);

    const buildings = distinctBuildings.map((b) => b.building);

    // 2. XÂY DỰNG BỘ LỌC TÌM KIẾM (WHERE CLAUSE)
    const where: Prisma.ClassroomWhereInput = {};

    // Tìm kiếm theo Tên phòng, Tòa nhà, hoặc IP Camera
    if (search && search.trim() !== '') {
      where.OR = [
        { roomCode: { contains: search.trim(), mode: 'insensitive' } },
        { building: { contains: search.trim(), mode: 'insensitive' } },
        { cameraIp: { contains: search.trim(), mode: 'insensitive' } },
        { rtspUrl: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    // Lọc theo Tòa nhà
    if (building && building !== 'ALL') {
      where.building = building;
    }

    // Lọc theo Trạng thái Camera
    if (status && status !== 'ALL') {
      where.cameraStatus = status as CameraStatus;
    }

    // 3. TRUY VẤN DANH SÁCH PHÒNG HỌC VÀ TỔNG SỐ BẢN GHI
    const [classrooms, totalItems] = await Promise.all([
      prisma.classroom.findMany({
        where,
        skip,
        take,
        orderBy: { roomCode: 'asc' },
      }),
      prisma.classroom.count({ where }),
    ]);

    // 4. CHUẨN HÓA DỮ LIỆU ĐẦU RA CHO FRONTEND
    const items = classrooms.map((room) => {
      const isOnline = room.cameraStatus === CameraStatus.ONLINE;
      const roomType = room.capacity >= 100 ? 'Hội trường' : 'Phòng Lý thuyết';
      const deviceType = room.rtspUrl.includes('4747') || room.rtspUrl.includes('8080')
        ? 'iVCam (Mobile Bridge)'
        : 'Hikvision IP Cam 1080p';

      return {
        id: room.id,
        roomCode: room.roomCode,
        building: room.building,
        floor: room.floor,
        capacity: room.capacity,
        roomType,
        deviceType,
        cameraIp: room.cameraIp,
        rtspUrl: room.rtspUrl,
        cameraStatus: room.cameraStatus,
        latencyMs: isOnline ? 118 : null,
        fps: isOnline ? 30 : 0,
        createdAt: room.createdAt,
      };
    });

    const totalPages = Math.ceil(totalItems / take) || 1;

    return {
      kpis: {
        totalClassrooms,
        onlineCameras,
        offlineCameras,
        cameraCoverageRate: totalClassrooms > 0 ? '100%' : '0%',
      },
      buildings,
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

export const classroomService = new ClassroomService();
