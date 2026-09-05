import { NextFunction, Response } from 'express';
import { LeaveRequestType } from '@prisma/client';
import { AuthenticatedRequest } from '../middlewares/auth.middlewares';
import { studentService } from '../services/student.service';

export class StudentController {
  async dashboard(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const weekStart = typeof req.query.weekStart === 'string' ? req.query.weekStart : undefined;
      return res.json({ success: true, data: await studentService.dashboard(req.user!.userId, weekStart) });
    } catch (error) { next(error); }
  }

  async attendanceHistory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { return res.json({ success: true, data: await studentService.attendanceHistory(req.user!.userId, typeof req.query.search === 'string' ? req.query.search : undefined) }); } catch (error) { next(error); }
  }
  async listLeaveRequests(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { return res.json({ success: true, data: await studentService.listLeaveRequests(req.user!.userId) }); } catch (error) { next(error); }
  }
  async createLeaveRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const sessionId = req.body.sessionId || req.body.session_id;
      const requestType = req.body.requestType || req.body.request_type;
      const reason = req.body.reason;
      if (!sessionId || !Object.values(LeaveRequestType).includes(requestType) || !reason?.trim()) throw Object.assign(new Error('sessionId, requestType và reason là bắt buộc.'), { statusCode: 422 });
      return res.status(201).json({ success: true, data: await studentService.createLeaveRequest(req.user!.userId, sessionId, requestType, reason.trim(), req.file) });
    } catch (error) { next(error); }
  }
  async evidence(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const image = await studentService.readEvidence(req.user!.userId, req.params.evidenceId);
      res.type('jpg').send(image);
    } catch (error) { next(error); }
  }
  async enrollmentPreview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.type('jpg').send(await studentService.readEnrollmentPreview(req.user!.userId)); } catch (error) { next(error); }
  }
  async biometricProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { return res.json({ success: true, data: await studentService.biometricProfile(req.user!.userId) }); } catch (error) { next(error); }
  }
}

export const studentController = new StudentController();
