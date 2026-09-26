import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { ekycController } from '../controllers/ekyc.controller';
import { authorizeRoles, verifyToken } from '../middlewares/auth.middlewares';
import { uploadMedia } from '../middlewares/upload.middleware';

const router = Router();

router.post('/enroll-initial', verifyToken, authorizeRoles(UserRole.STUDENT), uploadMedia.array('frames', 12), (req, res, next) =>
  ekycController.enrollInitial(req, res, next),
);
router.post('/pose', verifyToken, authorizeRoles(UserRole.STUDENT), uploadMedia.single('frame'), (req, res, next) =>
  ekycController.detectPose(req, res, next),
);

export default router;
