import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { verifyToken, authorizeRoles } from '../middlewares/auth.middlewares';
import { teacherController } from '../controllers/teacher.controller';

const router = Router();

// Tất cả route giảng viên yêu cầu xác thực JWT và Role = TEACHER hoặc ADMIN
router.use(verifyToken, authorizeRoles(UserRole.TEACHER, UserRole.ADMIN));

/**
 * @route   GET /api/v1/teacher/schedule
 * @desc    Lấy thời khóa biểu giảng dạy hàng tuần (Time Grid Calendar)
 * @access  Teacher / Admin
 */
router.get('/schedule', (req, res, next) => teacherController.getSchedule(req, res, next));

export default router;
