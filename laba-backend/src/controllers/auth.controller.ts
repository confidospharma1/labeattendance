import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { sendSuccess } from '../utils/response';
import { APP_CONSTANTS } from '../config/constants';
import { env } from '../config/env';

export class AuthController {
  public async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, user } = await authService.login(req.body, req.ip, req.headers['user-agent']);

      // Set secure HTTP-only cookie
      res.cookie(APP_CONSTANTS.AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: env.COOKIE_SECURE,
        sameSite: env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none',
        domain: env.COOKIE_DOMAIN || undefined,
        path: '/',
        maxAge: 8 * 60 * 60 * 1000, // 8 hours in milliseconds
      });

      return sendSuccess(res, { user, token });
    } catch (err) {
      next(err);
    }
  }

  public async logout(req: Request, res: Response, next: NextFunction) {
    try {
      res.clearCookie(APP_CONSTANTS.AUTH_COOKIE_NAME, {
        httpOnly: true,
        secure: env.COOKIE_SECURE,
        sameSite: env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none',
        domain: env.COOKIE_DOMAIN || undefined,
        path: '/',
      });

      return sendSuccess(res, { message: 'Successfully logged out' });
    } catch (err) {
      next(err);
    }
  }

  public async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await authService.getMe(req.user!.userId);
      return sendSuccess(res, user);
    } catch (err) {
      next(err);
    }
  }

  public async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.changePassword(req.user!.userId, req.body);
      return sendSuccess(res, { message: 'Password updated successfully' });
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();

