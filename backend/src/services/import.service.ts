import * as xlsx from 'xlsx';
import bcrypt from 'bcrypt';
import prisma from '../config/prisma';
import { UserRole, UserStatus, SessionStatus } from '@prisma/client';

export interface ImportWarning {
  row: number;
  message: string;
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
      const userCode = String(row['MSSV'] || row['userCode'] || '').trim();
      const fullName = String(row['Họ và tên'] || row['fullName'] || '').trim();
      const email = String(row['Email'] || row['email'] || '').trim();
      const className = String(row['Lớp'] || row['className'] || '').trim();
      const department = String(row['Khoa'] || row['department'] || '').trim();
      const phone = row['SĐT'] || row['phone'] ? String(row['SĐT'] || row['phone']).trim() : null;

      if (!userCode || !email) {
        warnings.push({ row: rowNum, message: 'Thiếu MSSV hoặc Email bắt buộc.' });
        return;
      }

      if (seenCodes.has(userCode)) {
        warnings.push({ row: rowNum, message: `Trùng lặp MSSV: ${userCode}.` });
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
      const userCode = String(row['Mã GV'] || row['userCode'] || '').trim();
      const fullName = String(row['Họ và tên'] || row['fullName'] || '').trim();
      const email = String(row['Email'] || row['email'] || '').trim();
      const department = String(row['Khoa'] || row['department'] || '').trim();
      const phone = row['SĐT'] || row['phone'] ? String(row['SĐT'] || row['phone']).trim() : null;

      if (!userCode || !email) {
        warnings.push({ row: rowNum, message: 'Thiếu Mã Giảng viên hoặc Email bắt buộc.' });
        return;
      }

      if (seenCodes.has(userCode)) {
        warnings.push({ row: rowNum, message: `Trùng lặp Mã GV: ${userCode}.` });
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
      const courseCode = String(row['Mã Môn'] || row['courseCode'] || '').trim();
      const courseName = String(row['Tên Môn'] || row['courseName'] || '').trim();
      const credits = Number(row['Số Tín Chỉ'] || row['credits'] || 3);
      const classCode = String(row['Mã Lớp HP'] || row['classCode'] || '').trim();
      const semester = String(row['Học Kỳ'] || row['semester'] || 'HK1').trim();
      const academicYear = String(row['Năm Học'] || row['academicYear'] || '2026-2027').trim();
      const teacherCode = String(row['Mã GV'] || row['teacherCode'] || '').trim();
      const roomCode = String(row['Phòng Học'] || row['roomCode'] || '').trim();
      const startTimeStr = String(row['Giờ Bắt Đầu'] || row['startTime'] || '07:00').trim();
      const endTimeStr = String(row['Giờ Kết Thúc'] || row['endTime'] || '09:30').trim();
      const startDateRaw = row['Ngày Bắt Đầu'] || row['startDate'];
      const totalSessions = Number(row['Tổng Số Buổi'] || row['totalSessions'] || 15);
      const studentCodesRaw = String(row['Danh Sách MSSV'] || row['studentCodes'] || '').trim();

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

      // Xử lý ngày bắt đầu
      let startDate = new Date();
      if (startDateRaw) {
        const parsed = new Date(startDateRaw);
        if (!isNaN(parsed.getTime())) {
          startDate = parsed;
        }
      }

      const studentCodes = studentCodesRaw
        ? studentCodesRaw.split(',').map((s) => s.trim()).filter(Boolean)
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
        startDate,
        totalSessions,
        studentCodes,
      });
    });

    return { courses: Array.from(courses.values()), courseClasses, warnings };
  }

  /**
   * 4. Thực thi Import trọn gói 3-trong-1 trong 1 Prisma Transaction
   */
  async importBundle(files: {
    studentFile?: Buffer;
    teacherFile?: Buffer;
    scheduleFile?: Buffer;
  }) {
    const allWarnings: { [key: string]: ImportWarning[] } = {};
    const summary = {
      studentsImported: 0,
      teachersImported: 0,
      coursesImported: 0,
      classesImported: 0,
      enrollmentsCreated: 0,
      sessionsCreated: 0,
    };

    return await prisma.$transaction(
      async (tx) => {
        // 1. Nạp Sinh viên
        if (files.studentFile) {
          const { validStudents, warnings } = await this.parseStudents(files.studentFile);
          allWarnings['students'] = warnings;

          for (const student of validStudents) {
            await tx.user.upsert({
              where: { userCode: student.userCode },
              update: student,
              create: student,
            });
          }
          summary.studentsImported = validStudents.length;
        }

        // 2. Nạp Giảng viên
        if (files.teacherFile) {
          const { validTeachers, warnings } = await this.parseTeachers(files.teacherFile);
          allWarnings['teachers'] = warnings;

          for (const teacher of validTeachers) {
            await tx.user.upsert({
              where: { userCode: teacher.userCode },
              update: teacher,
              create: teacher,
            });
          }
          summary.teachersImported = validTeachers.length;
        }

        // 3. Nạp Thời khóa biểu, Lớp HP và 15 Buổi học
        if (files.scheduleFile) {
          const { courses, courseClasses, warnings } = await this.parseSchedule(files.scheduleFile);
          allWarnings['schedule'] = warnings;

          // 3.1 Nạp Môn học
          const courseMap = new Map<string, string>();
          for (const course of courses) {
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

          // 3.2 Nạp Lớp học phần
          for (const cClass of courseClasses) {
            const teacher = await tx.user.findUnique({
              where: { userCode: cClass.teacherCode },
            });

            if (!teacher) {
              allWarnings['schedule'] = allWarnings['schedule'] || [];
              allWarnings['schedule'].push({
                row: 0,
                message: `Không tìm thấy Giảng viên với mã: ${cClass.teacherCode}`,
              });
              continue;
            }

            const courseId = courseMap.get(cClass.courseCode);
            if (!courseId) continue;

            // Tạo/Cập nhật phòng học nếu chưa có trong DB
            const room = await tx.classroom.upsert({
              where: { roomCode: cClass.roomCode },
              update: {},
              create: {
                roomCode: cClass.roomCode,
                building: cClass.roomCode.split('-')[0] || 'Tòa A',
                floor: parseInt(cClass.roomCode.split('-')[1]?.[0] || '1', 10),
                capacity: 60,
                cameraIp: '192.168.1.100',
                rtspUrl: `rtsp://192.168.1.100:554/live/${cClass.roomCode}`,
              },
            });

            const createdClass = await tx.courseClass.upsert({
              where: { classCode: cClass.classCode },
              update: {
                courseId,
                teacherId: teacher.id,
                semester: cClass.semester,
                academicYear: cClass.academicYear,
              },
              create: {
                classCode: cClass.classCode,
                courseId,
                teacherId: teacher.id,
                semester: cClass.semester,
                academicYear: cClass.academicYear,
              },
            });

            // 3.3 Gán sinh viên vào lớp học phần (Batching)
            const enrollmentsData: any[] = [];
            for (const mssv of cClass.studentCodes) {
              const student = await tx.user.findUnique({ where: { userCode: mssv } });
              if (student) {
                enrollmentsData.push({
                  courseClassId: createdClass.id,
                  studentId: student.id,
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

            // 3.4 Tự động sinh 15 buổi học (15 tuần)
            const [startH, startM] = cClass.startTimeStr.split(':').map(Number);
            const [endH, endM] = cClass.endTimeStr.split(':').map(Number);

            // Xóa ca học cũ của lớp này nếu có để nạp lại mới
            await tx.classSession.deleteMany({
              where: { courseClassId: createdClass.id },
            });

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
                classroomId: room.id,
                sessionNumber: sessionNum,
                sessionDate,
                startTime,
                endTime,
                topic: `Buổi ${sessionNum}: Giảng dạy theo đề cương`,
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
        maxWait: 10000,
        timeout: 30000,
      }
    );
  }
}

export const importService = new ImportService();
