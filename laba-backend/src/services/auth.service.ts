import { prisma } from '../config/database';
import { comparePassword, hashPassword, signToken } from '../utils/auth';
import { AppError } from '../utils/AppError';
import { APP_CONSTANTS } from '../config/constants';
import { LoginInput, ChangePasswordInput } from '../schemas/auth.schema';
import { logger } from '../config/logger';

export class AuthService {
  /**
   * Authenticates user, handles lockouts, and generates JWT session.
   */
  public async login(input: LoginInput, ipAddress?: string, userAgent?: string) {
    const user = await prisma.user.findFirst({
      where: {
        email: input.email,
        deletedAt: null,
      },
      include: {
        employee: {
          include: {
            branchAssignments: {
              where: { isCurrent: true },
              include: { branch: true },
            },
          },
        },
      },
    });

    // Uniform error message against user enumeration
    if (!user) {
      logger.warn(`Failed login attempt: non-existent email [${input.email}]`);
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      throw new AppError('Your account has been suspended. Please contact administrator.', 401, 'ACCOUNT_SUSPENDED');
    }

    // Check temporary lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / (1000 * 60));
      throw new AppError(
        `Account locked due to consecutive failed attempts. Try again in ${remainingMinutes} minute(s).`,
        401,
        'ACCOUNT_LOCKED'
      );
    }

    // Verify password
    const isMatch = await comparePassword(input.password, user.passwordHash);

    if (!isMatch) {
      const failedAttempts = user.failedLoginAttempts + 1;
      let lockedUntil: Date | null = null;

      if (failedAttempts >= APP_CONSTANTS.MAX_FAILED_LOGIN_ATTEMPTS) {
        lockedUntil = new Date(Date.now() + APP_CONSTANTS.LOCKOUT_DURATION_MINUTES * 60 * 1000);
        logger.warn(`Account locked for email [${user.email}] after ${failedAttempts} attempts`);
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: failedAttempts,
          lockedUntil,
        },
      });

      if (lockedUntil) {
        throw new AppError(
          `Too many failed attempts. Account locked for ${APP_CONSTANTS.LOCKOUT_DURATION_MINUTES} minutes.`,
          401,
          'ACCOUNT_LOCKED'
        );
      }

      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    // Successful login: reset failed attempts & record login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    // Record login in audit log
    await prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.role,
        action: 'USER_LOGIN',
        entityType: 'users',
        entityId: user.id,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });

    const token = signToken({
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      employeeId: user.employee?.id,
      employeeType: user.employee?.employeeType,
    });

    const activeBranch = user.employee?.branchAssignments?.[0]?.branch;

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        employee: user.employee
          ? {
              id: user.employee.id,
              employeeCode: user.employee.employeeCode,
              fullName: user.employee.fullName,
              mobile: user.employee.mobile,
              employeeType: user.employee.employeeType,
              status: user.employee.status,
              assignedBranch: activeBranch
                ? {
                    id: activeBranch.id,
                    name: activeBranch.name,
                    branchCode: activeBranch.branchCode,
                    geofenceRadiusMetres: activeBranch.geofenceRadiusMetres,
                  }
                : null,
            }
          : null,
      },
    };
  }

  /**
   * Changes authenticated user password.
   */
  public async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found.', 404, 'NOT_FOUND');
    }

    const isMatch = await comparePassword(input.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Current password is incorrect.', 400, 'INVALID_CURRENT_PASSWORD');
    }

    const newHash = await hashPassword(input.newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.role,
        action: 'PASSWORD_CHANGED',
        entityType: 'users',
        entityId: user.id,
      },
    });

    return { success: true };
  }

  /**
   * Fetches profile of current user.
   */
  public async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        organization: {
          select: { id: true, name: true, slug: true, timezone: true },
        },
        employee: {
          select: {
            id: true,
            employeeCode: true,
            contactId: true,
            fullName: true,
            mobile: true,
            employeeType: true,
            status: true,
            branchAssignments: {
              where: { isCurrent: true },
              include: { branch: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new AppError('User not found.', 404, 'NOT_FOUND');
    }

    const activeBranch = user.employee?.branchAssignments?.[0]?.branch;

    return {
      ...user,
      employee: user.employee
        ? {
            ...user.employee,
            assignedBranch: activeBranch || null,
          }
        : null,
    };
  }
}

export const authService = new AuthService();

