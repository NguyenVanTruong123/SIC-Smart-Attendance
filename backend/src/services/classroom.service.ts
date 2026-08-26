import prisma from '../config/prisma';
import { CameraStatus, Prisma } from '@prisma/client';

export interface ClassroomFilterParams {
  search?: string;
  building?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface CreateClassroomDto {
  roomCode: string;
  building: string;
  floor?: number;
  capacity?: number;
  cameraIp?: string;
  rtspUrl: string;
  deviceType?: string;
}

export interface UpdateClassroomDto {
  roomCode?: string;
  building?: string;
  floor?: number;
  capacity?: number;
  cameraIp?: string;
  rtspUrl?: string;
  cameraStatus?: CameraStatus;
  deviceType?: string;
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

  /**
   * 2. Thêm mới một phòng học & cấu hình Camera (Modal 1.1.2)
   */
  async createClassroom(dto: CreateClassroomDto) {
    const existing = await prisma.classroom.findUnique({
      where: { roomCode: dto.roomCode.trim() },
    });

    if (existing) {
      const error: any = new Error(`Phòng học với mã "${dto.roomCode}" đã tồn tại trên hệ thống.`);
      error.statusCode = 409;
      error.code = 'ROOM_ALREADY_EXISTS';
      throw error;
    }

    // Tách địa chỉ IP từ rtspUrl nếu không truyền cameraIp riêng
    let cameraIp = dto.cameraIp?.trim();
    if (!cameraIp && dto.rtspUrl) {
      const match = dto.rtspUrl.match(/@?([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/);
      cameraIp = match ? match[1] : '192.168.1.100';
    }

    const newRoom = await prisma.classroom.create({
      data: {
        roomCode: dto.roomCode.trim(),
        building: dto.building.trim(),
        floor: Number(dto.floor) || 1,
        capacity: Number(dto.capacity) || 50,
        cameraIp: cameraIp || '192.168.1.100',
        rtspUrl: dto.rtspUrl.trim(),
        cameraStatus: CameraStatus.ONLINE,
      },
    });

    return newRoom;
  }

  /**
   * 3. Cập nhật cấu hình phòng học & gắn Camera IP mới (Modal 1.1.2)
   */
  async updateClassroom(id: string, dto: UpdateClassroomDto) {
    const existing = await prisma.classroom.findUnique({
      where: { id },
    });

    if (!existing) {
      const error: any = new Error('Không tìm thấy phòng học yêu cầu cập nhật.');
      error.statusCode = 404;
      error.code = 'ROOM_NOT_FOUND';
      throw error;
    }

    // Nếu đổi mã phòng, kiểm tra xem có bị trùng với phòng khác không
    if (dto.roomCode && dto.roomCode.trim() !== existing.roomCode) {
      const duplicate = await prisma.classroom.findUnique({
        where: { roomCode: dto.roomCode.trim() },
      });
      if (duplicate) {
        const error: any = new Error(`Mã phòng "${dto.roomCode}" đã được sử dụng bởi phòng khác.`);
        error.statusCode = 409;
        error.code = 'ROOM_ALREADY_EXISTS';
        throw error;
      }
    }

    let cameraIp = dto.cameraIp?.trim() || existing.cameraIp;
    if (dto.rtspUrl && !dto.cameraIp) {
      const match = dto.rtspUrl.match(/@?([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/);
      if (match) cameraIp = match[1];
    }

    const updatedRoom = await prisma.classroom.update({
      where: { id },
      data: {
        ...(dto.roomCode && { roomCode: dto.roomCode.trim() }),
        ...(dto.building && { building: dto.building.trim() }),
        ...(dto.floor !== undefined && { floor: Number(dto.floor) }),
        ...(dto.capacity !== undefined && { capacity: Number(dto.capacity) }),
        ...(cameraIp && { cameraIp }),
        ...(dto.rtspUrl && { rtspUrl: dto.rtspUrl.trim() }),
        ...(dto.cameraStatus && { cameraStatus: dto.cameraStatus }),
      },
    });

    return updatedRoom;
  }

  /**
   * 4. Xóa phòng học khỏi hệ thống
   */
  async deleteClassroom(id: string) {
    const existing = await prisma.classroom.findUnique({
      where: { id },
    });

    if (!existing) {
      const error: any = new Error('Không tìm thấy phòng học yêu cầu xóa.');
      error.statusCode = 404;
      error.code = 'ROOM_NOT_FOUND';
      throw error;
    }

    await prisma.classroom.delete({
      where: { id },
    });

    return { id, roomCode: existing.roomCode };
  }
}

export const classroomService = new ClassroomService();
