import { z } from 'zod';

export const assignSingleScheduleSchema = z.object({
  params: z.object({
    employeeId: z.string().uuid('Invalid employee ID'),
  }),
  body: z.object({
    scheduleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format must be YYYY-MM-DD'),
    scheduleType: z.enum(['LOCATION_ASSIGNED', 'UNASSIGNED', 'WEEKLY_OFF', 'ATTENDANCE_DISABLED']),
    locationName: z.string().optional(),
    address: z.string().optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    geofenceRadiusMetres: z.coerce.number().min(10).max(5000).default(100).optional(),
    attendanceEnabled: z.boolean().default(true),
    notes: z.string().optional(),
  }).refine((data) => {
    if (data.scheduleType === 'LOCATION_ASSIGNED') {
      return data.latitude !== undefined && data.longitude !== undefined;
    }
    return true;
  }, {
    message: 'Latitude and Longitude are mandatory when scheduleType is LOCATION_ASSIGNED',
    path: ['latitude'],
  }),
});

export const assignWeeklyScheduleSchema = z.object({
  params: z.object({
    employeeId: z.string().uuid('Invalid employee ID'),
  }),
  body: z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format must be YYYY-MM-DD (Monday recommended)'),
    schedules: z.array(
      z.object({
        dayOffset: z.coerce.number().min(0).max(6), // 0 = Day 1 (Monday), ... 6 = Sunday
        scheduleType: z.enum(['LOCATION_ASSIGNED', 'UNASSIGNED', 'WEEKLY_OFF', 'ATTENDANCE_DISABLED']),
        locationName: z.string().optional(),
        address: z.string().optional(),
        latitude: z.coerce.number().min(-90).max(90).optional(),
        longitude: z.coerce.number().min(-180).max(180).optional(),
        geofenceRadiusMetres: z.coerce.number().min(10).max(5000).default(100).optional(),
        attendanceEnabled: z.boolean().default(true),
        notes: z.string().optional(),
      })
    ).min(1).max(7),
  }),
});

export const getFieldScheduleQuerySchema = z.object({
  query: z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
});

export type AssignSingleScheduleInput = z.infer<typeof assignSingleScheduleSchema>['body'];
export type AssignWeeklyScheduleInput = z.infer<typeof assignWeeklyScheduleSchema>['body'];
export type GetFieldScheduleQuery = z.infer<typeof getFieldScheduleQuerySchema>['query'];

