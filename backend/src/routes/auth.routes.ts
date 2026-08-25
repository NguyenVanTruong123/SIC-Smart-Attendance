import { Router } from 'express';
import { authController } from '../controllers/auth.controller';

const router = Router();

/**
 * @route   POST /api/v1/auth/login
 * @desc    Đăng nhập hệ thống SPAS (Admin, Teacher, Student)
 * @access  Public
 */
router.post('/login', (req, res, next) => authController.login(req, res, next));

export default router;
