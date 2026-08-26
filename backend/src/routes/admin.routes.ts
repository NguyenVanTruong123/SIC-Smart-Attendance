import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { verifyToken, authorizeRoles } from '../middlewares/auth.middlewares';
import { uploadExcel } from '../middlewares/upload.middleware';
import { importController } from '../controllers/import.controller';
import { biometricController } from '../controllers/biometric.controller'; 
import { classroomController } from '../controllers/classroom.controller';

const router = Router();

// Tất cả các route bên dưới bắt buộc phải có Token JWT và có quyền ADMIN
router.use(verifyToken, authorizeRoles(UserRole.ADMIN));

// 1. Endpoint Lấy danh sách Sinh trắc học & 4 Thẻ KPI (Màn hình 1.2)
router.get('/biometrics', (req, res, next) => biometricController.getBiometrics(req, res, next));

// 2. Endpoint Import File Excel 3-trong-1 (Modal 1.2.1)
router.post(
  '/import/excel-bundle',
  uploadExcel.fields([
    { name: 'student_file', maxCount: 1 },
    { name: 'teacher_file', maxCount: 1 },
    { name: 'schedule_file', maxCount: 1 },
  ]),
  (req, res, next) => importController.importBundle(req, res, next)
);

// 3. MODULE PHÒNG HỌC & CAMERA IP
router.get('/classrooms', (req, res, next) => classroomController.getClassrooms(req, res, next));
router.post('/classrooms', (req, res, next) => classroomController.createClassroom(req, res, next));
router.put('/classrooms/:id', (req, res, next) => classroomController.updateClassroom(req, res, next));
router.delete('/classrooms/:id', (req, res, next) => classroomController.deleteClassroom(req, res, next));


export default router;
