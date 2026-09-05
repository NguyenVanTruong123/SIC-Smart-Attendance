import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes'; 
import teacherRoutes from './routes/teacher.routes';
import ekycRoutes from './routes/ekyc.routes';
import studentRoutes from './routes/student.routes';
import { apiRateLimit } from './middlewares/rate-limit.middleware';

dotenv.config();

const app: Application = express();

// 1. Các Middleware an ninh & tiện ích
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/api/v1', apiRateLimit());

// 2. Route kiểm tra sức khỏe hệ thống (Health Check)
app.get('/api/v1/health', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    statusCode: 200,
    message: 'SPAS Backend API Gateway is Healthy and Running 🚀',
    timestamp: new Date().toISOString(),
  });
});

// 3. Khai báo các module API chính của hệ thống
app.use('/api/v1/auth', authRoutes); // <-- 2. Mở cổng API /api/v1/auth
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/teacher', teacherRoutes);
app.use('/api/v1/ekyc', ekycRoutes);
app.use('/api/v1/student', studentRoutes);

// 4. Bắt lỗi khi người dùng gọi sai đường dẫn (404 Not Found)
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    statusCode: 404,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Đường dẫn ${req.originalUrl} không tồn tại trên hệ thống.`,
    },
    timestamp: new Date().toISOString(),
  });
});

// 5. Xử lý lỗi tập trung toàn hệ thống (Global Error Handler)
app.use((err: Error & { statusCode?: number }, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Error:', err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    statusCode,
    error: {
      code: statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_FAILED',
      message: statusCode >= 500 ? 'Đã có lỗi xảy ra trên máy chủ.' : err.message,
    },
    timestamp: new Date().toISOString(),
  });
});

export default app;
