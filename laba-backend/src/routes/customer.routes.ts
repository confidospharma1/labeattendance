import { Router, Request } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { handle, idParam } from '../utils/handle';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';

const customerFields = {
  name: z.string().trim().min(2, 'Customer name is required').max(255),
  customerType: z.string().trim().max(60).optional().nullable(),
  contactPerson: z.string().trim().max(255).optional().nullable(),
  mobile: z
    .string()
    .trim()
    .regex(/^$|^[6-9]\d{9}$/, 'Mobile must be a 10-digit Indian number')
    .optional()
    .nullable(),
  address: z.string().trim().max(1000).optional().nullable(),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  branchId: z.string().uuid().optional().nullable().or(z.literal('')),
};

const createSchema = z.object({ body: z.object(customerFields) });
const updateSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ ...customerFields, isActive: z.boolean().optional() }).partial(),
});
const listSchema = z.object({
  query: z.object({ branchId: z.string().uuid().optional(), search: z.string().optional() }),
});

const isAdmin = (req: Request) => req.user!.role === 'ADMIN' || req.user!.role === 'SUPER_ADMIN';

/** Sales executives work on their own distribution centre's customers. */
async function salesContext(req: Request) {
  const employee = await prisma.employee.findFirst({
    where: { userId: req.user!.userId, status: 'ACTIVE' },
    include: { branchAssignments: { where: { isCurrent: true } } },
  });
  if (!employee || employee.staffCategory !== 'SALES_EXECUTIVE') {
    throw new AppError('Customer data is available to sales executives and admins.', 403, 'FORBIDDEN_ROLE');
  }
  const dcId = employee.branchAssignments[0]?.branchId ?? null;
  if (!dcId) throw new AppError('You are not allotted to a distribution centre.', 403, 'NO_BRANCH_ASSIGNED');
  return { dcId };
}

const decimal = (v: number | null | undefined) => (v === undefined ? undefined : v === null ? null : new Prisma.Decimal(v));
const format = <T extends { latitude: Prisma.Decimal | null; longitude: Prisma.Decimal | null }>(c: T) => ({
  ...c,
  latitude: c.latitude === null ? null : Number(c.latitude),
  longitude: c.longitude === null ? null : Number(c.longitude),
});

const router = Router();
router.use(authenticate);
router.use(authorize(['SUPER_ADMIN', 'ADMIN', 'FIELD_STAFF']));

router.get(
  '/',
  validate(listSchema),
  handle(async (req) => {
    const branchId = isAdmin(req) ? (req.query.branchId as string | undefined) : (await salesContext(req)).dcId;
    const search = (req.query.search as string | undefined)?.trim();
    const customers = await prisma.customer.findMany({
      where: {
        organizationId: req.user!.organizationId,
        ...(branchId && { branchId }),
        ...(!isAdmin(req) && { isActive: true }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { contactPerson: { contains: search, mode: 'insensitive' } },
            { mobile: { contains: search } },
            { address: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      include: { branch: { select: { id: true, name: true } }, addedBy: { select: { email: true } } },
      orderBy: { name: 'asc' },
      take: 1000,
    });
    return customers.map(format);
  })
);

router.post(
  '/',
  validate(createSchema),
  handle(async (req) => {
    const input = req.body as z.infer<typeof createSchema>['body'];
    const branchId = isAdmin(req) ? input.branchId || null : (await salesContext(req)).dcId;
    if (branchId) {
      const branch = await prisma.branch.findFirst({ where: { id: branchId, organizationId: req.user!.organizationId } });
      if (!branch) throw new AppError('Distribution centre not found.', 404, 'BRANCH_NOT_FOUND');
    }
    const customer = await prisma.customer.create({
      data: {
        organizationId: req.user!.organizationId,
        branchId,
        name: input.name,
        customerType: input.customerType || null,
        contactPerson: input.contactPerson || null,
        mobile: input.mobile || null,
        address: input.address || null,
        latitude: decimal(input.latitude) ?? null,
        longitude: decimal(input.longitude) ?? null,
        notes: input.notes || null,
        addedById: req.user!.userId,
      },
    });
    return format(customer);
  }, 201)
);

router.patch(
  '/:id',
  validate(updateSchema),
  handle(async (req) => {
    const existing = await prisma.customer.findFirst({ where: { id: idParam(req), organizationId: req.user!.organizationId } });
    if (!existing) throw new AppError('Customer not found.', 404, 'NOT_FOUND');
    if (!isAdmin(req)) {
      const { dcId } = await salesContext(req);
      if (existing.branchId !== dcId) throw new AppError('This customer belongs to another distribution centre.', 403, 'FORBIDDEN_RESOURCE');
    }
    const input = req.body as z.infer<typeof updateSchema>['body'];
    const updated = await prisma.customer.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.customerType !== undefined && { customerType: input.customerType || null }),
        ...(input.contactPerson !== undefined && { contactPerson: input.contactPerson || null }),
        ...(input.mobile !== undefined && { mobile: input.mobile || null }),
        ...(input.address !== undefined && { address: input.address || null }),
        ...(input.latitude !== undefined && { latitude: decimal(input.latitude) }),
        ...(input.longitude !== undefined && { longitude: decimal(input.longitude) }),
        ...(input.notes !== undefined && { notes: input.notes || null }),
        ...(isAdmin(req) && input.branchId !== undefined && { branchId: input.branchId || null }),
        ...(isAdmin(req) && input.isActive !== undefined && { isActive: input.isActive }),
      },
    });
    return format(updated);
  })
);

router.delete(
  '/:id',
  authorize(['SUPER_ADMIN', 'ADMIN']),
  handle(async (req) => {
    const existing = await prisma.customer.findFirst({ where: { id: idParam(req), organizationId: req.user!.organizationId } });
    if (!existing) throw new AppError('Customer not found.', 404, 'NOT_FOUND');
    await prisma.customer.delete({ where: { id: existing.id } });
    return { deleted: true };
  })
);

export const customerRoutes = router;
