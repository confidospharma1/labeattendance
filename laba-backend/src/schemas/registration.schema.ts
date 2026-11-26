import { z } from 'zod';
import { STAFF_CATEGORIES, attendanceModeFor, modeNeedsLocation, roleForCategory } from '../utils/staff';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

export const registerSchema = z.object({
  body: z
    .object({
      fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(255),
      email: z.string().email('Invalid email address').toLowerCase().trim(),
      mobile: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
      // New app builds send staffCategory; older builds only send employeeType.
      staffCategory: z.enum(STAFF_CATEGORIES).optional(),
      employeeType: z.enum(['OFFICE_STAFF', 'FIELD_STAFF']).optional(),
      designation: z.string().trim().max(120).optional(),
      dateOfJoining: dateStr.optional().or(z.literal('')),
      branchId: z.string().uuid().optional().or(z.literal('')),
      password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain an uppercase letter')
        .regex(/[0-9]/, 'Password must contain a number'),
    })
    .transform((d) => ({
      ...d,
      branchId: d.branchId || undefined,
      employeeType: d.staffCategory ? roleForCategory(d.staffCategory) : (d.employeeType ?? 'OFFICE_STAFF'),
    }))
    .refine((d) => !modeNeedsLocation(attendanceModeFor(d.employeeType, d.staffCategory)) || !!d.branchId, {
      message: 'Select your work location (office, distribution centre, pharmacy or lab)',
      path: ['branchId'],
    }),
});

export const approveSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    staffCategory: z.enum(STAFF_CATEGORIES).optional(),
    employeeType: z.enum(['OFFICE_STAFF', 'FIELD_STAFF']).optional(),
    branchId: z.string().uuid().optional(),
    shiftId: z.string().uuid().optional(),
    designation: z.string().trim().max(120).optional(),
  }),
});

export const rejectSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ reason: z.string().trim().min(3, 'Give a short reason').max(500) }),
});

export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type ApproveInput = z.infer<typeof approveSchema>['body'];
