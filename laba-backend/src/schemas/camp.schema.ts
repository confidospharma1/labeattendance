import { z } from 'zod';
import { gpsProofSchema, faceProofSchema } from './proof.schema';
import { boundarySchema } from '../utils/geo';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
const timeStr = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be HH:MM (24h)');

const campFields = {
  name: z.string().trim().min(3, 'Camp name must be at least 3 characters').max(255),
  description: z.string().trim().max(2000).optional().nullable(),
  branchId: z.string().uuid().optional().nullable().or(z.literal('')),
  campDate: dateStr,
  startTime: timeStr,
  endTime: timeStr,
  locationName: z.string().trim().min(2, 'Location name is required').max(255),
  address: z.string().trim().max(1000).optional().nullable(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radiusMetres: z.coerce.number().int().min(10).max(5000).default(200),
  geofenceShape: z.enum(['CIRCLE', 'POLYGON']).optional(),
  boundary: boundarySchema.optional().nullable(),
  boundaryLabel: z.string().trim().max(255).optional().nullable(),
  employeeIds: z.array(z.string().uuid()).max(500).default([]),
};

const polygonNeedsBoundary = (b: { geofenceShape?: string; boundary?: unknown }) => b.geofenceShape !== 'POLYGON' || !!b.boundary;
const polygonMsg = { message: 'Pick or draw a boundary for a boundary geofence', path: ['boundary'] };

export const createCampSchema = z.object({ body: z.object(campFields).refine(polygonNeedsBoundary, polygonMsg) });
export const updateCampSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({ ...campFields, employeeIds: campFields.employeeIds.optional(), isCancelled: z.boolean().optional() })
    .partial()
    .refine(polygonNeedsBoundary, polygonMsg),
});
export const listCampsQuerySchema = z.object({
  query: z.object({ from: dateStr.optional(), to: dateStr.optional() }),
});

export const campCheckInSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: gpsProofSchema.extend({ face: faceProofSchema.optional() }),
});
export const campCheckOutSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: gpsProofSchema.extend({
    face: faceProofSchema.optional(),
    report: z.string().trim().min(5, 'Write a short camp report (min 5 characters)').max(2000),
  }),
});

export type CampInput = z.infer<typeof createCampSchema>['body'];
export type CampUpdateInput = z.infer<typeof updateCampSchema>['body'];
export type CampProofInput = z.infer<typeof campCheckInSchema>['body'];
export type CampCheckOutInput = z.infer<typeof campCheckOutSchema>['body'];
