import { NextFunction, Request, Response } from 'express';

const buckets = new Map<string, { startedAt: number; count: number }>();

export function apiRateLimit(limit = 300, windowMs = 60_000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const current = buckets.get(key);
    const bucket = !current || now - current.startedAt >= windowMs ? { startedAt: now, count: 0 } : current;
    bucket.count += 1;
    buckets.set(key, bucket);
    if (bucket.count > limit) {
      res.setHeader('Retry-After', Math.ceil((windowMs - (now - bucket.startedAt)) / 1000));
      return res.status(429).json({ success: false, statusCode: 429, error: { code: 'RATE_LIMITED', message: 'Quá nhiều yêu cầu, vui lòng thử lại sau.' } });
    }
    return next();
  };
}
