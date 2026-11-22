import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';

export class PolicyController {
  async getCurrentPolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const policy = await prisma.attendancePolicy.findFirst({
        where: {
          organizationId: req.user!.organizationId,
          isCurrent: true,
        },
      });

      if (!policy) {
        throw new AppError('No active policy found', 404, 'NOT_FOUND');
      }

      return sendSuccess(res, policy);
    } catch (error) {
      next(error);
    }
  }

  async createPolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        morningStart,
        morningEnd,
        eveningStart,
        eveningEnd,
        defaultGeofenceRadiusMetres,
        gpsAccuracyRejectMetres,
        faceVerificationRequired,
        faceMatchThreshold,
        lateAccessHours,
        notes,
      } = req.body;

      // Find max version
      const latest = await prisma.attendancePolicy.findFirst({
        where: { organizationId: req.user!.organizationId },
        orderBy: { version: 'desc' },
      });

      const nextVersion = (latest?.version || 0) + 1;

      const result = await prisma.$transaction(async (tx) => {
        // Deactivate previous current policy
        await tx.attendancePolicy.updateMany({
          where: { organizationId: req.user!.organizationId, isCurrent: true },
          data: { isCurrent: false },
        });

        const newPolicy = await tx.attendancePolicy.create({
          data: {
            organizationId: req.user!.organizationId,
            version: nextVersion,
            isCurrent: true,
            morningStart: morningStart || '09:00',
            morningEnd: morningEnd || '09:20',
            eveningStart: eveningStart || '16:30',
            eveningEnd: eveningEnd || '17:00',
            defaultGeofenceRadiusMetres: defaultGeofenceRadiusMetres || 100,
            gpsAccuracyRejectMetres: gpsAccuracyRejectMetres || 200,
            // Keep previous face / late-access settings unless explicitly changed
            faceVerificationRequired:
              typeof faceVerificationRequired === 'boolean' ? faceVerificationRequired : (latest?.faceVerificationRequired ?? true),
            faceMatchThreshold:
              typeof faceMatchThreshold === 'number' && faceMatchThreshold >= 0.3 && faceMatchThreshold <= 0.9
                ? faceMatchThreshold
                : (latest?.faceMatchThreshold ?? 0.5),
            lateAccessHours:
              Number.isInteger(lateAccessHours) && lateAccessHours >= 1 && lateAccessHours <= 168
                ? lateAccessHours
                : (latest?.lateAccessHours ?? 24),
            effectiveFrom: new Date(),
            notes: notes || null,
            createdById: req.user!.userId,
          },
        });

        await tx.auditLog.create({
          data: {
            organizationId: req.user!.organizationId,
            actorId: req.user!.userId,
            actorRole: req.user!.role,
            action: 'POLICY_UPDATE',
            entityType: 'AttendancePolicy',
            entityId: newPolicy.id,
            afterState: JSON.parse(JSON.stringify(newPolicy)),
            ipAddress: req.ip || null,
            userAgent: req.headers['user-agent'] || null,
          },
        });

        return newPolicy;
      });

      return sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }
}

export const policyController = new PolicyController();

