import { Router } from 'express';
import { policyController } from '../controllers/policy.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

router.use(authenticate);

// View current policy (all staff)
router.get('/current', policyController.getCurrentPolicy);

// Update policy (Super Admin only)
router.post('/', authorize(['SUPER_ADMIN']), policyController.createPolicy);

export const policyRoutes = router;

