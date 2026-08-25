import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Đang bắt đầu nạp dữ liệu mẫu (Seed Data)...');

  // 1. Mã hóa mật khẩu mẫu bằng bcrypt (10 vòng muối)
  const adminPassword = await bcrypt.hash('Admin@123', 10);
  const teacherPassword = await bcrypt.hash('Teacher@123', 10);
  const studentPassword = await bcrypt.hash('Student@123', 10);

  // 2. Tạo tài khoản Admin
  const admin = await prisma.user.upsert({
    where: { userCode: 'ADMIN001' },
    update: {},
    create: {
      userCode: 'ADMIN001',
      email: 'admin@vnu.edu.vn',
      passwordHash: adminPassword,
      fullName: 'Quản Trị Viên Hệ Thống',
      role: UserRole.ADMIN,
      department: 'Phòng Đào Tạo',
      isFaceEnrolled: true,
    },
  });

  // 3. Tạo tài khoản Giảng viên
  const teacher = await prisma.user.upsert({
    where: { userCode: 'GV001' },
    update: {},
    create: {
      userCode: 'GV001',
      email: 'gv.nguyenvanan@vnu.edu.vn',
      passwordHash: teacherPassword,
      fullName: 'TS. Nguyễn Văn An',
      role: UserRole.TEACHER,
      department: 'Khoa Công Nghệ Thông Tin',
      isFaceEnrolled: true,
    },
  });

  // 4. Tạo tài khoản Sinh viên (Chưa đăng ký eKYC khuôn mặt)
  const student = await prisma.user.upsert({
    where: { userCode: '21020001' },
    update: {},
    create: {
      userCode: '21020001',
      email: '21020001@vnu.edu.vn',
      passwordHash: studentPassword,
      fullName: 'Trần Thị Mai',
      role: UserRole.STUDENT,
      className: '21CNTT1',
      department: 'Khoa Công Nghệ Thông Tin',
      isFaceEnrolled: false, // Để test màn hình khóa eKYC
    },
  });

  console.log('✅ Đã nạp thành công 3 tài khoản mẫu:');
  console.log(` - Admin: ${admin.email} (Mật khẩu: Admin@123)`);
  console.log(` - Giảng viên: ${teacher.email} (Mật khẩu: Teacher@123)`);
  console.log(` - Sinh viên: ${student.email} (Mật khẩu: Student@123)`);
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi nạp dữ liệu:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
