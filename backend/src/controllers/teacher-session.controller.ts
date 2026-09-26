import { NextFunction, Response } from 'express';
import { AttendanceStatus } from '@prisma/client';
import { AuthenticatedRequest } from '../middlewares/auth.middlewares';
import { isCaptureMode, teacherSessionService } from '../services/teacher-session.service';

export class TeacherSessionController {
  async get(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { return res.json({ success: true, data: await teacherSessionService.getDetail(req.params.id, req.user!.userId, req.user!.role) }); } catch (error) { next(error); }
  }
  async start(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { return res.json({ success: true, data: await teacherSessionService.start(req.params.id, req.user!.userId, req.user!.role) }); } catch (error) { next(error); }
  }
  async capture(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const mode = isCaptureMode(req.body?.mode) ? req.body.mode : 'CHECKPOINT';
      const data = req.file
        ? await teacherSessionService.captureImage(req.params.id, req.user!.userId, req.user!.role, req.file, mode)
        : await teacherSessionService.capture(req.params.id, req.user!.userId, req.user!.role, mode);
      return res.json({ success: true, data });
    } catch (error) { next(error); }
  }
  async resolve(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      return res.json({ success: true, data: await teacherSessionService.resolveByCourseCode(String(req.query.courseCode || ''), req.user!.userId, req.user!.role) });
    } catch (error) { next(error); }
  }
  async override(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { newStatus, reason } = req.body;
      if (!Object.values(AttendanceStatus).includes(newStatus) || !reason?.trim()) throw Object.assign(new Error('newStatus và reason là bắt buộc.'), { statusCode: 422 });
      return res.json({ success: true, data: await teacherSessionService.override(req.params.id, req.params.studentId, req.user!.userId, req.user!.role, newStatus, reason.trim()) });
    } catch (error) { next(error); }
  }
  async end(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { return res.json({ success: true, data: await teacherSessionService.end(req.params.id, req.user!.userId, req.user!.role, Boolean(req.body?.confirmEarly)) }); } catch (error) { next(error); }
  }
  async evidence(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const image = await teacherSessionService.readEvidence(req.params.id, req.params.evidenceId, req.user!.userId, req.user!.role);
      res.type('jpg').send(image);
    } catch (error) { next(error); }
  }
}

export const teacherSessionController = new TeacherSessionController();
