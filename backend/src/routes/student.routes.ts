import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { studentController } from '../controllers/student.controller';
import { authorizeRoles, verifyToken } from '../middlewares/auth.middlewares';
import { uploadAttachment } from '../middlewares/upload.middleware';

const router = Router();
router.use(verifyToken, authorizeRoles(UserRole.STUDENT));
router.get('/dashboard', (req, res, next) => studentController.dashboard(req, res, next));
router.get('/attendance-history', (req, res, next) => studentController.attendanceHistory(req, res, next));
router.get('/leave-requests', (req, res, next) => studentController.listLeaveRequests(req, res, next));
router.post('/leave-requests', uploadAttachment.single('attachment_file'), (req, res, next) => studentController.createLeaveRequest(req, res, next));
router.get('/evidence/:evidenceId', (req, res, next) => studentController.evidence(req, res, next));
router.get('/biometric-profile', (req, res, next) => studentController.biometricProfile(req, res, next));
router.get('/face-preview', (req, res, next) => studentController.enrollmentPreview(req, res, next));
export default router;
