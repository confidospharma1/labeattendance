import { z } from 'zod';
import { STAFF_CATEGORIES } from '../utils/staff';

const staffCategory = z.enum(STAFF_CATEGORIES);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
const employeeCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9-]{2,19}$/, 'Employee code: 3-20 letters, digits or dashes');

export const createEmployeeSchema = z.object({
  body: z.object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters').trim(),
    email: z.string().email('Invalid email address').toLowerCase().trim(),
    mobile: z.string().regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian mobile number'),
    // Optional when staffCategory is given: the login role is derived from the category.
    employeeType: z.enum(['OFFICE_STAFF', 'FIELD_STAFF', 'ADMIN']).optional(),
    staffCategory: staffCategory.optional().nullable(),
    designation: z.string().trim().max(120).optional().nullable(),
    dateOfJoining: dateStr.optional().nullable().or(z.literal('')),
    employeeCode: employeeCode.optional().or(z.literal('')),
    shiftId: z.string().uuid().optional().nullable().or(z.literal('')),
    contactId: z.string().optional(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    branchId: z.string().uuid('Invalid branch UUID').optional().or(z.literal('')),
    profileNotes: z.string().optional(),
  }).refine((b) => !!b.employeeType || !!b.staffCategory, {
    message: 'Choose a staff category (or an employee type)',
    path: ['staffCategory'],
  }),
});

export const updateEmployeeSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid employee ID'),
  }),
  body: z.object({
    fullName: z.string().min(2).trim().optional(),
    email: z.string().email().toLowerCase().trim().optional(),
    mobile: z.string().regex(/^[6-9]\d{9}$/).optional(),
    employeeType: z.enum(['OFFICE_STAFF', 'FIELD_STAFF', 'ADMIN', 'SUPER_ADMIN']).optional(),
    staffCategory: staffCategory.optional().nullable(),
    designation: z.string().trim().max(120).optional().nullable(),
    dateOfJoining: dateStr.optional().nullable().or(z.literal('')),
    employeeCode: employeeCode.optional(),
    shiftId: z.string().uuid().optional().nullable().or(z.literal('')),
    status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']).optional(),
    contactId: z.string().optional(),
    profileNotes: z.string().optional(),
    branchId: z.string().uuid().optional().nullable(),
  }),
});

export const updateEmployeeStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid employee ID'),
  }),
  body: z.object({
    status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']),
    reason: z.string().min(5, 'Reason must be at least 5 characters'),
  }),
});

export const listEmployeesQuerySchema = z.object({
  query: z.object({
    type: z.enum(['OFFICE_STAFF', 'FIELD_STAFF', 'ADMIN', 'SUPER_ADMIN']).optional(),
    category: staffCategory.optional(),
    status: z.enum(['PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'SUSPENDED', 'DEACTIVATED']).optional(),
    branchId: z.string().uuid().optional(),
    search: z.string().optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(500).default(20),
  }),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>['body'];
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>['body'];
export type UpdateEmployeeStatusInput = z.infer<typeof updateEmployeeStatusSchema>['body'];
export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>['query'];
