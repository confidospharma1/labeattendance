import { z } from 'zod';
import { gpsProofSchema, faceProofSchema } from './proof.schema';
import { APP_CONSTANTS } from '../config/constants';

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
  deadlineTime: timeStr,
  sequence: z.coerce.number().int().min(1).max(50).optional(),
};

export const createTaskSchema = z.object({
  body: z.object({
    employeeId: z.string().uuid('Invalid employee ID'),
    taskDate: dateStr,
    ...taskFields,
  }),
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
