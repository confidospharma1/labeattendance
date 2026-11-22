import { z } from 'zod';
import { gpsProofSchema, faceProofSchema } from './proof.schema';

export const checkInSchema = z.object({
  body: gpsProofSchema.extend({
    face: faceProofSchema.optional(),
  }),
});

export const checkOutSchema = z.object({
  body: gpsProofSchema.extend({
    face: faceProofSchema.optional(),
    workReport: z
      .string({ required_error: 'Work report is mandatory for check-out' })
      .trim()
      .refine(
        (val) => val.replace(/\s+/g, '').length >= 5,
        'Work report must contain at least 5 non-whitespace characters'
      )
      .refine((val) => val.length <= 1000, 'Work report must not exceed 1000 characters'),
  }),
});

export const requestCorrectionSchema = z.object({
  body: z.object({
    attendanceRecordId: z.string().uuid('Invalid attendance record ID').optional(),
    workDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    correctionType: z.enum(
      ['MISSED_CHECKIN', 'MISSED_CHECKOUT', 'WRONG_LOCATION', 'OTHER'],
      { required_error: 'Correction type is required' }
    ),
    employeeReason: z
      .string({ required_error: 'Reason is required' })
      .trim()
      .min(10, 'Reason must be at least 10 characters long')
      .max(500, 'Reason must not exceed 500 characters'),
    proposedCheckIn: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Check-in time must be HH:MM')
      .optional(),
    proposedCheckOut: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Check-out time must be HH:MM')
      .optional(),
    proposedWorkReport: z.string().max(500).optional(),
  }),
});

export const reviewCorrectionSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid correction ID'),
  }),
  body: z.object({
    status: z.enum(['APPROVED', 'REJECTED'], {
      required_error: 'Status must be either APPROVED or REJECTED',
    }),
    adminReason: z
      .string({ required_error: 'Admin reason/comment is required' })
      .trim()
      .min(3, 'Admin reason must be at least 3 characters long')
      .max(500, 'Admin reason must not exceed 500 characters'),
  }),
});

export const attendanceQuerySchema = z.object({
  query: z.object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
      .optional(),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format')
      .optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format')
      .optional(),
    employeeId: z.string().uuid('Invalid employee ID').optional(),
    branchId: z.string().uuid('Invalid branch ID').optional(),
    status: z
      .enum(['CHECKED_IN', 'CHECKED_OUT', 'ABSENT', 'CORRECTED', 'PENDING_CORRECTION'])
      .optional(),
    page: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .optional()
      .default('1'),
    limit: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .optional()
      .default('50'),
  }),
});

export type CheckInInput = z.infer<typeof checkInSchema>['body'];
export type CheckOutInput = z.infer<typeof checkOutSchema>['body'];
export type RequestCorrectionInput = z.infer<typeof requestCorrectionSchema>['body'];
export type ReviewCorrectionInput = z.infer<typeof reviewCorrectionSchema>['body'];
export type AttendanceQueryInput = z.infer<typeof attendanceQuerySchema>['query'];

