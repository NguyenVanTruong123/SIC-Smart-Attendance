import 'dotenv/config';
import app from './app';
import prisma from './config/prisma';
import { createServer } from 'node:http';
import { initRealtime } from './realtime/socket';
import { teacherSessionService } from './services/teacher-session.service';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // 1. Kiểm tra kết nối tới CSDL PostgreSQL / Supabase
    await prisma.$connect();
    console.log('✅ PostgreSQL / Supabase Database connected successfully!');

    // 2. Bật Web Server lắng nghe các request
    const httpServer = createServer(app);
    initRealtime(httpServer);
    httpServer.listen(PORT, () => {
      console.log(`🚀 SPAS Backend Server running on http://localhost:${PORT}`);
      console.log(`📡 Health Check URL: http://localhost:${PORT}/api/v1/health`);
    });
    teacherSessionService.startScheduler();
  } catch (error) {
    console.error('❌ Failed to connect to Database:', error);
    process.exit(1);
  }
}

startServer();
