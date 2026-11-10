import { Request, Response, NextFunction } from 'express';
import { attendanceService } from '../services/attendance.service';
import { sendSuccess } from '../utils/response';
import { prisma } from '../config/database';

export class AttendanceController {
  async checkIn(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await attendanceService.checkIn(
        req.user!.userId,
        req.body,
        req.ip,
        req.headers['user-agent']
      );

      return sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  async checkOut(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await attendanceService.checkOut(
        req.user!.userId,
        req.body,
        req.ip,
        req.headers['user-agent']
      );

      return sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  async getTodayStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await attendanceService.getTodayStatus(req.user!.userId);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getMyHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const result = await attendanceService.getMyHistory(req.user!.userId, page, limit);
      return sendSuccess(res, result.records, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async requestCorrection(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await attendanceService.requestCorrection(req.user!.userId, req.body);
      return sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  async reviewCorrection(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await attendanceService.reviewCorrection(req.user!.userId, id, req.body);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async listCorrections(req: Request, res: Response, next: NextFunction) {
    try {
      const status = req.query.status as any;
      const corrections = await prisma.attendanceCorrection.findMany({
        where: {
          organizationId: req.user!.organizationId,
          ...(status ? { status } : {}),
        },
        include: {
          employee: true,
          attendanceRecord: true,
          requestedBy: { select: { email: true, role: true } },
          reviewedBy: { select: { email: true, role: true } },
        },
        orderBy: { requestedAt: 'desc' },
      });

      return sendSuccess(res, corrections);
    } catch (error) {
      next(error);
    }
  }

  async getDashboardSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const date = req.query.date as string | undefined;
      const summary = await attendanceService.getDashboardSummary(req.user!.organizationId, date);
      return sendSuccess(res, summary);
    } catch (error) {
      next(error);
    }
  }
}

export const attendanceController = new AttendanceController();
