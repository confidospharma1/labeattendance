import { Request, Response, NextFunction } from 'express';
import { scheduleService } from '../services/schedule.service';
import { sendSuccess } from '../utils/response';

export class ScheduleController {
  public async assignSingleDay(req: Request, res: Response, next: NextFunction) {
    try {
      const employeeId = Array.isArray(req.params.employeeId)
        ? req.params.employeeId[0]
        : req.params.employeeId;

      const result = await scheduleService.assignSingleDay(
        req.user!.userId,
        req.user!.organizationId,
        employeeId,
        req.body
      );
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  public async assignWeeklySchedule(req: Request, res: Response, next: NextFunction) {
    try {
      const employeeId = Array.isArray(req.params.employeeId)
        ? req.params.employeeId[0]
        : req.params.employeeId;

      const result = await scheduleService.assignWeeklySchedule(
        req.user!.userId,
        req.user!.organizationId,
        employeeId,
        req.body
      );
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  public async getEmployeeSchedules(req: Request, res: Response, next: NextFunction) {
    try {
      const employeeId = Array.isArray(req.params.employeeId)
        ? req.params.employeeId[0]
        : req.params.employeeId;

      const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };

      const result = await scheduleService.getEmployeeSchedules(
        req.user!.organizationId,
        employeeId,
        startDate,
        endDate
      );
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
}

export const scheduleController = new ScheduleController();

