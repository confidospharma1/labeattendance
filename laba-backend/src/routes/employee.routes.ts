import { Router } from 'express';
import { employeeController } from '../controllers/employee.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize, requireSelfOrAdmin } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  updateEmployeeStatusSchema,
  listEmployeesQuerySchema,
} from '../schemas/employee.schema';

const router = Router();

// All employee routes require authentication
router.use(authenticate);

// Create Employee (Admin and Super Admin only)
router.post(
  '/',
  authorize(['SUPER_ADMIN', 'ADMIN']),
  validate(createEmployeeSchema),
  employeeController.createEmployee
);

// List Employees with pagination & filters
router.get(
  '/',
  authorize(['SUPER_ADMIN', 'ADMIN']),
  validate(listEmployeesQuerySchema),
  employeeController.listEmployees
);

// Get single employee details
router.get(
  '/:id',
  requireSelfOrAdmin('id'),
  employeeController.getEmployeeById
);

// Update employee details (PUT and PATCH)
router.put(
  '/:id',
  authorize(['SUPER_ADMIN', 'ADMIN']),
  validate(updateEmployeeSchema),
  employeeController.updateEmployee
);

router.patch(
  '/:id',
  authorize(['SUPER_ADMIN', 'ADMIN']),
  validate(updateEmployeeSchema),
  employeeController.updateEmployee
);

// Delete employee from entire database
router.delete(
  '/:id',
  authorize(['SUPER_ADMIN', 'ADMIN']),
  employeeController.deleteEmployee
);

// Update status (Active/Suspended/Deactivated)
router.patch(
  '/:id/status',
  authorize(['SUPER_ADMIN', 'ADMIN']),
  validate(updateEmployeeStatusSchema),
  employeeController.updateEmployeeStatus
);

export const employeeRoutes = router;

