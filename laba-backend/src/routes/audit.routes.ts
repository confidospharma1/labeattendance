import { Router } from 'express';
import { auditController } from '../controllers/audit.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

router.use(authenticate);
router.use(authorize(['SUPER_ADMIN']));

router.get('/', auditController.listAuditLogs);

export const auditRoutes = router;
