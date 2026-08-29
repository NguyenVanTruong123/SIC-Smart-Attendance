import prisma from '../config/prisma';
import { aiClientService } from './ai-client.service';

export class AdminOpsService {
  async health() {
    const [cameras, liveSessions] = await Promise.all([
      prisma.classroom.groupBy({ by: ['cameraStatus'], _count: { _all: true } }),
      prisma.classSession.count({ where: { status: { in: ['LIVE_NOW', 'DEGRADED'] } } }),
    ]);
    let ai: { status: string; device?: string } | { status: string; error: string };
    try { ai = await aiClientService.health(); } catch (error) { ai = { status: 'DOWN', error: error instanceof Error ? error.message : 'AI service unavailable' }; }
    return { ai, liveSessions, cameras: Object.fromEntries(cameras.map((item) => [item.cameraStatus, item._count._all])) };
  }

  async auditLogs(query: { search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 25)));
    const where = query.search ? { OR: [{ actionType: { equals: query.search.toUpperCase() as any } }, { description: { contains: query.search, mode: 'insensitive' as const } }] } : undefined;
    const [items, total] = await Promise.all([
      prisma.systemAuditLog.findMany({ where, include: { actor: { select: { userCode: true, fullName: true, role: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.systemAuditLog.count({ where }),
    ]);
    return { items, pagination: { page, limit, totalItems: total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
  }

  async attendanceReport(query: { courseClassId?: string; from?: string; to?: string }) {
    const logs = await prisma.attendanceLog.findMany({
      where: { session: { courseClassId: query.courseClassId, ...(query.from || query.to ? { sessionDate: { gte: query.from ? new Date(query.from) : undefined, lte: query.to ? new Date(query.to) : undefined } } : {}) } },
      include: { student: { select: { userCode: true, fullName: true } }, session: { include: { courseClass: { include: { course: true } } } } },
    });
    const summary = logs.reduce((result, log) => { const key = log.student.userCode; const row = result[key] || { studentCode: key, fullName: log.student.fullName, present: 0, late: 0, absent: 0, excused: 0, total: 0 }; row.total += 1; if (log.status === 'PRESENT') row.present += 1; if (log.status === 'LATE') row.late += 1; if (log.status === 'ABSENT' || log.status === 'TRUANT') row.absent += 1; if (log.status === 'EXCUSED') row.excused += 1; result[key] = row; return result; }, {} as Record<string, { studentCode: string; fullName: string; present: number; late: number; absent: number; excused: number; total: number }>);
    return Object.values(summary).map((row) => ({ ...row, attendanceRate: row.total ? Math.round(((row.present + row.late) / row.total) * 10000) / 100 : 0 }));
  }

  async attendanceReportCsv(query: { courseClassId?: string; from?: string; to?: string }) {
    const rows = await this.attendanceReport(query);
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    return [
      ['Mã SV', 'Họ tên', 'Tổng buổi', 'Đúng giờ', 'Đi muộn', 'Vắng', 'Có phép', 'Tỷ lệ (%)'],
      ...rows.map((row) => [row.studentCode, row.fullName, row.total, row.present, row.late, row.absent, row.excused, row.attendanceRate]),
    ].map((row) => row.map(escape).join(',')).join('\r\n');
  }
}

export const adminOpsService = new AdminOpsService();
