import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/AppError';
import { sendError } from '../utils/response';
import { logger } from '../config/logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) {
  // Operational AppError
  if (err instanceof AppError) {
    logger.warn(`Operational Error [${err.code}]: ${err.message}`, {
      path: req.path,
      method: req.method,
      statusCode: err.statusCode,
      details: err.details,
    });
    return sendError(res, err.message, err.statusCode, err.code, err.details);
  }

  // Zod Validation Error
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    logger.warn('Request Validation Error', { path: req.path, formattedErrors });
    return sendError(res, 'Validation error in request parameters or body', 400, 'VALIDATION_ERROR', formattedErrors);
  }

  // Prisma Unique Constraint Violation
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[])?.join(', ') || 'field';
      logger.warn(`Prisma Unique Constraint Violation on [${target}]`, { path: req.path });
      return sendError(
        res,
        `A record with this ${target} already exists. Duplicate submission prevented.`,
        409,
        'DUPLICATE_RECORD',
        { fields: err.meta?.target }
      );
    }

    if (err.code === 'P2025') {
      return sendError(res, 'The requested record was not found.', 404, 'RECORD_NOT_FOUND');
    }
  }

  // Unexpected internal server error
  logger.error('Unhandled Server Error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  return sendError(
    res,
    process.env.NODE_ENV === 'production'
      ? 'An unexpected internal server error occurred.'
      : err.message,
    500,
    'INTERNAL_SERVER_ERROR'
  );
}

