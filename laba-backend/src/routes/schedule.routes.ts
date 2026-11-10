import { Router } from 'express';
import { scheduleController } from '../controllers/schedule.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize, requireSelfOrAdmin } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  assignSingleScheduleSchema,
  assignWeeklyScheduleSchema,
  getFieldScheduleQuerySchema,
} from '../schemas/schedule.schema';

const router = Router();

router.use(authenticate);

// View Field Staff schedules
router.get(
  '/field-staff/:employeeId',
  requireSelfOrAdmin('employeeId'),
  validate(getFieldScheduleQuerySchema),
  scheduleController.getEmployeeSchedules
);

// Assign single day field schedule (Admin & Super Admin only)
router.post(
  '/field-staff/:employeeId/single',
  authorize(['SUPER_ADMIN', 'ADMIN']),
  validate(assignSingleScheduleSchema),
  scheduleController.assignSingleDay
);

// Assign 7-day weekly schedule (Admin & Super Admin only)
router.post(
  '/field-staff/:employeeId/weekly',
  authorize(['SUPER_ADMIN', 'ADMIN']),
  validate(assignWeeklyScheduleSchema),
  scheduleController.assignWeeklySchedule
);

export const scheduleRoutes = router;

