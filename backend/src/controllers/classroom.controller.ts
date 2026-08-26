import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middlewares';
import { classroomService } from '../services/classroom.service';

export class ClassroomController {
  /**
   * [GET] /api/v1/admin/classrooms
   * Lấy danh sách phòng học, 3 Thẻ KPI và danh sách Tòa nhà (Màn hình 1.1)
   */
  async getClassrooms(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { search, building, status, page, limit } = req.query;

      const result = await classroomService.getClassroomsOverview({
        search: search as string,
        building: building as string,
        status: status as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 10,
      });

      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Lấy danh sách phòng học và KPI thành công.',
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * [POST] /api/v1/admin/classrooms
   * Thêm mới một phòng học & cấu hình Camera IP (Modal 1.1.2)
   */
  async createClassroom(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { roomCode, building, floor, capacity, cameraIp, rtspUrl, deviceType } = req.body;

      if (!roomCode || !building || !rtspUrl) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Vui lòng nhập đầy đủ Tên phòng học, Tòa nhà và RTSP Stream URL.',
          },
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
      }

      const result = await classroomService.createClassroom({
        roomCode,
        building,
        floor,
        capacity,
        cameraIp,
        rtspUrl,
        deviceType,
      });

      return res.status(201).json({
        success: true,
        statusCode: 201,
        message: 'Thêm mới và kích hoạt phòng học thành công.',
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * [PUT] /api/v1/admin/classrooms/:id
   * Cập nhật thông tin phòng học & gắn Camera IP mới (Modal 1.1.2)
   */
  async updateClassroom(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { roomCode, building, floor, capacity, cameraIp, rtspUrl, cameraStatus, deviceType } = req.body;

      const result = await classroomService.updateClassroom(id, {
        roomCode,
        building,
        floor,
        capacity,
        cameraIp,
        rtspUrl,
        cameraStatus,
        deviceType,
      });

      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Cập nhật cấu hình phòng học thành công.',
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * [DELETE] /api/v1/admin/classrooms/:id
   * Xóa một phòng học khỏi hệ thống
   */
  async deleteClassroom(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await classroomService.deleteClassroom(id);

      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: `Đã xóa thành công phòng học ${result.roomCode}.`,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * [POST] /api/v1/admin/classrooms/ping-camera
   * [POST] /api/v1/admin/classrooms/:id/ping-camera
   * Kiểm tra kết nối Camera IP / iVCam (Modal 1.1.2 & 1.1.1)
   */
  async pingCamera(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { rtspUrl, roomId } = req.body;
      const id = req.params?.id || roomId;

      const result = await classroomService.pingCamera({
        rtspUrl,
        roomId: id,
      });

      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Kết nối Camera RTSP thành công!',
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * [GET] /api/v1/admin/classrooms/:id
   * Lấy chi tiết phòng học và danh sách ca học hôm nay (Modal 1.1.1)
   */
  async getClassroomDetail(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await classroomService.getClassroomDetail(id);

      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Lấy chi tiết phòng học và lịch học thành công.',
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      next(error);
    }
  }
}

export const classroomController = new ClassroomController();
