import { Router } from 'express';
import { branchController } from '../controllers/branch.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  createBranchSchema,
  updateBranchSchema,
  listBranchesQuerySchema,
} from '../schemas/branch.schema';

const router = Router();

router.use(authenticate);

// List branches (All authenticated staff can view branch list for assignments/transfers)
router.get(
  '/',
  validate(listBranchesQuerySchema),
  branchController.listBranches
);

// View single branch details
router.get(
  '/:id',
  branchController.getBranchById
);

// Create branch (Super Admin and Admin only)
router.post(
  '/',
  authorize(['SUPER_ADMIN', 'ADMIN']),
  validate(createBranchSchema),
  branchController.createBranch
);

// Update branch (Super Admin and Admin only)
router.put(
  '/:id',
  authorize(['SUPER_ADMIN', 'ADMIN']),
  validate(updateBranchSchema),
  branchController.updateBranch
);

router.patch(
  '/:id',
  authorize(['SUPER_ADMIN', 'ADMIN']),
  validate(updateBranchSchema),
  branchController.updateBranch
);

// Delete branch (Super Admin and Admin only)
router.delete(
  '/:id',
  authorize(['SUPER_ADMIN', 'ADMIN']),
  branchController.deleteBranch
);

export const branchRoutes = router;

