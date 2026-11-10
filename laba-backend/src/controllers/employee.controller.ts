import { Request, Response, NextFunction } from 'express';
import { employeeService } from '../services/employee.service';
import { sendSuccess } from '../utils/response';

export class EmployeeController {
  public async createEmployee(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await employeeService.createEmployee(
        req.user!.userId,
        req.user!.organizationId,
        req.body
      );
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  public async listEmployees(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await employeeService.listEmployees(
        req.user!.organizationId,
        req.query as any
      );
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  public async getEmployeeById(req: Request, res: Response, next: NextFunction) {
    try {
      const employeeId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await employeeService.getEmployeeById(
        employeeId,
        req.user!.organizationId
      );
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  public async updateEmployee(req: Request, res: Response, next: NextFunction) {
    try {
      const employeeId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await employeeService.updateEmployee(
        req.user!.userId,
        req.user!.organizationId,
        employeeId,
        req.body
      );
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  public async updateEmployeeStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const employeeId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await employeeService.updateEmployeeStatus(
        req.user!.userId,
        req.user!.organizationId,
        employeeId,
        req.body
      );
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  public async deleteEmployee(req: Request, res: Response, next: NextFunction) {
    try {
      const employeeId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await employeeService.deleteEmployee(
        req.user!.userId,
        req.user!.organizationId,
        employeeId
      );
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
}

export const employeeController = new EmployeeController();
