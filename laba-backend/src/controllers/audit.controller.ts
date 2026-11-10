import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { sendSuccess } from '../utils/response';

export class AuditController {
  async listAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const skip = (page - 1) * limit;

      const action = req.query.action as string | undefined;
      const entityType = req.query.entityType as string | undefined;

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where: {
            organizationId: req.user!.organizationId,
            ...(action ? { action } : {}),
            ...(entityType ? { entityType } : {}),
          },
          include: {
            actor: {
              select: {
                id: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.auditLog.count({
          where: {
            organizationId: req.user!.organizationId,
            ...(action ? { action } : {}),
            ...(entityType ? { entityType } : {}),
          },
        }),
      ]);

      return sendSuccess(res, logs, 200, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      next(error);
    }
  }
}

export const auditController = new AuditController();

