import { Response } from 'express';

export function sendSuccess<T>(res: Response, data: T, statusCode: number = 200, meta?: Record<string, unknown>) {
  return res.status(statusCode).json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  });
}

export function sendError(res: Response, message: string, statusCode: number = 400, code: string = 'ERROR', details?: unknown) {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details: details || null,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
}

