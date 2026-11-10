import { Router } from 'express';
import { attendanceController } from '../controllers/attendance.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  checkInSchema,
  checkOutSchema,
  requestCorrectionSchema,
  reviewCorrectionSchema,
} from '../schemas/attendance.schema';

const router = Router();

router.use(authenticate);

// Employee attendance workflow
router.get('/today', attendanceController.getTodayStatus);
router.post('/check-in', validate(checkInSchema), attendanceController.checkIn);
router.post('/check-out', validate(checkOutSchema), attendanceController.checkOut);
router.get('/my-history', attendanceController.getMyHistory);

// Corrections
router.post('/corrections', validate(requestCorrectionSchema), attendanceController.requestCorrection);
router.get('/corrections', authorize(['SUPER_ADMIN', 'ADMIN']), attendanceController.listCorrections);
router.patch('/corrections/:id', authorize(['SUPER_ADMIN', 'ADMIN']), validate(reviewCorrectionSchema), attendanceController.reviewCorrection);

// Admin Dashboard Summary
router.get('/dashboard', authorize(['SUPER_ADMIN', 'ADMIN']), attendanceController.getDashboardSummary);

export const attendanceRoutes = router;

