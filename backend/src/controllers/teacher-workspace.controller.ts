import { NextFunction, Response } from 'express';
import { RequestStatus } from '@prisma/client';
import { AuthenticatedRequest } from '../middlewares/auth.middlewares';
import { teacherWorkspaceService } from '../services/teacher-workspace.service';

export class TeacherWorkspaceController {
  async leaveRequests(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { return res.json({ success: true, data: await teacherWorkspaceService.leaveRequests(req.user!.userId, req.user!.role) }); } catch (error) { next(error); }
  }
  async reviewLeave(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { leaveRequestId, decision } = req.body;
      return res.json({ success: true, data: await teacherWorkspaceService.reviewLeave(req.params.id, leaveRequestId, decision as RequestStatus, req.user!.userId, req.user!.role) });
    } catch (error) { next(error); }
  }
  async reportMatrix(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const courseClassId = req.query.course_class_id;
      if (typeof courseClassId !== 'string') throw Object.assign(new Error('course_class_id là bắt buộc.'), { statusCode: 422 });
      return res.json({ success: true, data: await teacherWorkspaceService.reportMatrix(courseClassId, req.user!.userId, req.user!.role) });
    } catch (error) { next(error); }
  }
}

export const teacherWorkspaceController = new TeacherWorkspaceController();
