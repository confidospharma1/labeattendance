import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { handle } from '../utils/handle';
import { retentionService, RETENTION_OPTIONS } from '../services/retention.service';

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

const settingsSchema = z.object({
  body: z.object({
    retentionDays: z.coerce
      .number()
      .int()
      .refine((d) => (RETENTION_OPTIONS as readonly number[]).includes(d), `Choose one of ${RETENTION_OPTIONS.join(', ')} days`),
  }),
});
const archiveSchema = z.object({ query: z.object({ through: ymd }) });
const purgeSchema = z.object({ body: z.object({ through: ymd, token: z.string().min(10) }) });

const router = Router();
router.use(authenticate);
router.use(authorize(['SUPER_ADMIN', 'ADMIN']));

/** Storage usage, retention period and the upcoming-deletion alert. */
router.get('/status', handle((req) => retentionService.getStatus(req.user!.organizationId)));

/** Change how many days of attendance history are kept (super admin only). */
router.patch(
  '/settings',
  authorize(['SUPER_ADMIN']),
  validate(settingsSchema),
  handle((req) => retentionService.setRetentionDays(req.user!.organizationId, Number(req.body.retentionDays)))
);

/** Excel archive of all history up to and including `through`. The response carries the token the purge needs. */
router.get('/archive', validate(archiveSchema), async (req, res, next) => {
  try {
    const archive = await retentionService.buildArchive(req.user!.organizationId, String(req.query.through));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${archive.filename}"`);
    res.setHeader('X-Archive-Token', archive.token);
    res.setHeader('X-Archive-Through', archive.through);
    await archive.workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

/** Delete the archived history after the file was saved. */
router.post(
  '/purge',
  validate(purgeSchema),
  handle((req) => retentionService.purgeAfterArchive(req.user!.organizationId, req.body.through, req.body.token))
);

export const retentionRoutes = router;
