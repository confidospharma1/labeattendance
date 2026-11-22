import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import { loginSchema, changePasswordSchema } from '../schemas/auth.schema';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { registerSchema } from '../schemas/registration.schema';
import { registrationService } from '../services/registration.service';
import { sendSuccess } from '../utils/response';

const router = Router();

// Stricter rate limiting on login endpoint (5 attempts / 15 minutes)
const loginLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.LOGIN_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'LOGIN_RATE_LIMIT_EXCEEDED',
      message: 'Too many login attempts. Please wait 15 minutes before trying again.',
    },
  },
});

router.post('/login', loginLimiter, validate(loginSchema), authController.login);
router.post('/logout', authController.logout);

// Public self-registration (account starts as PENDING_APPROVAL)
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
router.get('/branches', async (_req, res, next) => {
  try {
    sendSuccess(res, await registrationService.listPublicBranches());
  } catch (e) {
    next(e);
  }
});
router.post('/register', registerLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    sendSuccess(res, await registrationService.register(req.body, req.ip), 201);
  } catch (e) {
    next(e);
  }
});
router.get('/me', authenticate, authController.getMe);
router.post('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword);

export const authRoutes = router;

