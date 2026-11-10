import { z } from 'zod';

export const createBranchSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Branch name must be at least 2 characters').trim(),
    branchCode: z.string().min(2, 'Branch code required').trim().toUpperCase(),
    address: z.string().min(5, 'Street address required').trim(),
    district: z.string().min(2, 'District required').trim(),
    state: z.string().default('Andhra Pradesh'),
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    geofenceRadiusMetres: z.coerce.number().min(10).max(5000).default(100),
    managerEmployeeId: z.string().uuid().optional().nullable(),
  }),
});

export const updateBranchSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid branch ID'),
  }),
  body: z.object({
    name: z.string().min(2).trim().optional(),
    address: z.string().min(5).trim().optional(),
    district: z.string().min(2).trim().optional(),
    state: z.string().optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    geofenceRadiusMetres: z.coerce.number().min(10).max(5000).optional(),
    managerEmployeeId: z.string().uuid().optional().nullable(),
    isActive: z.boolean().optional(),
  }),
});

export const listBranchesQuerySchema = z.object({
  query: z.object({
    isActive: z
      .string()
      .optional()
      .transform((val) => (val === undefined ? undefined : val === 'true')),
    search: z.string().optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
  }),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>['body'];
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>['body'];
export type ListBranchesQuery = z.infer<typeof listBranchesQuerySchema>['query'];

