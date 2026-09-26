import {
  AttendanceStatus,
  CameraStatus,
  ClassSession,
  CourseClass,
  CourseClassStatus,
  LeaveRequestType,
  PrismaClient,
  RequestStatus,
  SessionStatus,
  User,
  UserRole,
  UserStatus,
} from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const today = (() => {
  const configured = process.env.SEED_BASE_DATE;
  const value = configured ? new Date(`${configured}T00:00:00.000Z`) : new Date();
  value.setUTCHours(0, 0, 0, 0);
  return value;
})();

function addDays(value: Date, days: number) {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function atTime(hour: number, minute: number) {
  return new Date(Date.UTC(1970, 0, 1, hour, minute));
}

function addMinutes(value: Date, minutes: number) {
  return new Date(value.getTime() + minutes * 60_000);
}

async function upsertUser(
  passwordHash: string,
  userCode: string,
  input: {
    email: string;
    fullName: string;
    role: UserRole;
    department: string;
    departmentId: string;
    className?: string;
    phone: string;
    isFaceEnrolled?: boolean;
  },
) {
  const data = {
    email: input.email,
    fullName: input.fullName,
    role: input.role,
    department: input.department,
    departmentId: input.departmentId,
    className: input.className,
    phone: input.phone,
    isFaceEnrolled: input.isFaceEnrolled ?? false,
    status: UserStatus.ACTIVE,
  };

  return prisma.user.upsert({
    where: { userCode },
    update: { ...data, passwordHash },
    create: { userCode, passwordHash, ...data },
  });
}

async function upsertCourse(courseCode: string, courseName: string, credits: number) {
  return prisma.course.upsert({
    where: { courseCode },
    update: { courseName, credits, totalSessions: 15 },
    create: { courseCode, courseName, credits, totalSessions: 15 },
  });
}

async function upsertClassroom(
  roomCode: string,
  input: {
    building: string;
    floor: number;
    capacity: number;
    cameraIp: string;
    rtspUrl: string;
    cameraStatus: CameraStatus;
  },
) {
  return prisma.classroom.upsert({
    where: { roomCode },
    update: input,
    create: { roomCode, fps: 30, latencyMs: 0, ...input },
  });
}

async function upsertClass(
  classCode: string,
  courseId: string,
  teacherId: string,
  semester: string,
  academicYear: string,
) {
  return prisma.courseClass.upsert({
    where: { classCode },
    update: { courseId, teacherId, semester, academicYear, status: CourseClassStatus.ACTIVE },
    create: { classCode, courseId, teacherId, semester, academicYear },
  });
}

async function ensureSession(
  courseClassId: string,
  classroomId: string,
  input: {
    sessionNumber: number;
    sessionDate: Date;
    periodStart: number;
    periodEnd: number;
    startTime: Date;
    endTime: Date;
    topic: string;
    status: SessionStatus;
  },
) {
  const existing = await prisma.classSession.findFirst({
    where: { courseClassId, sessionNumber: input.sessionNumber, sessionDate: input.sessionDate },
  });
  const data = {
    classroomId,
    sessionNumber: input.sessionNumber,
    sessionDate: input.sessionDate,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    startTime: input.startTime,
    endTime: input.endTime,
    topic: input.topic,
    status: input.status,
    startedAt: input.status === SessionStatus.COMPLETED ? addMinutes(input.sessionDate, 5) : null,
    endedAt: input.status === SessionStatus.COMPLETED ? addMinutes(input.sessionDate, 95) : null,
  };

  if (existing) return prisma.classSession.update({ where: { id: existing.id }, data });
  return prisma.classSession.create({ data: { courseClassId, ...data } });
}

async function ensureEnrollment(courseClassId: string, studentId: string) {
  return prisma.courseEnrollment.upsert({
    where: { uq_course_student: { courseClassId, studentId } },
    update: {},
    create: { courseClassId, studentId },
  });
}

async function ensureAttendance(
  sessionId: string,
  studentId: string,
  status: AttendanceStatus,
  firstSeenAt: Date | null,
  lateMinutes: number,
  bestScore: number | null,
) {
  return prisma.attendanceLog.upsert({
    where: { uq_session_student: { sessionId, studentId } },
    update: { status, firstSeenAt, lateMinutes, bestScore },
    create: { sessionId, studentId, status, firstSeenAt, lateMinutes, bestScore },
  });
}

async function ensureLeaveRequest(
  studentId: string,
  sessionId: string,
  requestType: LeaveRequestType,
  reason: string,
  status: RequestStatus,
  reviewerId: string | null = null,
  reviewNote: string | null = null,
  reviewedAt: Date | null = null,
) {
  const existing = await prisma.leaveRequest.findFirst({ where: { studentId, sessionId } });
  const data = { requestType, reason, status, reviewerId, reviewNote, reviewedAt };
  if (existing) return prisma.leaveRequest.update({ where: { id: existing.id }, data });
  return prisma.leaveRequest.create({ data: { studentId, sessionId, ...data } });
}

async function main() {
  console.log('🌱 Đang nạp dữ liệu QA SPAS...');

  const [adminPassword, teacherPassword, studentPassword] = await Promise.all([
    bcrypt.hash('Admin@123', 10),
    bcrypt.hash('Teacher@123', 10),
    bcrypt.hash('Student@123', 10),
  ]);

  const department = await prisma.department.upsert({
    where: { code: 'CNTT' },
    update: { name: 'Khoa Công nghệ thông tin' },
    create: { code: 'CNTT', name: 'Khoa Công nghệ thông tin' },
  });

  const admin = await upsertUser(adminPassword, 'ADMIN001', {
    email: 'admin@vnu.edu.vn',
    fullName: 'Quản trị SPAS',
    role: UserRole.ADMIN,
    department: 'Phòng Đào tạo',
    departmentId: department.id,
    phone: '0900000001',
    isFaceEnrolled: false,
  });
  const teachers: Record<string, User> = {};
  for (const teacher of [
    ['GV001', 'gv.nguyenvanan@vnu.edu.vn', 'Nguyễn Minh An', '0900000101'],
    ['GV002', 'gv.tranthha@vnu.edu.vn', 'Trần Thu Hà', '0900000102'],
    ['GV003', 'gv.lehoainam@vnu.edu.vn', 'Lê Hoài Nam', '0900000103'],
    ['GV004', 'gv.phamthuhuyen@vnu.edu.vn', 'Phạm Thu Huyền', '0900000104'],
    ['GV005', 'gv.doquocbao@vnu.edu.vn', 'Đỗ Quốc Bảo', '0900000105'],
    ['GV006', 'gv.nguyenquynhchi@vnu.edu.vn', 'Nguyễn Quỳnh Chi', '0900000106'],
    ['GV007', 'gv.vutrungduc@vnu.edu.vn', 'Vũ Trung Đức', '0900000107'],
  ]) {
    teachers[teacher[0]] = await upsertUser(teacherPassword, teacher[0], {
      email: teacher[1],
      fullName: teacher[2],
      role: UserRole.TEACHER,
      department: 'Khoa Công nghệ thông tin',
      departmentId: department.id,
      phone: teacher[3],
      isFaceEnrolled: false,
    });
  }

  const students: Record<string, User> = {};
  const studentFixtures = [
    ['21020001', '21020001@vnu.edu.vn', 'Trần Thị Mai', 'CNTT1', '0900000201', true],
    ['21020002', '21020002@vnu.edu.vn', 'Nguyễn Hoàng Nam', 'CNTT1', '0900000202', false],
    ['21020003', '21020003@vnu.edu.vn', 'Lê Minh Quang', 'CNTT1', '0900000203', false],
    ['21020004', '21020004@vnu.edu.vn', 'Nguyễn Lan Anh', 'CNTT2', '0900000204', false],
    ['21020005', '21020005@vnu.edu.vn', 'Phạm Gia Huy', 'CNTT2', '0900000205', false],
    ['21020006', '21020006@vnu.edu.vn', 'Vũ Ngọc Mai', 'CNTT2', '0900000206', false],
    ['21020007', '21020007@vnu.edu.vn', 'Đỗ Thành Long', 'CNTT3', '0900000207', false],
    ['21020008', '21020008@vnu.edu.vn', 'Hoàng Thu Trang', 'CNTT3', '0900000208', false],
    ['21020009', '21020009@vnu.edu.vn', 'Bùi Khánh Linh', 'CNTT3', '0900000209', false],
    ['21020010', '21020010@vnu.edu.vn', 'Trần Đức Anh', 'CNTT3', '0900000210', false],
    ['21020011', '21020011@vnu.edu.vn', 'Lý Thanh Tùng', 'CNTT4', '0900000211', false],
    ['21020012', '21020012@vnu.edu.vn', 'Ngô Phương Thảo', 'CNTT4', '0900000212', false],
    ['21020013', '21020013@vnu.edu.vn', 'Đặng Nhật Minh', 'CNTT4', '0900000213', false],
    ['21020014', '21020014@vnu.edu.vn', 'Phan Bảo Ngọc', 'CNTT4', '0900000214', false],
    ['21020015', '21020015@vnu.edu.vn', 'Đinh Minh Khoa', 'CNTT5', '0900000215', false],
    ['21020016', '21020016@vnu.edu.vn', 'Mai Thu Hà', 'CNTT5', '0900000216', false],
    ['21020017', '21020017@vnu.edu.vn', 'Lương Quốc Khánh', 'CNTT5', '0900000217', false],
    ['21020018', '21020018@vnu.edu.vn', 'Hà Mỹ Duyên', 'CNTT5', '0900000218', false],
    ['21020019', '21020019@vnu.edu.vn', 'Chu Đức Thành', 'CNTT6', '0900000219', false],
    ['21020020', '21020020@vnu.edu.vn', 'Tạ Thu Phương', 'CNTT6', '0900000220', false],
    ['21020021', '21020021@vnu.edu.vn', 'Nguyễn Gia Hân', 'CNTT6', '0900000221', false],
    ['21020022', '21020022@vnu.edu.vn', 'Võ Minh Tú', 'CNTT6', '0900000222', false],
    ['21020023', '21020023@vnu.edu.vn', 'Lâm Khôi Nguyên', 'CNTT7', '0900000223', false],
    ['21020024', '21020024@vnu.edu.vn', 'Đoàn Thanh Vân', 'CNTT7', '0900000224', false],
  ] as const;
  for (const [userCode, email, fullName, className, phone, isFaceEnrolled] of studentFixtures) {
    students[userCode] = await upsertUser(studentPassword, userCode, {
      email,
      fullName,
      role: UserRole.STUDENT,
      department: 'Khoa Công nghệ thông tin',
      departmentId: department.id,
      className,
      phone,
      isFaceEnrolled,
    });
  }

  const biometricEvidence = [
    '97f079b3-c024-4d6b-8ccf-5bb4215337d7.jpg',
    '148642dd-5074-4e44-a3a8-157ab63754d4.jpg',
    '32377b57-bd73-4a06-872b-46c7f966139a.jpg',
    '3c2344a7-efa8-42a9-9440-48ebf5f8de74.jpg',
    '65f99b6e-c1e0-49d6-b054-9ea13fb9e387.jpg',
    'c7f81f05-12f0-4f53-8d13-7d409d436780.jpg',
    'd132f7e8-d88d-4ba3-b025-a1b9b8fae6d6.jpg',
    'e06a522b-82f6-43e2-84a1-aabc50af7ffb.jpg',
  ];
  await prisma.userBiometric.upsert({
    where: { userId: students['21020001'].id },
    update: {
      enrolledFaceUrl: biometricEvidence[0],
      lastEnrolledAt: addMinutes(today, 30),
      modelVersion: 'facenet-512d',
      embeddingDimension: 512,
      enrollmentVersion: 1,
      matchConfidence: 0.86,
    },
    create: {
      userId: students['21020001'].id,
      enrolledFaceUrl: biometricEvidence[0],
      lastEnrolledAt: addMinutes(today, 30),
      modelVersion: 'facenet-512d',
      embeddingDimension: 512,
      enrollmentVersion: 1,
      matchConfidence: 0.86,
    },
  });
  for (const [index, imageUrl] of biometricEvidence.entries()) {
    const pose = index < 3 ? 'front' : index < 6 ? 'left' : 'right';
    await prisma.userEnrollmentImage.upsert({
      where: { userId_imageIndex: { userId: students['21020001'].id, imageIndex: index + 1 } },
      update: { imageUrl, mimeType: 'image/jpeg', pose },
      create: { userId: students['21020001'].id, imageIndex: index + 1, imageUrl, mimeType: 'image/jpeg', pose },
    });
  }

  const [int101, web201, dat102, ai202, cs201, net203, mob202, se301] = await Promise.all([
    upsertCourse('INT101', 'Nhập môn Trí tuệ nhân tạo', 3),
    upsertCourse('WEB201', 'Lập trình Web', 3),
    upsertCourse('DAT102', 'Cơ sở dữ liệu', 3),
    upsertCourse('AI202', 'Thị giác máy tính', 3),
    upsertCourse('CS201', 'Cấu trúc dữ liệu và giải thuật', 3),
    upsertCourse('NET203', 'Mạng máy tính', 3),
    upsertCourse('MOB202', 'Lập trình ứng dụng di động', 3),
    upsertCourse('SE301', 'Kỹ nghệ phần mềm', 3),
  ]);
  const [roomA, roomB, roomC, roomD, roomE, roomF, roomG] = await Promise.all([
    upsertClassroom('A2-301', { building: 'A2', floor: 3, capacity: 45, cameraIp: '192.168.1.101', rtspUrl: 'rtsp://127.0.0.1:8554/a2-301', cameraStatus: CameraStatus.OFFLINE }),
    upsertClassroom('A2-302', { building: 'A2', floor: 3, capacity: 45, cameraIp: '192.168.1.102', rtspUrl: 'rtsp://127.0.0.1:8554/a2-302', cameraStatus: CameraStatus.ONLINE }),
    upsertClassroom('B1-105', { building: 'B1', floor: 1, capacity: 60, cameraIp: '192.168.1.105', rtspUrl: 'rtsp://127.0.0.1:8554/b1-105', cameraStatus: CameraStatus.MAINTENANCE }),
    upsertClassroom('A3-201', { building: 'A3', floor: 2, capacity: 50, cameraIp: 'browser', rtspUrl: 'browser://camera', cameraStatus: CameraStatus.ONLINE }),
    upsertClassroom('A3-202', { building: 'A3', floor: 2, capacity: 50, cameraIp: 'browser', rtspUrl: 'browser://camera', cameraStatus: CameraStatus.ONLINE }),
    upsertClassroom('B2-104', { building: 'B2', floor: 1, capacity: 55, cameraIp: 'browser', rtspUrl: 'browser://camera', cameraStatus: CameraStatus.ONLINE }),
    upsertClassroom('B2-106', { building: 'B2', floor: 1, capacity: 55, cameraIp: 'browser', rtspUrl: 'browser://camera', cameraStatus: CameraStatus.ONLINE }),
  ]);
  const classes: Record<string, CourseClass> = {
    'INT101-01': await upsertClass('INT101-01', int101.id, teachers.GV001.id, 'HK1', '2026-2027'),
    'WEB201-01': await upsertClass('WEB201-01', web201.id, teachers.GV002.id, 'HK1', '2026-2027'),
    'DAT102-01': await upsertClass('DAT102-01', dat102.id, teachers.GV003.id, 'HK1', '2026-2027'),
    'AI202-01': await upsertClass('AI202-01', ai202.id, teachers.GV001.id, 'HK1', '2026-2027'),
    'CS201-01': await upsertClass('CS201-01', cs201.id, teachers.GV004.id, 'HK1', '2026-2027'),
    'NET203-01': await upsertClass('NET203-01', net203.id, teachers.GV005.id, 'HK1', '2026-2027'),
    'MOB202-01': await upsertClass('MOB202-01', mob202.id, teachers.GV006.id, 'HK1', '2026-2027'),
    'SE301-01': await upsertClass('SE301-01', se301.id, teachers.GV007.id, 'HK1', '2026-2027'),
  };

  const rosters: Record<string, string[]> = {
    'INT101-01': ['21020001', '21020002', '21020003', '21020004'],
    'WEB201-01': ['21020001', '21020003', '21020004', '21020005', '21020006'],
    'DAT102-01': ['21020001', '21020005', '21020006', '21020007', '21020008'],
    'AI202-01': ['21020001', '21020002', '21020005', '21020008'],
    'CS201-01': ['21020001', '21020009', '21020010', '21020011', '21020012', '21020013'],
    'NET203-01': ['21020002', '21020010', '21020014', '21020015', '21020016', '21020017'],
    'MOB202-01': ['21020003', '21020011', '21020018', '21020019', '21020020', '21020021'],
    'SE301-01': ['21020004', '21020012', '21020020', '21020022', '21020023', '21020024'],
  };
  for (const [classCode, userCodes] of Object.entries(rosters)) {
    for (const userCode of userCodes) await ensureEnrollment(classes[classCode].id, students[userCode].id);
  }

  const historySession = await ensureSession(classes['INT101-01'].id, roomA.id, {
    sessionNumber: 1,
    sessionDate: addDays(today, -3),
    periodStart: 1,
    periodEnd: 3,
    startTime: atTime(7, 0),
    endTime: atTime(9, 40),
    topic: 'Giới thiệu trí tuệ nhân tạo',
    status: SessionStatus.COMPLETED,
  });
  const nextIntSession = await ensureSession(classes['INT101-01'].id, roomA.id, {
    sessionNumber: 2,
    sessionDate: addDays(today, 1),
    periodStart: 1,
    periodEnd: 3,
    startTime: atTime(7, 0),
    endTime: atTime(9, 40),
    topic: 'Tìm kiếm và biểu diễn tri thức',
    status: SessionStatus.SCHEDULED,
  });
  await ensureSession(classes['WEB201-01'].id, roomB.id, {
    sessionNumber: 1,
    sessionDate: addDays(today, 2),
    periodStart: 7,
    periodEnd: 9,
    startTime: atTime(13, 30),
    endTime: atTime(16, 10),
    topic: 'HTTP và kiến trúc Web',
    status: SessionStatus.SCHEDULED,
  });
  await ensureSession(classes['DAT102-01'].id, roomC.id, {
    sessionNumber: 1,
    sessionDate: addDays(today, 3),
    periodStart: 4,
    periodEnd: 6,
    startTime: atTime(9, 50),
    endTime: atTime(12, 30),
    topic: 'Mô hình dữ liệu quan hệ',
    status: SessionStatus.SCHEDULED,
  });
  await ensureSession(classes['AI202-01'].id, roomB.id, {
    sessionNumber: 1,
    sessionDate: addDays(today, 4),
    periodStart: 10,
    periodEnd: 11,
    startTime: atTime(16, 20),
    endTime: atTime(18, 5),
    topic: 'Phát hiện khuôn mặt',
    status: SessionStatus.SCHEDULED,
  });
  await ensureSession(classes['CS201-01'].id, roomD.id, {
    sessionNumber: 1,
    sessionDate: addDays(today, 1),
    periodStart: 4,
    periodEnd: 6,
    startTime: atTime(9, 50),
    endTime: atTime(12, 30),
    topic: 'Danh sách liên kết và ngăn xếp',
    status: SessionStatus.SCHEDULED,
  });
  await ensureSession(classes['NET203-01'].id, roomE.id, {
    sessionNumber: 1,
    sessionDate: addDays(today, 2),
    periodStart: 1,
    periodEnd: 3,
    startTime: atTime(7, 0),
    endTime: atTime(9, 40),
    topic: 'Mô hình TCP/IP',
    status: SessionStatus.SCHEDULED,
  });
  await ensureSession(classes['MOB202-01'].id, roomF.id, {
    sessionNumber: 1,
    sessionDate: addDays(today, 3),
    periodStart: 7,
    periodEnd: 9,
    startTime: atTime(13, 30),
    endTime: atTime(16, 10),
    topic: 'Kiến trúc ứng dụng Android',
    status: SessionStatus.SCHEDULED,
  });
  await ensureSession(classes['SE301-01'].id, roomG.id, {
    sessionNumber: 1,
    sessionDate: addDays(today, 4),
    periodStart: 1,
    periodEnd: 3,
    startTime: atTime(7, 0),
    endTime: atTime(9, 40),
    topic: 'Quy trình phát triển phần mềm',
    status: SessionStatus.SCHEDULED,
  });

  await ensureAttendance(historySession.id, students['21020001'].id, AttendanceStatus.PRESENT, addMinutes(historySession.sessionDate, 8), 0, 0.86);
  await ensureAttendance(historySession.id, students['21020002'].id, AttendanceStatus.LATE, addMinutes(historySession.sessionDate, 17), 9, 0.79);
  await ensureAttendance(historySession.id, students['21020003'].id, AttendanceStatus.ABSENT, null, 0, null);
  await ensureAttendance(historySession.id, students['21020004'].id, AttendanceStatus.EXCUSED, null, 0, null);

  await ensureLeaveRequest(
    students['21020004'].id,
    historySession.id,
    LeaveRequestType.FULL_SESSION,
    'Có lịch khám bệnh.',
    RequestStatus.APPROVED,
    teachers.GV001.id,
    'Đã duyệt nghỉ học có lý do.',
    addMinutes(historySession.sessionDate, 10),
  );
  await ensureLeaveRequest(
    students['21020003'].id,
    nextIntSession.id,
    LeaveRequestType.LATE_ENTRY,
    'Có lịch làm thủ tục hành chính trước giờ học.',
    RequestStatus.PENDING,
  );

  await ensureLeaveRequest(
    students['21020002'].id,
    nextIntSession.id,
    LeaveRequestType.FULL_SESSION,
    'Gia đình có việc đột xuất trong ngày học.',
    RequestStatus.PENDING,
  );
  await ensureLeaveRequest(
    students['21020001'].id,
    nextIntSession.id,
    LeaveRequestType.LATE_ENTRY,
    'Kẹt xe trên đường đến trường, xin phép vào muộn.',
    RequestStatus.REJECTED,
    teachers.GV001.id,
    'Lý do chưa đủ căn cứ để duyệt.',
    addMinutes(nextIntSession.sessionDate, 12),
  );
  await ensureLeaveRequest(
    students['21020004'].id,
    nextIntSession.id,
    LeaveRequestType.LATE_ENTRY,
    'Có lịch làm thủ tục tại phòng đào tạo trước giờ học.',
    RequestStatus.APPROVED,
    teachers.GV001.id,
    'Đã duyệt đơn vào muộn.',
    addMinutes(nextIntSession.sessionDate, 10),
  );

  console.log('✅ Seed QA hoàn tất.');
  console.log('Tài khoản: ADMIN001 / Admin@123; GV001-GV007 / Teacher@123; 21020001-21020024 / Student@123');
  console.log('Lớp: INT101-01, WEB201-01, DAT102-01, AI202-01, CS201-01, NET203-01, MOB202-01, SE301-01.');
  console.log(`Admin seed id: ${admin.id}`);
}

main()
  .catch((error) => {
    console.error('❌ Lỗi khi nạp dữ liệu QA:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
