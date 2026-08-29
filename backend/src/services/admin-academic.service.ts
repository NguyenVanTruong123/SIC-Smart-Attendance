import bcrypt from 'bcrypt';
import { AuditActionType, Prisma, SessionStatus, UserRole, UserStatus } from '@prisma/client';
import prisma from '../config/prisma';
import { periodLabel, resolvePeriodRange, timeOnDate } from '../utils/study-periods';

function error(message: string, statusCode = 422) {
  return Object.assign(new Error(message), { statusCode });
}

function date(value: unknown, field: string) {
  const parsed = new Date(String(value));
  if (!value || Number.isNaN(parsed.getTime())) throw error(`${field} không hợp lệ.`);
  return parsed;
}

function sessionTime(value: unknown, sessionDate: Date, field: string) {
  if (typeof value === 'string' && /^\d{1,2}:\d{2}$/.test(value.trim())) {
    try {
      return timeOnDate(sessionDate, value.trim());
    } catch (caught) {
      throw error((caught as Error).message);
    }
  }
  return date(value, field);
}

function sessionTiming(input: Record<string, unknown>, sessionDate: Date, fallback?: { startTime: Date; endTime: Date; periodStart?: number | null; periodEnd?: number | null }) {
  const hasPeriodInput = input.periodStart !== undefined || input.periodEnd !== undefined || input.period !== undefined;
  if (hasPeriodInput) {
    try {
      const range = resolvePeriodRange(input.periodStart, input.periodEnd, input.period);
      if (!range) throw error('Ca học là bắt buộc.');
      return {
        startTime: timeOnDate(sessionDate, range.startTime),
        endTime: timeOnDate(sessionDate, range.endTime),
        periodStart: range.periodStart,
        periodEnd: range.periodEnd,
      };
    } catch (caught) {
      if ((caught as { statusCode?: number }).statusCode) throw caught;
      throw error((caught as Error).message);
    }
  }

  const startTime = input.startTime === undefined ? fallback?.startTime : sessionTime(input.startTime, sessionDate, 'startTime');
  const endTime = input.endTime === undefined ? fallback?.endTime : sessionTime(input.endTime, sessionDate, 'endTime');
  if (!startTime || !endTime) throw error('startTime và endTime là bắt buộc.');
  return { startTime, endTime, periodStart: fallback?.periodStart ?? null, periodEnd: fallback?.periodEnd ?? null };
}

async function assertSessionAvailable(
  client: Prisma.TransactionClient,
  values: { courseClassId: string; classroomId: string; sessionDate: Date; startTime: Date; endTime: Date; excludeId?: string },
) {
  const baseWhere: Prisma.ClassSessionWhereInput = {
    sessionDate: values.sessionDate,
    status: { not: SessionStatus.CANCELLED },
    startTime: { lt: values.endTime },
    endTime: { gt: values.startTime },
    ...(values.excludeId ? { id: { not: values.excludeId } } : {}),
  };
  const [roomConflict, classConflict] = await Promise.all([
    client.classSession.findFirst({ where: { ...baseWhere, classroomId: values.classroomId }, select: { id: true } }),
    client.classSession.findFirst({ where: { ...baseWhere, courseClassId: values.courseClassId }, select: { id: true } }),
  ]);
  if (roomConflict) throw error('Phòng học đã có lịch trùng trong cùng thời gian.', 409);
  if (classConflict) throw error('Lớp học phần đã có ca trùng trong cùng thời gian.', 409);
}

function isDatabaseOverlapError(value: unknown) {
  const candidate = value as { code?: string; meta?: { code?: string } };
  return candidate?.code === 'P2010' && candidate.meta?.code === '23P01';
}

export class AdminAcademicService {
  async listUsers(query: { search?: string; role?: UserRole; page?: number; limit?: number }) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = {
      role: query.role,
      OR: search ? [
        { userCode: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } },
        { className: { contains: search, mode: 'insensitive' } },
      ] : undefined,
    };
    const [items, total] = await Promise.all([
      prisma.user.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, select: { id: true, userCode: true, email: true, fullName: true, role: true, department: true, departmentId: true, className: true, phone: true, status: true, isFaceEnrolled: true, avatarUrl: true, createdAt: true } }),
      prisma.user.count({ where }),
    ]);
    return { items, pagination: { page, limit, totalItems: total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
  }

  async createUser(actorId: string, input: Record<string, unknown>) {
    const userCode = String(input.userCode || '').trim();
    const email = String(input.email || '').trim().toLowerCase();
    const fullName = String(input.fullName || '').trim();
    const password = String(input.password || '');
    const role = input.role as UserRole;
    if (!userCode || !email || !fullName || password.length < 8 || !Object.values(UserRole).includes(role)) throw error('userCode, email, fullName, password (tối thiểu 8 ký tự) và role là bắt buộc.');
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { userCode, email, fullName, passwordHash: await bcrypt.hash(password, 10), role, department: typeof input.department === 'string' ? input.department : null, departmentId: typeof input.departmentId === 'string' ? input.departmentId : null, className: typeof input.className === 'string' ? input.className : null, phone: typeof input.phone === 'string' ? input.phone : null } });
      await tx.systemAuditLog.create({ data: { actorId, actionType: AuditActionType.ADMIN_DATA_CHANGE, targetTable: 'users', targetId: created.id, afterState: { userCode, role }, description: 'Admin tạo tài khoản.' } });
      return created;
    });
    return { id: user.id, userCode: user.userCode, role: user.role };
  }

  async updateUser(actorId: string, userId: string, input: Record<string, unknown>) {
    const before = await prisma.user.findUnique({ where: { id: userId } });
    if (!before) throw error('Không tìm thấy tài khoản.', 404);
    const data: Prisma.UserUpdateInput = {};
    for (const field of ['fullName', 'department', 'className', 'phone', 'email'] as const) if (typeof input[field] === 'string') data[field] = input[field] as string;
    if (input.role && Object.values(UserRole).includes(input.role as UserRole)) data.role = input.role as UserRole;
    if (input.status && Object.values(UserStatus).includes(input.status as UserStatus)) data.status = input.status as UserStatus;
    if (typeof input.password === 'string' && input.password.length >= 8) data.passwordHash = await bcrypt.hash(input.password, 10);
    const after = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id: userId }, data });
      await tx.systemAuditLog.create({ data: { actorId, actionType: AuditActionType.ADMIN_DATA_CHANGE, targetTable: 'users', targetId: userId, beforeState: { fullName: before.fullName, role: before.role, status: before.status }, afterState: { fullName: updated.fullName, role: updated.role, status: updated.status }, description: 'Admin cập nhật tài khoản.' } });
      return updated;
    });
    return { id: after.id, userCode: after.userCode, role: after.role, status: after.status };
  }

  async deactivateUser(actorId: string, userId: string) {
    return this.updateUser(actorId, userId, { status: UserStatus.INACTIVE });
  }

  async departments(search?: string) {
    return prisma.department.findMany({ where: search ? { OR: [{ code: { contains: search, mode: 'insensitive' } }, { name: { contains: search, mode: 'insensitive' } }] } : undefined, orderBy: { code: 'asc' }, include: { _count: { select: { users: true } } } });
  }

  async createDepartment(actorId: string, input: Record<string, unknown>) {
    const code = String(input.code || '').trim();
    const name = String(input.name || '').trim();
    if (!code || !name) throw error('code và name là bắt buộc.');
    const department = await prisma.department.create({ data: { code, name } });
    await prisma.systemAuditLog.create({ data: { actorId, actionType: AuditActionType.ADMIN_DATA_CHANGE, targetTable: 'departments', targetId: department.id, afterState: { code, name }, description: 'Admin tạo khoa.' } });
    return department;
  }

  async updateDepartment(actorId: string, id: string, input: Record<string, unknown>) {
    const before = await prisma.department.findUnique({ where: { id } });
    if (!before) throw error('Không tìm thấy khoa.', 404);
    const code = typeof input.code === 'string' ? input.code.trim() : before.code;
    const name = typeof input.name === 'string' ? input.name.trim() : before.name;
    if (!code || !name) throw error('code và name là bắt buộc.');
    const updated = await prisma.department.update({ where: { id }, data: { code, name } });
    await prisma.systemAuditLog.create({ data: { actorId, actionType: AuditActionType.ADMIN_DATA_CHANGE, targetTable: 'departments', targetId: id, beforeState: before, afterState: updated, description: 'Admin cập nhật khoa.' } });
    return updated;
  }

  async deleteDepartment(actorId: string, id: string) {
    if (await prisma.user.count({ where: { departmentId: id } })) throw error('Không thể xóa khoa đang có tài khoản.', 409);
    await prisma.department.delete({ where: { id } });
    await prisma.systemAuditLog.create({ data: { actorId, actionType: AuditActionType.ADMIN_DATA_CHANGE, targetTable: 'departments', targetId: id, description: 'Admin xóa khoa.' } });
    return { deleted: true };
  }

  async courses(search?: string) {
    return prisma.course.findMany({ where: search ? { OR: [{ courseCode: { contains: search, mode: 'insensitive' } }, { courseName: { contains: search, mode: 'insensitive' } }] } : undefined, include: { _count: { select: { courseClasses: true } } }, orderBy: { courseCode: 'asc' } });
  }

  async createCourse(actorId: string, input: Record<string, unknown>) {
    const courseCode = String(input.courseCode || '').trim();
    const courseName = String(input.courseName || '').trim();
    const credits = Number(input.credits);
    if (!courseCode || !courseName || !Number.isInteger(credits) || credits < 1) throw error('courseCode, courseName và credits hợp lệ là bắt buộc.');
    const course = await prisma.course.create({ data: { courseCode, courseName, credits, totalSessions: Number(input.totalSessions || 15) } });
    await prisma.systemAuditLog.create({ data: { actorId, actionType: AuditActionType.ADMIN_DATA_CHANGE, targetTable: 'courses', targetId: course.id, afterState: { courseCode, courseName }, description: 'Admin tạo môn học.' } });
    return course;
  }

  async updateCourse(actorId: string, id: string, input: Record<string, unknown>) {
    const before = await prisma.course.findUnique({ where: { id } });
    if (!before) throw error('Không tìm thấy môn học.', 404);
    const data = {
      courseCode: typeof input.courseCode === 'string' ? input.courseCode.trim() : before.courseCode,
      courseName: typeof input.courseName === 'string' ? input.courseName.trim() : before.courseName,
      credits: input.credits === undefined ? before.credits : Number(input.credits),
      totalSessions: input.totalSessions === undefined ? before.totalSessions : Number(input.totalSessions),
    };
    if (!data.courseCode || !data.courseName || !Number.isInteger(data.credits) || data.credits < 1) throw error('Thông tin môn học không hợp lệ.');
    const updated = await prisma.course.update({ where: { id }, data });
    await prisma.systemAuditLog.create({ data: { actorId, actionType: AuditActionType.ADMIN_DATA_CHANGE, targetTable: 'courses', targetId: id, beforeState: before, afterState: updated, description: 'Admin cập nhật môn học.' } });
    return updated;
  }

  async deleteCourse(actorId: string, id: string) {
    if (await prisma.courseClass.count({ where: { courseId: id } })) throw error('Không thể xóa môn đã có lớp học phần.', 409);
    await prisma.course.delete({ where: { id } });
    await prisma.systemAuditLog.create({ data: { actorId, actionType: AuditActionType.ADMIN_DATA_CHANGE, targetTable: 'courses', targetId: id, description: 'Admin xóa môn học.' } });
    return { deleted: true };
  }

  async courseClasses(search?: string, semester?: string) {
    return prisma.courseClass.findMany({ where: { semester: semester && semester !== 'ALL' ? semester : undefined, ...(search ? { OR: [{ classCode: { contains: search, mode: 'insensitive' } }, { semester: { contains: search, mode: 'insensitive' } }, { academicYear: { contains: search, mode: 'insensitive' } }, { course: { courseCode: { contains: search, mode: 'insensitive' } } }, { course: { courseName: { contains: search, mode: 'insensitive' } } }, { teacher: { userCode: { contains: search, mode: 'insensitive' } } }, { teacher: { fullName: { contains: search, mode: 'insensitive' } } }] } : {}) }, include: { course: true, teacher: { select: { id: true, userCode: true, fullName: true } }, _count: { select: { enrollments: true, sessions: true } } }, orderBy: { classCode: 'asc' } });
  }

  async createCourseClass(actorId: string, input: Record<string, unknown>) {
    const courseId = String(input.courseId || '');
    const teacherId = String(input.teacherId || '');
    const classCode = String(input.classCode || '').trim();
    const semester = String(input.semester || '').trim();
    const academicYear = String(input.academicYear || '').trim();
    const scheduleFields = ['classroomId', 'sessionDate', 'sessionNumber', 'periodStart', 'periodEnd', 'period', 'startTime', 'endTime'];
    const hasInitialSchedule = scheduleFields.some((field) => input[field] !== undefined && String(input[field] ?? '').trim() !== '');
    const classroomId = String(input.classroomId || '');
    const sessionNumber = Number(input.sessionNumber ?? 1);
    const sessionDate = hasInitialSchedule ? date(input.sessionDate, 'sessionDate') : null;
    const timing = sessionDate ? sessionTiming(input, sessionDate) : null;
    if (hasInitialSchedule && (!classroomId || !Number.isInteger(sessionNumber) || sessionNumber < 1 || !timing || timing.endTime <= timing.startTime)) {
      throw error('Phòng học, ngày học, ca học và buổi số hợp lệ là bắt buộc.');
    }
    const [course, teacher, classroom] = await Promise.all([
      prisma.course.findUnique({ where: { id: courseId } }),
      prisma.user.findFirst({ where: { id: teacherId, role: UserRole.TEACHER } }),
      hasInitialSchedule ? prisma.classroom.findUnique({ where: { id: classroomId } }) : Promise.resolve(null),
    ]);
    if (!course || !teacher || !classCode || !semester || !academicYear) throw error('course, giảng viên và thông tin lớp là bắt buộc.', 404);
    if (hasInitialSchedule && !classroom) throw error('Không tìm thấy phòng học.', 404);
    try {
      const created = await prisma.$transaction(async (tx) => {
        const item = await tx.courseClass.create({ data: { courseId, teacherId, classCode, semester, academicYear } });
        let session = null;
        if (sessionDate && timing) {
          await assertSessionAvailable(tx, { courseClassId: item.id, classroomId, sessionDate, ...timing });
          session = await tx.classSession.create({
            data: {
              courseClassId: item.id,
              classroomId,
              sessionNumber,
              sessionDate,
              startTime: timing.startTime,
              endTime: timing.endTime,
              periodStart: timing.periodStart,
              periodEnd: timing.periodEnd,
              topic: typeof input.topic === 'string' ? input.topic : null,
            },
          });
        }
        await tx.systemAuditLog.create({
          data: {
            actorId,
            actionType: AuditActionType.ADMIN_DATA_CHANGE,
            targetTable: 'course_classes',
            targetId: item.id,
            afterState: {
              classCode,
              courseId,
              teacherId,
              initialSessionId: session?.id ?? null,
              sessionNumber: session?.sessionNumber ?? null,
              periodStart: timing?.periodStart ?? null,
              periodEnd: timing?.periodEnd ?? null,
            },
            description: session ? 'Admin tạo lớp học phần và ca học đầu tiên.' : 'Admin tạo lớp học phần.',
          },
        });
        return item;
      });
      return created;
    } catch (caught) {
      if (isDatabaseOverlapError(caught)) throw error('Phòng học hoặc lớp học phần đã có lịch trùng trong cùng thời gian.', 409);
      throw caught;
    }
  }

  async updateCourseClass(actorId: string, id: string, input: Record<string, unknown>) {
    const before = await prisma.courseClass.findUnique({ where: { id } });
    if (!before) throw error('Không tìm thấy lớp học phần.', 404);
    const data: Prisma.CourseClassUpdateInput = {};
    for (const field of ['classCode', 'semester', 'academicYear'] as const) if (typeof input[field] === 'string' && String(input[field]).trim()) data[field] = String(input[field]).trim();
    if (typeof input.status === 'string' && ['ACTIVE', 'COMPLETED', 'ARCHIVED'].includes(input.status)) data.status = input.status as any;
    const updated = await prisma.courseClass.update({ where: { id }, data });
    await prisma.systemAuditLog.create({ data: { actorId, actionType: AuditActionType.ADMIN_DATA_CHANGE, targetTable: 'course_classes', targetId: id, beforeState: before, afterState: updated, description: 'Admin cập nhật lớp học phần.' } });
    return updated;
  }

  async deleteCourseClass(actorId: string, id: string) {
    const [enrollments, sessions] = await Promise.all([prisma.courseEnrollment.count({ where: { courseClassId: id } }), prisma.classSession.count({ where: { courseClassId: id } })]);
    if (enrollments || sessions) throw error('Không thể xóa lớp đã có dữ liệu; hãy chuyển trạng thái ARCHIVED.', 409);
    await prisma.courseClass.delete({ where: { id } });
    await prisma.systemAuditLog.create({ data: { actorId, actionType: AuditActionType.ADMIN_DATA_CHANGE, targetTable: 'course_classes', targetId: id, description: 'Admin xóa lớp học phần.' } });
    return { deleted: true };
  }

  async enrollStudent(actorId: string, courseClassId: string, studentId: string) {
    const student = await prisma.user.findFirst({ where: { id: studentId, role: UserRole.STUDENT } });
    if (!student) throw error('Không tìm thấy sinh viên.', 404);
    const enrollment = await prisma.courseEnrollment.create({ data: { courseClassId, studentId } });
    await prisma.systemAuditLog.create({ data: { actorId, actionType: AuditActionType.ADMIN_DATA_CHANGE, targetTable: 'course_enrollments', targetId: enrollment.id, afterState: { courseClassId, studentId }, description: 'Admin xếp sinh viên vào lớp.' } });
    return enrollment;
  }

  async removeEnrollment(actorId: string, courseClassId: string, studentId: string) {
    const enrollment = await prisma.courseEnrollment.findUnique({ where: { uq_course_student: { courseClassId, studentId } } });
    if (!enrollment) throw error('Sinh viên không thuộc lớp.', 404);
    await prisma.courseEnrollment.delete({ where: { id: enrollment.id } });
    await prisma.systemAuditLog.create({ data: { actorId, actionType: AuditActionType.ADMIN_DATA_CHANGE, targetTable: 'course_enrollments', targetId: enrollment.id, beforeState: { courseClassId, studentId }, description: 'Admin gỡ sinh viên khỏi lớp.' } });
    return { removed: true };
  }

  async createSession(actorId: string, input: Record<string, unknown>) {
    const courseClassId = String(input.courseClassId || '');
    const classroomId = String(input.classroomId || '');
    const sessionNumber = Number(input.sessionNumber);
    const sessionDate = date(input.sessionDate, 'sessionDate');
    const timing = sessionTiming(input, sessionDate);
    if (!courseClassId || !classroomId || !Number.isInteger(sessionNumber) || timing.endTime <= timing.startTime) throw error('Thông tin ca học không hợp lệ.');

    try {
      return await prisma.$transaction(async (tx) => {
        await assertSessionAvailable(tx, { courseClassId, classroomId, sessionDate, ...timing });
        const session = await tx.classSession.create({
          data: {
            courseClassId,
            classroomId,
            sessionNumber,
            sessionDate,
            startTime: timing.startTime,
            endTime: timing.endTime,
            periodStart: timing.periodStart,
            periodEnd: timing.periodEnd,
            topic: typeof input.topic === 'string' ? input.topic : null,
          },
        });
        await tx.systemAuditLog.create({ data: { actorId, actionType: AuditActionType.ADMIN_DATA_CHANGE, targetTable: 'class_sessions', targetId: session.id, afterState: { courseClassId, classroomId, sessionDate, startTime: timing.startTime, endTime: timing.endTime, periodStart: timing.periodStart, periodEnd: timing.periodEnd }, description: 'Admin tạo lịch học.' } });
        return session;
      });
    } catch (caught) {
      if (isDatabaseOverlapError(caught)) throw error('Phòng học hoặc lớp học phần đã có lịch trùng trong cùng thời gian.', 409);
      throw caught;
    }
  }

  async sessions(search?: string, dateValue?: string) {
    const where: Prisma.ClassSessionWhereInput = {
      sessionDate: dateValue ? date(dateValue, 'sessionDate') : undefined,
      ...(search ? { OR: [{ courseClass: { classCode: { contains: search, mode: 'insensitive' } } }, { courseClass: { course: { courseName: { contains: search, mode: 'insensitive' } } } }, { classroom: { roomCode: { contains: search, mode: 'insensitive' } } }] } : {}),
    };
    const sessions = await prisma.classSession.findMany({ where, include: { courseClass: { include: { course: true, teacher: { select: { userCode: true, fullName: true } } } }, classroom: { select: { roomCode: true } } }, orderBy: [{ sessionDate: 'desc' }, { startTime: 'asc' }] });
    return sessions.map((session) => ({
      ...session,
      periodLabel: periodLabel(session.periodStart, session.periodEnd),
    }));
  }

  async updateSession(actorId: string, id: string, input: Record<string, unknown>) {
    const before = await prisma.classSession.findUnique({ where: { id } });
    if (!before) throw error('Không tìm thấy lịch học.', 404);
    const sessionDate = input.sessionDate === undefined ? before.sessionDate : date(input.sessionDate, 'sessionDate');
    const classroomId = input.classroomId === undefined ? before.classroomId : String(input.classroomId || '');
    if (!classroomId) throw error('classroomId không hợp lệ.');
    const timing = sessionTiming(input, sessionDate, before);
    if (timing.endTime <= timing.startTime) throw error('Khoảng ca học không hợp lệ.');
    const data: Prisma.ClassSessionUncheckedUpdateInput = {
      sessionDate,
      classroomId,
      startTime: timing.startTime,
      endTime: timing.endTime,
      periodStart: timing.periodStart,
      periodEnd: timing.periodEnd,
    };
    if (input.topic !== undefined) data.topic = typeof input.topic === 'string' ? input.topic : null;
    const nextStatus = input.status === undefined ? before.status : input.status;
    if (typeof nextStatus !== 'string' || !['SCHEDULED', 'CANCELLED'].includes(nextStatus)) throw error('status không hợp lệ.');
    data.status = nextStatus as SessionStatus;

    try {
      const updated = await prisma.$transaction(async (tx) => {
        if (nextStatus !== SessionStatus.CANCELLED) await assertSessionAvailable(tx, { courseClassId: before.courseClassId, classroomId, sessionDate, ...timing, excludeId: id });
        const saved = await tx.classSession.update({ where: { id }, data });
        await tx.systemAuditLog.create({ data: { actorId, actionType: AuditActionType.ADMIN_DATA_CHANGE, targetTable: 'class_sessions', targetId: id, beforeState: before, afterState: saved, description: 'Admin cập nhật lịch học.' } });
        return saved;
      });
      return updated;
    } catch (caught) {
      if (isDatabaseOverlapError(caught)) throw error('Phòng học hoặc lớp học phần đã có lịch trùng trong cùng thời gian.', 409);
      throw caught;
    }
  }

  async deleteSession(actorId: string, id: string) {
    const session = await prisma.classSession.findUnique({ where: { id } });
    if (!session) throw error('Không tìm thấy lịch học.', 404);
    if (session.status === 'LIVE_NOW' || session.status === 'COMPLETED') throw error('Không thể xóa phiên đã diễn ra.', 409);
    await prisma.classSession.update({ where: { id }, data: { status: 'CANCELLED' } });
    await prisma.systemAuditLog.create({ data: { actorId, actionType: AuditActionType.ADMIN_DATA_CHANGE, targetTable: 'class_sessions', targetId: id, description: 'Admin hủy lịch học.' } });
    return { cancelled: true };
  }
}

export const adminAcademicService = new AdminAcademicService();
