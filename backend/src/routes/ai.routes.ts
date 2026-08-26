import { Router } from 'express';
import multer from 'multer';
import { UserRole } from '@prisma/client';
import { prisma } from '../config/prisma';
import { authorizeRoles, AuthenticatedRequest, verifyToken } from '../middlewares/auth.middlewares';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 8 },
});
const aiUrl = () => (process.env.AI_SERVICE_URL || 'http://127.0.0.1:8503').replace(/\/$/, '');

async function forward(path: string, form?: FormData) {
  const response = await fetch(`${aiUrl()}${path}`, {
    method: form ? 'POST' : 'GET',
    headers: process.env.AI_SERVICE_TOKEN ? { 'x-api-key': process.env.AI_SERVICE_TOKEN } : undefined,
    body: form,
  });
  const body = await response.json().catch(() => ({ detail: 'AI service returned an invalid response.' }));
  if (!response.ok) throw new Error(body.detail || body.error || 'AI service request failed.');
  return body;
}

function appendFile(form: FormData, key: string, file: Express.Multer.File) {
  const bytes = new Uint8Array(file.buffer.byteLength);
  bytes.set(file.buffer);
  form.append(key, new Blob([bytes], { type: file.mimetype }), file.originalname || `${key}.jpg`);
}

router.use(verifyToken);

router.get('/health', async (_req, res, next) => {
  try {
    res.json({ success: true, data: await forward('/health') });
  } catch (error) {
    next(error);
  }
});

router.post('/face-pose', upload.single('image'), async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: { message: 'Thiếu ảnh khuôn mặt.' } });
    const form = new FormData();
    appendFile(form, 'image', req.file);
    res.json({ success: true, data: await forward('/api/face-pose', form) });
  } catch (error) {
    next(error);
  }
});

router.post('/enroll', upload.array('frames', 8), async (req: AuthenticatedRequest, res, next) => {
  try {
    const frames = (req.files || []) as Express.Multer.File[];
    if (!req.user || frames.length < 3) return res.status(400).json({ success: false, error: { message: 'Cần ít nhất 3 ảnh đăng ký.' } });
    const user = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { userCode: true, fullName: true } });
    if (!user) return res.status(404).json({ success: false, error: { message: 'Không tìm thấy tài khoản.' } });
    const form = new FormData();
    form.append('student_id', user.userCode);
    form.append('name', user.fullName);
    frames.forEach((frame) => appendFile(form, 'frames', frame));
    res.json({ success: true, data: await forward('/api/enroll', form) });
  } catch (error) {
    next(error);
  }
});

router.post('/recognize', authorizeRoles(UserRole.ADMIN, UserRole.TEACHER), upload.single('image'), async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: { message: 'Thiếu ảnh lớp học.' } });
    const form = new FormData();
    appendFile(form, 'image', req.file);
    res.json({ success: true, data: await forward('/api/recognize', form) });
  } catch (error) {
    next(error);
  }
});

export default router;
