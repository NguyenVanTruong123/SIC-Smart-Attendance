import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { verifyToken, authorizeRoles } from '../middlewares/auth.middlewares';
import { uploadExcel } from '../middlewares/upload.middleware';
import { importController } from '../controllers/import.controller';

const router = Router();

// Tất cả các route bên dưới bắt buộc phải có Token JWT và có quyền ADMIN
router.use(verifyToken, authorizeRoles(UserRole.ADMIN));

// Endpoint Import File Excel 3-trong-1 (Modal 1.2.1)
router.post(
  '/import/excel-bundle',
  uploadExcel.fields([
    { name: 'student_file', maxCount: 1 },
    { name: 'teacher_file', maxCount: 1 },
    { name: 'schedule_file', maxCount: 1 },
  ]),
  (req, res, next) => importController.importBundle(req, res, next)
);

export default router;
