import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { verifyToken } from '../middlewares/auth.middlewares'; 


const router = Router();

/**
 * @route   POST /api/v1/auth/login
 * @desc    Đăng nhập hệ thống SPAS (Admin, Teacher, Student)
 * @access  Public
 */
router.post('/login', (req, res, next) => authController.login(req, res, next));

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Tự động cấp lại Access Token mới từ Refresh Token
 * @access  Public
 */
router.post('/refresh', (req, res, next) => authController.refresh(req, res, next));

// Route Lấy thông tin cá nhân (Được bảo vệ - Bắt buộc phải có Token JWT hợp lệ)
router.get('/me', verifyToken, (req, res, next) => authController.getMe(req, res, next));
router.post('/change-password', verifyToken, (req, res, next) => authController.changePassword(req, res, next));

export default router;
