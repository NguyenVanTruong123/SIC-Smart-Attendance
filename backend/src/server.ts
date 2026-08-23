import app from './app';
import prisma from './config/prisma';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // 1. Kiểm tra kết nối tới CSDL PostgreSQL / Supabase
    await prisma.$connect();
    console.log('✅ PostgreSQL / Supabase Database connected successfully!');

    // 2. Bật Web Server lắng nghe các request
    app.listen(PORT, () => {
      console.log(`🚀 SPAS Backend Server running on http://localhost:${PORT}`);
      console.log(`📡 Health Check URL: http://localhost:${PORT}/api/v1/health`);
    });
  } catch (error) {
    console.error('❌ Failed to connect to Database:', error);
    process.exit(1);
  }
}

startServer();
