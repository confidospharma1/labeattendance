import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { handle, idParam } from '../utils/handle';
import { campService } from '../services/camp.service';
import { createCampSchema, updateCampSchema, listCampsQuerySchema, campCheckInSchema, campCheckOutSchema } from '../schemas/camp.schema';

const router = Router();
const ADMINS = authorize(['SUPER_ADMIN', 'ADMIN']);
const STAFF = authorize(['OFFICE_STAFF', 'FIELD_STAFF']);

router.use(authenticate);

// ── Staff ──
router.get('/my', STAFF, handle((req) => campService.myCamps(req.user!.userId)));
router.post(
  '/:id/check-in',
  STAFF,
  validate(campCheckInSchema),
  handle((req) => campService.checkIn(req.user!.userId, idParam(req), req.body, req.ip, req.headers['user-agent']))
);
router.post(
  '/:id/check-out',
  STAFF,
  validate(campCheckOutSchema),
  handle((req) => campService.checkOut(req.user!.userId, idParam(req), req.body, req.ip, req.headers['user-agent']))
);

// ── Admin ──
router.get(
  '/',
  ADMINS,
  validate(listCampsQuerySchema),
  handle((req) => campService.list(req.user!.organizationId, req.query.from as string, req.query.to as string))
);
router.post('/', ADMINS, validate(createCampSchema), handle((req) => campService.create(req.user!.userId, req.user!.organizationId, req.body), 201));
router.patch(
  '/:id',
  ADMINS,
  validate(updateCampSchema),
  handle((req) => campService.update(req.user!.userId, req.user!.organizationId, idParam(req), req.body))
);
router.delete('/:id', ADMINS, handle((req) => campService.remove(req.user!.userId, req.user!.organizationId, idParam(req))));
router.get('/assignments/:id/selfie', ADMINS, handle((req) => campService.getSelfie(req.user!.organizationId, idParam(req))));

export const campRoutes = router;
