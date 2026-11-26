import { Router } from 'express';
import { z } from 'zod';
import { attendanceService } from '../services/attendance.service';
import { handle, idParam } from '../utils/handle';
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

// Admin Dashboard Summary & Analytics
router.get('/dashboard', authorize(['SUPER_ADMIN', 'ADMIN']), attendanceController.getDashboardSummary);
router.get('/analytics', authorize(['SUPER_ADMIN', 'ADMIN']), attendanceController.getAnalytics);
router.get(
  '/board',
  authorize(['SUPER_ADMIN', 'ADMIN']),
  validate(z.object({ query: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional() }) })),
  handle((req) => attendanceService.getAttendanceBoard(req.user!.organizationId, req.query.date as string | undefined))
);
router.get(
  '/records/:id/selfie',
  authorize(['SUPER_ADMIN', 'ADMIN']),
  handle((req) => attendanceService.getRecordSelfie(req.user!.organizationId, idParam(req), req.query.which === 'out' ? 'out' : 'in'))
);

// Admin Direct Modification & Permanent Deletion
router.patch('/records/:id', authorize(['SUPER_ADMIN', 'ADMIN']), attendanceController.updateRecord);
router.delete('/records/:id', authorize(['SUPER_ADMIN', 'ADMIN']), attendanceController.deleteRecord);

export const attendanceRoutes = router;

