import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { handle } from '../utils/handle';
import { boundaryService } from '../services/boundary.service';

const router = Router();
router.use(authenticate);
router.use(authorize(['SUPER_ADMIN', 'ADMIN']));

router.get(
  '/boundaries/search',
  validate(z.object({ query: z.object({ q: z.string().trim().min(2, 'Type at least 2 letters').max(120) }) })),
  handle((req) => boundaryService.search(String(req.query.q)))
);

router.get(
  '/boundaries/at',
  validate(
    z.object({
      query: z.object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180) }),
    })
  ),
  handle((req) => boundaryService.at(Number(req.query.lat), Number(req.query.lng)))
);

export const geoRoutes = router;
