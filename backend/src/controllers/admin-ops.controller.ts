import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middlewares';
import { adminOpsService } from '../services/admin-ops.service';

export class AdminOpsController {
  async health(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { return res.json({ success: true, data: await adminOpsService.health() }); } catch (error) { next(error); } }
  async auditLogs(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { return res.json({ success: true, data: await adminOpsService.auditLogs({ search: req.query.search as string, page: Number(req.query.page || 1), limit: Number(req.query.limit || 25) }) }); } catch (error) { next(error); } }
  async report(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query = { courseClassId: req.query.course_class_id as string, from: req.query.from as string, to: req.query.to as string };
      if (req.query.format === 'csv') { res.type('text/csv').setHeader('Content-Disposition', 'attachment; filename="attendance-report.csv"'); return res.send(await adminOpsService.attendanceReportCsv(query)); }
      return res.json({ success: true, data: await adminOpsService.attendanceReport(query) });
    } catch (error) { next(error); }
  }
}

export const adminOpsController = new AdminOpsController();
