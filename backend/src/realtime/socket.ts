import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { UserRole } from '@prisma/client';
import prisma from '../config/prisma';
import { verifyAccessToken, type JwtPayload } from '../utils/jwt';

let attendanceNamespace: ReturnType<Server['of']> | null = null;

export function initRealtime(httpServer: HttpServer) {
  const io = new Server(httpServer, { path: '/ws', cors: { origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true } });
  attendanceNamespace = io.of('/attendance');
  attendanceNamespace.use((socket, next) => {
    try {
      const token = String(socket.handshake.auth?.token || socket.handshake.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (!token) return next(new Error('Unauthorized'));
      socket.data.user = verifyAccessToken(token) as JwtPayload;
      return next();
    } catch { return next(new Error('Unauthorized')); }
  });
  attendanceNamespace.on('connection', (socket) => {
    socket.on('attendance:join_session', async ({ sessionId }: { sessionId?: string }) => {
      if (!sessionId) return socket.emit('attendance:error', { message: 'sessionId là bắt buộc.' });
      const user = socket.data.user as JwtPayload;
      const session = await prisma.classSession.findUnique({ where: { id: sessionId }, select: { courseClass: { select: { teacherId: true } } } });
      if (!session || (user.role !== UserRole.ADMIN && session.courseClass.teacherId !== user.userId)) {
        return socket.emit('attendance:error', { message: 'Bạn không có quyền xem phiên học này.' });
      }
      await socket.join(`session:${sessionId}`);
      socket.emit('attendance:joined', { sessionId });
    });
    socket.on('attendance:leave_session', ({ sessionId }: { sessionId?: string }) => {
      if (sessionId) void socket.leave(`session:${sessionId}`);
    });
  });
  return io;
}

export function emitSessionEvent(sessionId: string, event: string, payload: unknown) {
  attendanceNamespace?.to(`session:${sessionId}`).emit(event, payload);
}
