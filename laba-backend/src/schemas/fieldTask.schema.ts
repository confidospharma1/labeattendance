import { z } from 'zod';
import { gpsProofSchema, faceProofSchema } from './proof.schema';
import { APP_CONSTANTS } from '../config/constants';
import { boundarySchema } from '../utils/geo';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
const timeStr = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be HH:MM (24h)');
const uuidParam = z.object({ id: z.string().uuid('Invalid task ID') });

const taskFields = {
  title: z.string().trim().min(3, 'Task title must be at least 3 characters').max(255),
  description: z.string().trim().max(2000).optional().nullable(),
  locationName: z.string().trim().min(2, 'Location name is required').max(255),
  address: z.string().trim().max(1000).optional().nullable(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radiusMetres: z.coerce
    .number()
    .int()
    .min(APP_CONSTANTS.MIN_RADIUS_METRES, `Radius must be at least ${APP_CONSTANTS.MIN_RADIUS_METRES}m`)
    .max(APP_CONSTANTS.MAX_RADIUS_METRES, `Radius must be at most ${APP_CONSTANTS.MAX_RADIUS_METRES}m`),
  geofenceShape: z.enum(['CIRCLE', 'POLYGON']).optional(),
  boundary: boundarySchema.optional().nullable(),
  boundaryLabel: z.string().trim().max(255).optional().nullable(),
  deadlineTime: timeStr,
  sequence: z.coerce.number().int().min(1).max(50).optional(),
};

const polygonNeedsBoundary = (b: { geofenceShape?: string; boundary?: unknown }) => b.geofenceShape !== 'POLYGON' || !!b.boundary;
const polygonMsg = { message: 'Pick or draw a boundary for a boundary geofence', path: ['boundary'] };

export const createTaskSchema = z.object({
  body: z
    .object({
      employeeId: z.string().uuid('Invalid employee ID'),
      taskDate: dateStr,
      ...taskFields,
    })
    .refine(polygonNeedsBoundary, polygonMsg),
});

export const updateTaskSchema = z.object({
  params: uuidParam,
  body: z.object({
    taskDate: dateStr.optional(),
    title: taskFields.title.optional(),
    description: taskFields.description,
    locationName: taskFields.locationName.optional(),
    address: taskFields.address,
    latitude: taskFields.latitude.optional(),
    longitude: taskFields.longitude.optional(),
    radiusMetres: taskFields.radiusMetres.optional(),
    geofenceShape: taskFields.geofenceShape,
    boundary: taskFields.boundary,
    boundaryLabel: taskFields.boundaryLabel,
    deadlineTime: timeStr.optional(),
    sequence: taskFields.sequence,
  }),
});

export const listTasksQuerySchema = z.object({
  query: z.object({
    date: dateStr.optional(),
    employeeId: z.string().uuid().optional(),
  }),
});

export const copyTasksSchema = z.object({
  body: z.object({
    employeeId: z.string().uuid(),
    fromDate: dateStr,
    toDate: dateStr,
  }),
});

/** Marketing executive survey captured when closing a route stop. */
const opt = (max: number) => z.string().trim().max(max).optional();
export const surveySchema = z.object({
  outletName: opt(255),
  outletType: opt(60),
  contactPerson: opt(255),
  contactMobile: z.string().trim().regex(/^$|^[6-9]\d{9}$/, 'Contact mobile must be a 10-digit Indian number').optional(),
  productsDiscussed: opt(1000),
  orderValue: z.coerce.number().min(0).max(100_000_000).optional(),
  competitorInfo: opt(1000),
  feedback: opt(2000),
  nextVisitDate: dateStr.optional().or(z.literal('')),
});

export const visitTaskSchema = z.object({
  params: uuidParam,
  body: gpsProofSchema.extend({ face: faceProofSchema.optional() }),
});

export const completeTaskSchema = z.object({
  params: uuidParam,
  body: gpsProofSchema.extend({
    completionNote: z
      .string({ required_error: 'Completion note is required' })
      .trim()
      .min(10, 'Completion note must be at least 10 characters')
      .max(2000, 'Completion note must not exceed 2000 characters'),
    survey: surveySchema.optional(),
  }),
});

export const lateRequestSchema = z.object({
  params: uuidParam,
  body: z.object({
    reason: z.string().trim().min(10, 'Reason must be at least 10 characters').max(1000),
  }),
});

export const lateReviewSchema = z.object({
  params: uuidParam,
  body: z.object({
    decision: z.enum(['APPROVED', 'REJECTED']),
    note: z.string().trim().max(1000).optional(),
  }),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>['body'];
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>['body'];
export type VisitTaskInput = z.infer<typeof visitTaskSchema>['body'];
export type CompleteTaskInput = z.infer<typeof completeTaskSchema>['body'];
