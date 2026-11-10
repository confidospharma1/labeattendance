import { z } from 'zod';

export const createEmployeeSchema = z.object({
  body: z.object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters').trim(),
    email: z.string().email('Invalid email address').toLowerCase().trim(),
    mobile: z.string().regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian mobile number'),
    employeeType: z.enum(['OFFICE_STAFF', 'FIELD_STAFF', 'ADMIN']),
    contactId: z.string().optional(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    branchId: z.string().uuid('Invalid branch UUID').optional(),
    profileNotes: z.string().optional(),
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
    status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']).optional(),
    branchId: z.string().uuid().optional(),
    search: z.string().optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
  }),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>['body'];
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>['body'];
export type UpdateEmployeeStatusInput = z.infer<typeof updateEmployeeStatusSchema>['body'];
export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>['query'];

