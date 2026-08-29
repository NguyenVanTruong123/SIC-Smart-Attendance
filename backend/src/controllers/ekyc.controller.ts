import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middlewares';
import { aiClientService } from '../services/ai-client.service';
import { ekycService } from '../services/ekyc.service';

export class EkycController {
  async enrollInitial(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const frames = Array.isArray(req.files) ? req.files : [];
      const result = await ekycService.enrollInitial(req.user!.userId, frames);
      return res.status(201).json({ success: true, statusCode: 201, data: result, timestamp: new Date().toISOString() });
    } catch (error) {
      next(error);
    }
  }

  async detectPose(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) throw Object.assign(new Error('Frame camera là bắt buộc.'), { statusCode: 422 });
      return res.json({ success: true, data: await aiClientService.detectPose(req.file) });
    } catch (error) {
      next(error);
    }
  }
}

export const ekycController = new EkycController();
