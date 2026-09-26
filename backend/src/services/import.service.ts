import * as xlsx from 'xlsx';
import bcrypt from 'bcrypt';
import prisma from '../config/prisma';
import { UserRole, UserStatus, SessionStatus } from '@prisma/client';
import { resolvePeriodRange } from '../utils/study-periods';

export interface ImportWarning {
  row: number;
  message: string;
}

function isDatabaseOverlapError(value: unknown) {
  const candidate = value as { code?: string; meta?: { code?: string } };
  return candidate?.code === 'P2010' && candidate.meta?.code === '23P01';
}

/**
 * Hàm chuẩn hóa và tìm kiếm giá trị từ object row theo nhiều biến thể tên cột (Case-insensitive & Trim)
 */
function getRowValue(row: any, ...keys: string[]): string {
  if (!row || typeof row !== 'object') return '';
  const rowKeys = Object.keys(row);

  for (const targetKey of keys) {
    const cleanTarget = targetKey.toLowerCase().replace(/[\s_-]/g, '');
    for (const actualKey of rowKeys) {
      const cleanActual = actualKey.toLowerCase().replace(/[\s_-]/g, '');
      if (cleanActual === cleanTarget && row[actualKey] !== undefined && row[actualKey] !== null) {
        return String(row[actualKey]).trim();
      }
    }
  }
  return '';
}

/**
 * Hàm phân tích ngày linh hoạt hỗ trợ: ISO String, dd/mm/yyyy, yyyy-mm-dd, Excel serial number
 */
function parseFlexibleDate(dateRaw: any): Date {
  if (!dateRaw) return new Date();

  // 1. Nếu là đối tượng Date có sẵn
  if (dateRaw instanceof Date && !isNaN(dateRaw.getTime())) {
    return dateRaw;
  }

  // 2. Nếu là số Serial Number của Excel (ví dụ 45531)
  if (typeof dateRaw === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(excelEpoch.getTime() + dateRaw * 86400000);
  }

  const str = String(dateRaw).trim();

  // 3. Nếu là dạng dd/mm/yyyy hoặc dd-mm-yyyy (Chuẩn VN)
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    return new Date(year, month, day);
  }

  // 4. Nếu là dạng yyyy-mm-dd hoặc chuẩn ISO
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return new Date();
}

export class ImportService {
  /**
   * 1. Bóc tách danh sách Sinh viên từ Buffer File Excel
   */
  async parseStudents(buffer: Buffer) {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rawData = xlsx.utils.sheet_to_json<any>(workbook.Sheets[sheetName]);

    const validStudents: any[] = [];
    const warnings: ImportWarning[] = [];
    const seenCodes = new Set<string>();

    const defaultPasswordHash = await bcrypt.hash('Student@123', 10);

    rawData.forEach((row, index) => {
      const rowNum = index + 2; // Dòng 1 là tiêu đề
      const userCode = getRowValue(row, 'MSSV', 'userCode', 'Mã sinh viên', 'MaSV');
      const fullName = getRowValue(row, 'Họ và tên', 'fullName', 'Tên', 'HoTen');
      const email = getRowValue(row, 'Email', 'email', 'Thư điện tử');
      const className = getRowValue(row, 'Lớp', 'className', 'Lop', 'Lớp sinh hoạt');
      const department = getRowValue(row, 'Khoa', 'department', 'Khoa/Viện');
      const phone = getRowValue(row, 'SĐT', 'phone', 'Số điện thoại') || null;

      if (!userCode || !email) {
        warnings.push({ row: rowNum, message: 'Thiếu MSSV hoặc Email bắt buộc.' });
        return;
      }

      if (seenCodes.has(userCode)) {
        warnings.push({ row: rowNum, message: `Trùng lặp MSSV trong file: ${userCode}.` });
        return;
      }

      seenCodes.add(userCode);
      validStudents.push({
        userCode,
        fullName: fullName || userCode,
        email,
        passwordHash: defaultPasswordHash,
        role: UserRole.STUDENT,
        className: className || null,
        department: department || null,
        phone,
        status: UserStatus.ACTIVE,
        isFaceEnrolled: false,
      });
    });

    return { validStudents, warnings };
  }

  /**
   * 2. Bóc tách danh sách Giảng viên từ Buffer File Excel
   */
  async parseTeachers(buffer: Buffer) {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rawData = xlsx.utils.sheet_to_json<any>(workbook.Sheets[sheetName]);

    const validTeachers: any[] = [];
    const warnings: ImportWarning[] = [];
    const seenCodes = new Set<string>();

    const defaultPasswordHash = await bcrypt.hash('Teacher@123', 10);

    rawData.forEach((row, index) => {
      const rowNum = index + 2;
      const userCode = getRowValue(row, 'Mã GV', 'userCode', 'Mã giảng viên', 'MaGV');
      const fullName = getRowValue(row, 'Họ và tên', 'fullName', 'Tên', 'HoTen');
      const email = getRowValue(row, 'Email', 'email', 'Thư điện tử');
      const department = getRowValue(row, 'Khoa', 'department', 'Khoa/Viện');
      const phone = getRowValue(row, 'SĐT', 'phone', 'Số điện thoại') || null;

      if (!userCode || !email) {
        warnings.push({ row: rowNum, message: 'Thiếu Mã Giảng viên hoặc Email bắt buộc.' });
        return;
      }

      if (seenCodes.has(userCode)) {
        warnings.push({ row: rowNum, message: `Trùng lặp Mã GV trong file: ${userCode}.` });
        return;
      }

      seenCodes.add(userCode);
      validTeachers.push({
        userCode,
        fullName: fullName || userCode,
        email,
        passwordHash: defaultPasswordHash,
        role: UserRole.TEACHER,
        department: department || null,
        phone,
        status: UserStatus.ACTIVE,
        isFaceEnrolled: false,
      });
    });

    return { validTeachers, warnings };
  }

  /**
   * 3. Bóc tách Thời khóa biểu và Lớp học phần
   */
  async parseSchedule(buffer: Buffer) {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rawData = xlsx.utils.sheet_to_json<any>(workbook.Sheets[sheetName]);

    const courses: Map<string, any> = new Map();
    const courseClasses: any[] = [];
    const warnings: ImportWarning[] = [];

    rawData.forEach((row, index) => {
      const rowNum = index + 2;
      const courseCode = getRowValue(row, 'Mã Môn', 'courseCode', 'Mã học phần', 'MaMon');
      const courseName = getRowValue(row, 'Tên Môn', 'courseName', 'Tên học phần', 'TenMon');
      const credits = Number(getRowValue(row, 'Số Tín Chỉ', 'credits', 'TinChi') || 3);
      const classCode = getRowValue(row, 'Mã Lớp HP', 'classCode', 'Mã lớp', 'MaLop');
      const semester = getRowValue(row, 'Học Kỳ', 'semester', 'HocKy') || 'HK1';
      const academicYear = getRowValue(row, 'Năm Học', 'academicYear', 'NamHoc') || '2026-2027';
      const teacherCode = getRowValue(row, 'Mã GV', 'teacherCode', 'Mã giảng viên', 'MaGV');
      const roomCode = getRowValue(row, 'Phòng Học', 'roomCode', 'Phòng', 'PhongHoc');
      const startTimeStr = getRowValue(row, 'Giờ Bắt Đầu', 'startTime', 'GioBatDau') || '07:00';
      const endTimeStr = getRowValue(row, 'Giờ Kết Thúc', 'endTime', 'GioKetThuc') || '09:30';
      const startDateRaw = row['Ngày Bắt Đầu'] || row['startDate'] || row['NgayBatDau'] || row['Ngày bắt đầu'];
      const totalSessions = Number(getRowValue(row, 'Tổng Số Buổi', 'totalSessions', 'SoBuoi') || 15);
      const studentCodesRaw = getRowValue(row, 'Danh Sách MSSV', 'studentCodes', 'Danh sách MSSV', 'MSSV');

      if (!courseCode || !classCode || !teacherCode || !roomCode) {
        warnings.push({ row: rowNum, message: 'Thiếu Mã Môn, Mã Lớp HP, Mã GV hoặc Phòng học.' });
        return;
      }

      if (!courses.has(courseCode)) {
        courses.set(courseCode, {
          courseCode,
          courseName: courseName || courseCode,
          credits,
          totalSessions,
        });
      }

      const startDate = parseFlexibleDate(startDateRaw);

      const studentCodes = studentCodesRaw
        ? studentCodesRaw.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean)
        : [];

      courseClasses.push({
        courseCode,
        classCode,
        semester,
        academicYear,
        teacherCode,
        roomCode,
        startTimeStr,
        endTimeStr,
        periodValue: getRowValue(row, 'Ca học', 'caHoc', 'period', 'Period', 'Tiết học'),
        periodStartValue: getRowValue(row, 'Ca bắt đầu', 'periodStart', 'Từ tiết', 'startPeriod'),
        periodEndValue: getRowValue(row, 'Ca kết thúc', 'periodEnd', 'Đến tiết', 'endPeriod'),
        startDate,
        totalSessions,
        studentCodes,
        rowNum,
      });
    });

    const groupedCourseClasses = new Map<string, any>();
    for (const courseClass of courseClasses) {
      const schedule = {
        roomCode: courseClass.roomCode,
        startTimeStr: courseClass.startTimeStr,
        endTimeStr: courseClass.endTimeStr,
        periodValue: courseClass.periodValue,
        periodStartValue: courseClass.periodStartValue,
        periodEndValue: courseClass.periodEndValue,
        startDate: courseClass.startDate,
        totalSessions: courseClass.totalSessions,
        rowNum: courseClass.rowNum,
      };
      const existing = groupedCourseClasses.get(courseClass.classCode);
      if (!existing) {
        groupedCourseClasses.set(courseClass.classCode, { ...courseClass, schedules: [schedule] });
        continue;
      }

      if (existing.courseCode !== courseClass.courseCode || existing.teacherCode !== courseClass.teacherCode || existing.semester !== courseClass.semester || existing.academicYear !== courseClass.academicYear) {
        warnings.push({ row: courseClass.rowNum, message: `Mã lớp học phần ${courseClass.classCode} có thông tin môn, giảng viên hoặc học kỳ không đồng nhất.` });
        continue;
      }

      existing.schedules.push(schedule);
      existing.studentCodes = Array.from(new Set([...existing.studentCodes, ...courseClass.studentCodes]));
      existing.totalSessions = Math.max(existing.totalSessions, courseClass.totalSessions);
    }

    return { courses: Array.from(courses.values()), courseClasses: Array.from(groupedCourseClasses.values()), warnings };
  }

  /**
   * 4. Thực thi Import trọn gói tối ưu hóa cao độ với Batch Queries & Phân loại Thêm mới / Cập nhật
   */
  async importBundle(files: {
    studentFile?: Buffer;
    teacherFile?: Buffer;
    scheduleFile?: Buffer;
  }) {
    const allWarnings: { [key: string]: ImportWarning[] } = {};
    const summary = {
      studentsImported: 0,
      studentsCreated: 0,
      studentsUpdated: 0,
      teachersImported: 0,
      teachersCreated: 0,
      teachersUpdated: 0,
      coursesImported: 0,
      coursesCreated: 0,
      coursesUpdated: 0,
      classesImported: 0,
      classesCreated: 0,
      classesUpdated: 0,
      enrollmentsCreated: 0,
      sessionsCreated: 0,
    };

    try {
      return await prisma.$transaction(
      async (tx) => {
        // 1. NẠP SINH VIÊN (Batch Check CSDL để phân loại Thêm mới / Cập nhật)
        if (files.studentFile) {
          const { validStudents, warnings } = await this.parseStudents(files.studentFile);
          allWarnings['students'] = warnings;

          const studentCodes = validStudents.map((s) => s.userCode);
          const existingStudents = await tx.user.findMany({
            where: { userCode: { in: studentCodes } },
            select: { userCode: true },
          });
          const existingSet = new Set(existingStudents.map((s) => s.userCode));

          for (const student of validStudents) {
            if (existingSet.has(student.userCode)) {
              summary.studentsUpdated++;
            } else {
              summary.studentsCreated++;
            }

            await tx.user.upsert({
              where: { userCode: student.userCode },
              update: student,
              create: student,
            });
          }
          summary.studentsImported = validStudents.length;
        }

        // 2. NẠP GIẢNG VIÊN (Batch Check CSDL để phân loại Thêm mới / Cập nhật)
        if (files.teacherFile) {
          const { validTeachers, warnings } = await this.parseTeachers(files.teacherFile);
          allWarnings['teachers'] = warnings;

          const teacherCodes = validTeachers.map((t) => t.userCode);
          const existingTeachers = await tx.user.findMany({
            where: { userCode: { in: teacherCodes } },
            select: { userCode: true },
          });
          const existingSet = new Set(existingTeachers.map((t) => t.userCode));

          for (const teacher of validTeachers) {
            if (existingSet.has(teacher.userCode)) {
              summary.teachersUpdated++;
            } else {
              summary.teachersCreated++;
            }

            await tx.user.upsert({
              where: { userCode: teacher.userCode },
              update: teacher,
              create: teacher,
            });
          }
          summary.teachersImported = validTeachers.length;
        }

        // 3. NẠP THỜI KHÓA BIỂU, LỚP HỌC PHẦN VÀ 15 BUỔI HỌC
        if (files.scheduleFile) {
          const { courses, courseClasses, warnings } = await this.parseSchedule(files.scheduleFile);
          allWarnings['schedule'] = warnings;

          // 3.1 Nạp Môn học & Đếm Thêm mới / Cập nhật
          const courseCodes = courses.map((c) => c.courseCode);
          const existingCourses = await tx.course.findMany({
            where: { courseCode: { in: courseCodes } },
            select: { courseCode: true },
          });
          const existingCourseSet = new Set(existingCourses.map((c) => c.courseCode));

          const courseMap = new Map<string, string>();
          for (const course of courses) {
            if (existingCourseSet.has(course.courseCode)) {
              summary.coursesUpdated++;
            } else {
              summary.coursesCreated++;
            }

            const savedCourse = await tx.course.upsert({
              where: { courseCode: course.courseCode },
              update: {
                courseName: course.courseName,
                credits: course.credits,
                totalSessions: course.totalSessions,
              },
              create: {
                courseCode: course.courseCode,
                courseName: course.courseName,
                credits: course.credits,
                totalSessions: course.totalSessions,
              },
            });
            courseMap.set(course.courseCode, savedCourse.id);
          }
          summary.coursesImported = courses.length;

          // 3.2 Gom toàn bộ mã Giảng viên & MSSV để truy vấn 1 lần duy nhất (Batch Fetch)
          const allTeacherCodes = Array.from(new Set(courseClasses.map((c) => c.teacherCode)));
          const allStudentCodes = Array.from(
            new Set(courseClasses.flatMap((c) => c.studentCodes))
          );
          const allRequiredUserCodes = Array.from(
            new Set([...allTeacherCodes, ...allStudentCodes])
          );

          const existingUsers = await tx.user.findMany({
            where: { userCode: { in: allRequiredUserCodes } },
            select: { id: true, userCode: true, role: true },
          });

          const userMap = new Map<string, { id: string; role: string }>();
          existingUsers.forEach((u) => userMap.set(u.userCode, { id: u.id, role: u.role }));

          // Gom toàn bộ phòng học để xử lý
          const allRoomCodes = Array.from(new Set(courseClasses.flatMap((c) => c.schedules.map((schedule: any) => schedule.roomCode))));
          const roomMap = new Map<string, string>();

          for (const roomCode of allRoomCodes) {
            const room = await tx.classroom.upsert({
              where: { roomCode },
              update: {},
              create: {
                roomCode,
                building: roomCode.split('-')[0] || 'Tòa A',
                floor: parseInt(roomCode.split('-')[1]?.[0] || '1', 10),
                capacity: 60,
                cameraIp: '192.168.1.100',
                rtspUrl: `rtsp://192.168.1.100:554/live/${roomCode}`,
              },
            });
            roomMap.set(roomCode, room.id);
          }

          // Phân loại Lớp học phần Thêm mới / Cập nhật
          const classCodes = courseClasses.map((c) => c.classCode);
          const existingClasses = await tx.courseClass.findMany({
            where: { classCode: { in: classCodes } },
            select: { classCode: true },
          });
          const existingClassSet = new Set(existingClasses.map((c) => c.classCode));

          // 3.3 Nạp từng Lớp học phần
          for (const cClass of courseClasses) {
            const teacherInfo = userMap.get(cClass.teacherCode);

            if (!teacherInfo) {
              allWarnings['schedule'] = allWarnings['schedule'] || [];
              allWarnings['schedule'].push({
                row: cClass.rowNum,
                message: `Không tìm thấy Giảng viên với mã: ${cClass.teacherCode} trong hệ thống.`,
              });
              continue;
            }

            const courseId = courseMap.get(cClass.courseCode);
            if (!courseId) continue;

            const roomId = roomMap.get(cClass.roomCode);

            if (existingClassSet.has(cClass.classCode)) {
              summary.classesUpdated++;
            } else {
              summary.classesCreated++;
            }

            // Upsert Lớp học phần
            const createdClass = await tx.courseClass.upsert({
              where: { classCode: cClass.classCode },
              update: {
                courseId,
                teacherId: teacherInfo.id,
                semester: cClass.semester,
                academicYear: cClass.academicYear,
              },
              create: {
                classCode: cClass.classCode,
                courseId,
                teacherId: teacherInfo.id,
                semester: cClass.semester,
                academicYear: cClass.academicYear,
              },
            });

            // 3.4 Gán sinh viên vào lớp học phần
            const enrollmentsData: any[] = [];
            for (const mssv of cClass.studentCodes) {
              const studentInfo = userMap.get(mssv);
              if (studentInfo) {
                enrollmentsData.push({
                  courseClassId: createdClass.id,
                  studentId: studentInfo.id,
                });
              } else {
                allWarnings['schedule'] = allWarnings['schedule'] || [];
                allWarnings['schedule'].push({
                  row: cClass.rowNum,
                  message: `MSSV ${mssv} chưa có trong hệ thống (bỏ qua ghi danh vào lớp ${cClass.classCode}).`,
                });
              }
            }

            if (enrollmentsData.length > 0) {
              await tx.courseEnrollment.createMany({
                data: enrollmentsData,
                skipDuplicates: true,
              });
              summary.enrollmentsCreated += enrollmentsData.length;
            }

            // 3.5 Tự động sinh 15 buổi học (15 tuần) - Dọn sạch an toàn không lỗi khóa ngoại
            const oldSessions = await tx.classSession.findMany({
              where: { courseClassId: createdClass.id },
              select: { id: true },
            });
            const oldSessionIds = oldSessions.map((s) => s.id);

            if (oldSessionIds.length > 0) {
              await tx.attendanceLog.deleteMany({
                where: { sessionId: { in: oldSessionIds } },
              });
              await tx.sessionProofSnapshot.deleteMany({
                where: { sessionId: { in: oldSessionIds } },
              });
              await tx.leaveRequest.deleteMany({
                where: { sessionId: { in: oldSessionIds } },
              });
              await tx.classSession.deleteMany({
                where: { id: { in: oldSessionIds } },
              });
            }

            if (cClass.schedules) {
              const sessionsData: any[] = [];
              let nextSessionNumber = 1;

              for (const schedule of cClass.schedules) {
                const period = schedule.periodValue || schedule.periodStartValue || schedule.periodEndValue
                  ? resolvePeriodRange(schedule.periodStartValue, schedule.periodEndValue, schedule.periodValue)
                  : null;
                const startTimeParts = (period?.startTime || schedule.startTimeStr).split(':').map(Number);
                const endTimeParts = (period?.endTime || schedule.endTimeStr).split(':').map(Number);
                const roomIdForSchedule = roomMap.get(schedule.roomCode);
                if (!roomIdForSchedule) throw new Error(`Không tìm thấy phòng học ${schedule.roomCode}.`);

                for (let sessionOffset = 0; sessionOffset < schedule.totalSessions; sessionOffset++) {
                  const sessionDate = new Date(schedule.startDate);
                  sessionDate.setDate(sessionDate.getDate() + sessionOffset * 7);
                  const startTime = new Date(sessionDate);
                  startTime.setHours(startTimeParts[0] || 7, startTimeParts[1] || 0, 0, 0);
                  const endTime = new Date(sessionDate);
                  endTime.setHours(endTimeParts[0] || 9, endTimeParts[1] || 30, 0, 0);
                  sessionsData.push({
                    courseClassId: createdClass.id,
                    classroomId: roomIdForSchedule,
                    sessionNumber: nextSessionNumber++,
                    sessionDate,
                    startTime,
                    endTime,
                    periodStart: period?.periodStart || null,
                    periodEnd: period?.periodEnd || null,
                    topic: `Buổi ${nextSessionNumber - 1}: Giảng dạy theo đề cương môn học`,
                    status: SessionStatus.SCHEDULED,
                  });
                }
              }

              if (sessionsData.length > 0) {
                await tx.classSession.createMany({ data: sessionsData });
                summary.sessionsCreated += sessionsData.length;
              }

              summary.classesImported++;
              continue;
            }

            const [startH, startM] = cClass.startTimeStr.split(':').map(Number);
            const [endH, endM] = cClass.endTimeStr.split(':').map(Number);

            // Tìm các ca học cũ của lớp này
            // Sinh dữ liệu các buổi học
            const sessionsData: any[] = [];
            for (let sessionNum = 1; sessionNum <= cClass.totalSessions; sessionNum++) {
              const sessionDate = new Date(cClass.startDate);
              sessionDate.setDate(sessionDate.getDate() + (sessionNum - 1) * 7);

              const startTime = new Date(sessionDate);
              startTime.setHours(startH || 7, startM || 0, 0, 0);

              const endTime = new Date(sessionDate);
              endTime.setHours(endH || 9, endM || 30, 0, 0);

              sessionsData.push({
                courseClassId: createdClass.id,
                classroomId: roomId,
                sessionNumber: sessionNum,
                sessionDate,
                startTime,
                endTime,
                topic: `Buổi ${sessionNum}: Giảng dạy theo đề cương môn học`,
                status: SessionStatus.SCHEDULED,
              });
            }

            if (sessionsData.length > 0) {
              await tx.classSession.createMany({
                data: sessionsData,
              });
              summary.sessionsCreated += sessionsData.length;
            }

            summary.classesImported++;
          }
        }

        return { summary, warnings: allWarnings };
      },
      {
        maxWait: 15000,
        timeout: 60000,
      }
      );
    } catch (caught) {
      if (isDatabaseOverlapError(caught)) {
        throw Object.assign(new Error('File lịch có phòng học hoặc lớp học phần bị trùng thời gian.'), { statusCode: 409 });
      }
      throw caught;
    }
  }
}

export const importService = new ImportService();
