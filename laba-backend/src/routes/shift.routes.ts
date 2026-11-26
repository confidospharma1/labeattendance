import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { handle, idParam } from '../utils/handle';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { timeStringToMinutes } from '../utils/timeWindows';

const timeStr = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be HH:MM (24h)');
const minutes = (max: number) => z.coerce.number().int().min(0).max(max);

const shiftFields = {
  name: z.string().trim().min(2, 'Shift name is required').max(100),
  branchId: z.string().uuid().optional().nullable().or(z.literal('')),
  startTime: timeStr,
  endTime: timeStr,
  checkInBeforeMinutes: minutes(180).default(30),
  lateGraceMinutes: minutes(180).default(15),
  checkInAfterMinutes: minutes(240).default(60),
  checkOutBeforeMinutes: minutes(180).default(15),
  checkOutAfterMinutes: minutes(360).default(120),
  isActive: z.boolean().optional(),
};

/** Shift length in minutes (overnight shifts wrap past midnight). */
const shiftLength = (s: { startTime: string; endTime: string }) => {
  const d = timeStringToMinutes(s.endTime) - timeStringToMinutes(s.startTime);
  return d <= 0 ? d + 1440 : d;
};
const windowsFit = (s: { startTime: string; endTime: string; checkInAfterMinutes: number; checkOutBeforeMinutes: number; lateGraceMinutes: number }) =>
  s.checkInAfterMinutes + s.checkOutBeforeMinutes < shiftLength(s) && s.lateGraceMinutes <= s.checkInAfterMinutes;
const fitMsg = {
  message: 'Check-in window must close before check-out opens, and late grace must be within the check-in window',
  path: ['checkInAfterMinutes'],
};

const createShiftSchema = z.object({ body: z.object(shiftFields).refine(windowsFit, fitMsg) });
const updateShiftSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object(shiftFields).partial(),
});

const router = Router();
router.use(authenticate);

// Any signed-in user may read shifts (staff see their own shift times)
router.get(
  '/',
  handle(async (req) => {
    const shifts = await prisma.shift.findMany({
      where: { organizationId: req.user!.organizationId },
      include: { branch: { select: { id: true, name: true } }, _count: { select: { employees: true } } },
      orderBy: [{ isActive: 'desc' }, { startTime: 'asc' }],
    });
    return shifts.map(({ _count, ...s }) => ({ ...s, employeeCount: _count.employees }));
  })
);

const ADMINS = authorize(['SUPER_ADMIN', 'ADMIN']);

router.post(
  '/',
  ADMINS,
  validate(createShiftSchema),
  handle(async (req) => {
    const { branchId, ...rest } = req.body as z.infer<typeof createShiftSchema>['body'];
    return prisma.shift.create({ data: { ...rest, branchId: branchId || null, organizationId: req.user!.organizationId } });
  }, 201)
);

router.patch(
  '/:id',
  ADMINS,
  validate(updateShiftSchema),
  handle(async (req) => {
    const existing = await prisma.shift.findFirst({ where: { id: idParam(req), organizationId: req.user!.organizationId } });
    if (!existing) throw new AppError('Shift not found.', 404, 'NOT_FOUND');
    const { branchId, ...rest } = req.body as z.infer<typeof updateShiftSchema>['body'];
    const merged = { ...existing, ...rest };
    if (!windowsFit(merged)) throw new AppError(fitMsg.message, 400, 'INVALID_SHIFT_WINDOWS');
    return prisma.shift.update({
      where: { id: existing.id },
      data: { ...rest, ...(branchId !== undefined && { branchId: branchId || null }) },
    });
  })
);

router.delete(
  '/:id',
  ADMINS,
  handle(async (req) => {
    const existing = await prisma.shift.findFirst({ where: { id: idParam(req), organizationId: req.user!.organizationId } });
    if (!existing) throw new AppError('Shift not found.', 404, 'NOT_FOUND');
    // Employees on this shift fall back to the organisation's policy windows (FK is ON DELETE SET NULL).
    await prisma.shift.delete({ where: { id: existing.id } });
    return { deleted: true };
  })
);

export const shiftRoutes = router;
