import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { verifyToken, authorizeRoles } from '../middlewares/auth.middlewares';
import { uploadExcel } from '../middlewares/upload.middleware';
import { importController } from '../controllers/import.controller';
import { biometricController } from '../controllers/biometric.controller'; 
import { classroomController } from '../controllers/classroom.controller';
import { adminClassController } from '../controllers/admin-class.controller';
import { adminOverviewController } from '../controllers/admin-overview.controller';
import { adminAcademicController } from '../controllers/admin-academic.controller';
import { adminOpsController } from '../controllers/admin-ops.controller';

const router = Router();

// Tất cả các route bên dưới bắt buộc phải có Token JWT và có quyền ADMIN
router.use(verifyToken, authorizeRoles(UserRole.ADMIN));

// 0. Endpoint Tổng quan Thông số Hệ thống SPAS (Dashboard)
router.get('/overview', (req, res, next) => adminOverviewController.getOverview(req, res, next));
router.get('/health', (req, res, next) => adminOpsController.health(req, res, next));
router.get('/audit-logs', (req, res, next) => adminOpsController.auditLogs(req, res, next));
router.get('/reports/attendance', (req, res, next) => adminOpsController.report(req, res, next));

// 1. Endpoint Lấy danh sách Sinh trắc học & 4 Thẻ KPI (Màn hình 1.2)
router.get('/biometrics', (req, res, next) => biometricController.getBiometrics(req, res, next));
router.get('/biometrics/:userId', (req, res, next) => biometricController.getBiometricDetail(req, res, next));
router.post('/biometrics/:userId/reset', (req, res, next) => biometricController.resetBiometric(req, res, next));
router.get('/biometrics/:userId/preview', (req, res, next) => biometricController.preview(req, res, next));

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
router.get('/classrooms/:id', (req, res, next) => classroomController.getClassroomDetail(req, res, next));
router.post('/classrooms', (req, res, next) => classroomController.createClassroom(req, res, next));
router.put('/classrooms/:id', (req, res, next) => classroomController.updateClassroom(req, res, next));
router.delete('/classrooms/:id', (req, res, next) => classroomController.deleteClassroom(req, res, next));
router.post('/classrooms/ping-camera', (req, res, next) => classroomController.pingCamera(req, res, next));
router.post('/classrooms/:id/ping-camera', (req, res, next) => classroomController.pingCamera(req, res, next));

// 4. MODULE MÔN HỌC & LỚP HỌC PHẦN (TREE TABLE)
router.get('/classes', (req, res, next) => adminClassController.getClasses(req, res, next));

// 5. QUẢN LÝ ĐÀO TẠO
router.get('/users', (req, res, next) => adminAcademicController.users(req, res, next));
router.post('/users', (req, res, next) => adminAcademicController.createUser(req, res, next));
router.patch('/users/:id', (req, res, next) => adminAcademicController.updateUser(req, res, next));
router.delete('/users/:id', (req, res, next) => adminAcademicController.deleteUser(req, res, next));
router.get('/departments', (req, res, next) => adminAcademicController.departments(req, res, next));
router.post('/departments', (req, res, next) => adminAcademicController.createDepartment(req, res, next));
router.patch('/departments/:id', (req, res, next) => adminAcademicController.updateDepartment(req, res, next));
router.delete('/departments/:id', (req, res, next) => adminAcademicController.deleteDepartment(req, res, next));
router.get('/courses', (req, res, next) => adminAcademicController.courses(req, res, next));
router.post('/courses', (req, res, next) => adminAcademicController.createCourse(req, res, next));
router.patch('/courses/:id', (req, res, next) => adminAcademicController.updateCourse(req, res, next));
router.delete('/courses/:id', (req, res, next) => adminAcademicController.deleteCourse(req, res, next));
router.get('/course-classes', (req, res, next) => adminAcademicController.classes(req, res, next));
router.post('/course-classes', (req, res, next) => adminAcademicController.createClass(req, res, next));
router.patch('/course-classes/:id', (req, res, next) => adminAcademicController.updateClass(req, res, next));
router.delete('/course-classes/:id', (req, res, next) => adminAcademicController.deleteClass(req, res, next));
router.post('/course-classes/:id/enrollments', (req, res, next) => adminAcademicController.enroll(req, res, next));
router.delete('/course-classes/:id/enrollments/:studentId', (req, res, next) => adminAcademicController.removeEnrollment(req, res, next));
router.post('/sessions', (req, res, next) => adminAcademicController.createSession(req, res, next));
router.get('/sessions', (req, res, next) => adminAcademicController.sessions(req, res, next));
router.patch('/sessions/:id', (req, res, next) => adminAcademicController.updateSession(req, res, next));
router.delete('/sessions/:id', (req, res, next) => adminAcademicController.deleteSession(req, res, next));

export default router;
