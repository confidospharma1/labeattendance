import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { sendSuccess } from '../utils/response';
import { faceService } from '../services/face.service';
import { AppError } from '../utils/AppError';

const router = Router();
router.use(authenticate);

const enrollSchema = z.object({
  body: z.object({
    descriptors: z.array(z.array(z.number()).min(64).max(2048)).min(2).max(5),
    photo: z.string().regex(/^data:image\/jpeg;base64,/).max(120_000),
    consent: z.literal(true, { errorMap: () => ({ message: 'You must give consent to enrol your face.' }) }),
  }),
});

const requireEmployee = (req: Request) => {
  if (!req.user?.employeeId) throw new AppError('No employee profile for this account.', 400, 'NO_EMPLOYEE');
  return req.user.employeeId;
};

router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await faceService.getStatus(requireEmployee(req)));
  } catch (e) {
    next(e);
  }
});

router.post(
  '/enroll',
  authorize(['OFFICE_STAFF', 'FIELD_STAFF']),
  validate(enrollSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await faceService.enroll(req.user!.userId, requireEmployee(req), req.user!.organizationId, req.body);
      sendSuccess(res, result, 201);
    } catch (e) {
      next(e);
    }
  }
);

router.get('/:employeeId/photo', authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res, next) => {
  try {
    sendSuccess(res, await faceService.getPhoto(req.user!.organizationId, String(req.params.employeeId)));
  } catch (e) {
    next(e);
  }
});

router.delete('/:employeeId', authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res, next) => {
  try {
    sendSuccess(res, await faceService.reset(req.user!.userId, req.user!.organizationId, String(req.params.employeeId)));
  } catch (e) {
    next(e);
  }
});

export const faceRoutes = router;
