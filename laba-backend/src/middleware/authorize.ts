import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { AppError } from '../utils/AppError';

/**
 * Enforces role-based access control.
 * @param allowedRoles List of roles permitted to access endpoint
 */
export function authorize(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Unauthenticated request', 401, 'UNAUTHENTICATED'));
    }

    if (!allowedRoles.includes(req.user.role as UserRole)) {
      return next(
        new AppError(
          `Access forbidden: Requires one of [${allowedRoles.join(', ')}] permissions.`,
          403,
          'FORBIDDEN_ROLE'
        )
      );
    }

    next();
  };
}

/**
 * Validates that an employee is only accessing their own personal record.
 */
export function requireSelfOrAdmin(paramKey: string = 'employeeId') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Unauthenticated request', 401, 'UNAUTHENTICATED'));
    }

    const targetId = req.params[paramKey] || req.body[paramKey];

    // Super Admin and Admin have access
    if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'ADMIN') {
      return next();
    }

    // Employees can only access their own record
    if (req.user.employeeId && req.user.employeeId === targetId) {
      return next();
    }

    return next(
      new AppError(
        'Access denied: You are not authorized to view or modify this employee record.',
        403,
        'FORBIDDEN_RESOURCE'
      )
    );
  };
}

