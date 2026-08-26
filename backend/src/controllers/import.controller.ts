import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middlewares';
import { importService } from '../services/import.service';

export class ImportController {
  /**
   * [POST] /api/v1/admin/import/excel-bundle
   * Nhận upload 3 file Excel: student_file, teacher_file, schedule_file
   */
  async importBundle(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

      if (!files || Object.keys(files).length === 0) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Vui lòng chọn ít nhất một file Excel (.xlsx) để tải lên.',
          },
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        });
      }

      const studentFile = files['student_file']?.[0]?.buffer;
      const teacherFile = files['teacher_file']?.[0]?.buffer;
      const scheduleFile = files['schedule_file']?.[0]?.buffer;

      // Gọi tầng Service xử lý bóc tách và lưu vào Database
      const result = await importService.importBundle({
        studentFile,
        teacherFile,
        scheduleFile,
      });

      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Nạp dữ liệu từ file Excel thành công.',
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      next(error);
    }
  }
}

export const importController = new ImportController();
