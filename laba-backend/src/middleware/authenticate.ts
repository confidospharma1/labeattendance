import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../utils/auth';
import { AppError } from '../utils/AppError';
import { APP_CONSTANTS } from '../config/constants';
import { prisma } from '../config/database';

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const token =
      req.cookies?.[APP_CONSTANTS.AUTH_COOKIE_NAME] ||
      req.cookies?.['labe_token'] ||
      req.cookies?.['laba_token'] ||
      req.headers.authorization?.replace(/^Bearer\s+/, '');

    if (!token) {
      throw new AppError('Authentication required. No session found.', 401, 'UNAUTHENTICATED');
    }

    let payload: TokenPayload;
    try {
      payload = verifyToken(token);
    } catch (err) {
      throw new AppError('Invalid or expired authentication session.', 401, 'INVALID_TOKEN');
    }

    // Verify user is still active in database
    const user = await prisma.user.findFirst({
      where: {
        id: payload.userId,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        organizationId: true,
        role: true,
        lockedUntil: true,
        employee: {
          select: {
            id: true,
            employeeType: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('User account not found or suspended.', 401, 'ACCOUNT_INACTIVE');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AppError('Account is temporarily locked. Try again later.', 401, 'ACCOUNT_LOCKED');
    }

    if (user.employee && user.employee.status !== 'ACTIVE') {
      throw new AppError('Employee profile is deactivated.', 403, 'EMPLOYEE_DEACTIVATED');
    }

    req.user = {
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      employeeId: user.employee?.id,
      employeeType: user.employee?.employeeType,
    };

    next();
  } catch (err) {
    next(err);
  }
}

