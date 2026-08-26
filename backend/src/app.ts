import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes'; 
import aiRoutes from './routes/ai.routes';

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
app.use('/api/v1/ai', aiRoutes);

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
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({
    success: false,
    statusCode: 500,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: err.message || 'Đã có lỗi xảy ra trên máy chủ.',
    },
    timestamp: new Date().toISOString(),
  });
});

export default app;
