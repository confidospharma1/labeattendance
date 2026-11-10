import { Request, Response, NextFunction } from 'express';
import { branchService } from '../services/branch.service';
import { sendSuccess } from '../utils/response';

export class BranchController {
  public async createBranch(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await branchService.createBranch(
        req.user!.userId,
        req.user!.organizationId,
        req.body
      );
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  public async listBranches(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await branchService.listBranches(
        req.user!.organizationId,
        req.query as any
      );
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  public async getBranchById(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await branchService.getBranchById(
        branchId,
        req.user!.organizationId
      );
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  public async updateBranch(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await branchService.updateBranch(
        req.user!.userId,
        req.user!.organizationId,
        branchId,
        req.body
      );
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  public async deleteBranch(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await branchService.deleteBranch(
        req.user!.userId,
        req.user!.organizationId,
        branchId
      );
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
}

export const branchController = new BranchController();

