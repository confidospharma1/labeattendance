import { z } from 'zod';

export const registerSchema = z.object({
  body: z
    .object({
      fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(255),
      email: z.string().email('Invalid email address').toLowerCase().trim(),
      mobile: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
      employeeType: z.enum(['OFFICE_STAFF', 'FIELD_STAFF']),
      branchId: z.string().uuid().optional(),
      password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain an uppercase letter')
        .regex(/[0-9]/, 'Password must contain a number'),
    })
    .refine((d) => d.employeeType !== 'OFFICE_STAFF' || !!d.branchId, {
      message: 'Office staff must select their branch',
      path: ['branchId'],
    }),
});

export const approveSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    employeeType: z.enum(['OFFICE_STAFF', 'FIELD_STAFF']).optional(),
    branchId: z.string().uuid().optional(),
  }),
});

export const rejectSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ reason: z.string().trim().min(3, 'Give a short reason').max(500) }),
});

export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type ApproveInput = z.infer<typeof approveSchema>['body'];
