import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { sendSuccess } from '../utils/response';
import { fieldTaskService } from '../services/fieldTask.service';
import {
  createTaskSchema,
  updateTaskSchema,
  listTasksQuerySchema,
  copyTasksSchema,
  visitTaskSchema,
  completeTaskSchema,
  lateRequestSchema,
  lateReviewSchema,
} from '../schemas/fieldTask.schema';

const router = Router();
const ADMINS = authorize(['SUPER_ADMIN', 'ADMIN']);
const FIELD = authorize(['FIELD_STAFF']);

const handle =
  (fn: (req: Request) => Promise<unknown>, status = 200): RequestHandler =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await fn(req), status);
    } catch (err) {
      next(err);
    }
  };

const param = (req: Request) => String(req.params.id);

router.use(authenticate);

// ── Field staff ──
router.get('/my', FIELD, handle((req) => fieldTaskService.getMyTasks(req.user!.userId)));
router.post(
  '/:id/visit',
  FIELD,
  validate(visitTaskSchema),
  handle((req) => fieldTaskService.visit(req.user!.userId, param(req), req.body, req.ip, req.headers['user-agent']))
);
router.post(
  '/:id/complete',
  FIELD,
  validate(completeTaskSchema),
  handle((req) => fieldTaskService.complete(req.user!.userId, param(req), req.body, req.ip, req.headers['user-agent']))
);
router.post(
  '/:id/late-request',
  FIELD,
  validate(lateRequestSchema),
  handle((req) => fieldTaskService.requestLateAccess(req.user!.userId, param(req), req.body.reason))
);

// ── Admin ──
router.get(
  '/',
  ADMINS,
  validate(listTasksQuerySchema),
  handle((req) =>
    fieldTaskService.listTasks(req.user!.organizationId, req.query.date as string, req.query.employeeId as string)
  )
);
router.post(
  '/',
  ADMINS,
  validate(createTaskSchema),
  handle((req) => fieldTaskService.createTask(req.user!.userId, req.user!.organizationId, req.body), 201)
);
router.post(
  '/copy',
  ADMINS,
  validate(copyTasksSchema),
  handle(
    (req) =>
      fieldTaskService.copyDay(req.user!.userId, req.user!.organizationId, req.body.employeeId, req.body.fromDate, req.body.toDate),
    201
  )
);
router.get(
  '/late-requests',
  ADMINS,
  handle((req) => fieldTaskService.listLateRequests(req.user!.organizationId, (req.query.status as any) || 'REQUESTED'))
);
router.post(
  '/:id/late-review',
  ADMINS,
  validate(lateReviewSchema),
  handle((req) =>
    fieldTaskService.reviewLateRequest(req.user!.userId, req.user!.organizationId, param(req), req.body.decision, req.body.note)
  )
);
router.get('/:id/selfie', ADMINS, handle((req) => fieldTaskService.getSelfie(req.user!.organizationId, param(req))));
router.patch(
  '/:id',
  ADMINS,
  validate(updateTaskSchema),
  handle((req) => fieldTaskService.updateTask(req.user!.userId, req.user!.organizationId, param(req), req.body))
);
router.delete('/:id', ADMINS, handle((req) => fieldTaskService.deleteTask(req.user!.userId, req.user!.organizationId, param(req))));

export const fieldTaskRoutes = router;
