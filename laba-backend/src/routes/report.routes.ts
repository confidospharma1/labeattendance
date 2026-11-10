import { Router } from 'express';
import { reportController } from '../controllers/report.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

router.use(authenticate);
router.use(authorize(['SUPER_ADMIN', 'ADMIN']));

router.get('/attendance/export', reportController.exportExcel);
router.get('/attendance/present', reportController.getPresentList);
router.get('/attendance/absent', reportController.getAbsentList);

export const reportRoutes = router;

