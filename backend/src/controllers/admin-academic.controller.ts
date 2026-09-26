import { NextFunction, Response } from 'express';
import { UserRole } from '@prisma/client';
import { AuthenticatedRequest } from '../middlewares/auth.middlewares';
import { adminAcademicService } from '../services/admin-academic.service';

export class AdminAcademicController {
  async users(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { return res.json({ success: true, data: await adminAcademicService.listUsers({ search: req.query.search as string, role: req.query.role as UserRole, page: Number(req.query.page || 1), limit: Number(req.query.limit || 20) }) }); } catch (e) { next(e); } }
  async createUser(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { return res.status(201).json({ success: true, data: await adminAcademicService.createUser(req.user!.userId, req.body) }); } catch (e) { next(e); } }
  async updateUser(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { return res.json({ success: true, data: await adminAcademicService.updateUser(req.user!.userId, req.params.id, req.body) }); } catch (e) { next(e); } }
  async deleteUser(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { return res.json({ success: true, data: await adminAcademicService.deactivateUser(req.user!.userId, req.params.id) }); } catch (e) { next(e); } }
  async departments(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { return res.json({ success: true, data: await adminAcademicService.departments(req.query.search as string) }); } catch (e) { next(e); } }
  async createDepartment(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { return res.status(201).json({ success: true, data: await adminAcademicService.createDepartment(req.user!.userId, req.body) }); } catch (e) { next(e); } }
  async updateDepartment(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { return res.json({ success: true, data: await adminAcademicService.updateDepartment(req.user!.userId, req.params.id, req.body) }); } catch (e) { next(e); } }
  async deleteDepartment(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { return res.json({ success: true, data: await adminAcademicService.deleteDepartment(req.user!.userId, req.params.id) }); } catch (e) { next(e); } }
  async courses(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { return res.json({ success: true, data: await adminAcademicService.courses(req.query.search as string) }); } catch (e) { next(e); } }
  async createCourse(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { return res.status(201).json({ success: true, data: await adminAcademicService.createCourse(req.user!.userId, req.body) }); } catch (e) { next(e); } }
  async updateCourse(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { return res.json({ success: true, data: await adminAcademicService.updateCourse(req.user!.userId, req.params.id, req.body) }); } catch (e) { next(e); } }
  async deleteCourse(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { return res.json({ success: true, data: await adminAcademicService.deleteCourse(req.user!.userId, req.params.id) }); } catch (e) { next(e); } }
  async classes(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { return res.json({ success: true, data: await adminAcademicService.courseClasses(req.query.search as string, req.query.semester as string) }); } catch (e) { next(e); } }
  async createClass(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { return res.status(201).json({ success: true, data: await adminAcademicService.createCourseClass(req.user!.userId, req.body) }); } catch (e) { next(e); } }
  async updateClass(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { return res.json({ success: true, data: await adminAcademicService.updateCourseClass(req.user!.userId, req.params.id, req.body) }); } catch (e) { next(e); } }
  async deleteClass(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { return res.json({ success: true, data: await adminAcademicService.deleteCourseClass(req.user!.userId, req.params.id) }); } catch (e) { next(e); } }
  async enroll(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { return res.status(201).json({ success: true, data: await adminAcademicService.enrollStudent(req.user!.userId, req.params.id, req.body.studentId) }); } catch (e) { next(e); } }
  async removeEnrollment(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { return res.json({ success: true, data: await adminAcademicService.removeEnrollment(req.user!.userId, req.params.id, req.params.studentId) }); } catch (e) { next(e); } }
  async createSession(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { return res.status(201).json({ success: true, data: await adminAcademicService.createSession(req.user!.userId, req.body) }); } catch (e) { next(e); } }
  async sessions(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { return res.json({ success: true, data: await adminAcademicService.sessions(req.query.search as string, req.query.date as string) }); } catch (e) { next(e); } }
  async updateSession(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { return res.json({ success: true, data: await adminAcademicService.updateSession(req.user!.userId, req.params.id, req.body) }); } catch (e) { next(e); } }
  async deleteSession(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { return res.json({ success: true, data: await adminAcademicService.deleteSession(req.user!.userId, req.params.id) }); } catch (e) { next(e); } }
}

export const adminAcademicController = new AdminAcademicController();
