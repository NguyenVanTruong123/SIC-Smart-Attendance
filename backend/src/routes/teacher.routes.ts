import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { verifyToken, authorizeRoles } from '../middlewares/auth.middlewares';
import { teacherController } from '../controllers/teacher.controller';
import { teacherSessionController } from '../controllers/teacher-session.controller';
import { teacherWorkspaceController } from '../controllers/teacher-workspace.controller';

const router = Router();

// Tất cả route giảng viên yêu cầu xác thực JWT và Role = TEACHER hoặc ADMIN
router.use(verifyToken, authorizeRoles(UserRole.TEACHER, UserRole.ADMIN));

/**
 * @route   GET /api/v1/teacher/schedule
 * @desc    Lấy thời khóa biểu giảng dạy hàng tuần (Time Grid Calendar)
 * @access  Teacher / Admin
 */
router.get('/schedule', (req, res, next) => teacherController.getSchedule(req, res, next));
router.get('/sessions/:id', (req, res, next) => teacherSessionController.get(req, res, next));
router.post('/sessions/:id/start', (req, res, next) => teacherSessionController.start(req, res, next));
router.post('/sessions/:id/trigger-snapshot', (req, res, next) => teacherSessionController.capture(req, res, next));
router.put('/sessions/:id/attendance/:studentId/override', (req, res, next) => teacherSessionController.override(req, res, next));
router.post('/sessions/:id/end', (req, res, next) => teacherSessionController.end(req, res, next));
router.get('/sessions/:id/evidence/:evidenceId', (req, res, next) => teacherSessionController.evidence(req, res, next));
router.get('/leave-requests', (req, res, next) => teacherWorkspaceController.leaveRequests(req, res, next));
router.post('/sessions/:id/quick-approve-leave', (req, res, next) => teacherWorkspaceController.reviewLeave(req, res, next));
router.get('/reports/matrix', (req, res, next) => teacherWorkspaceController.reportMatrix(req, res, next));

export default router;
