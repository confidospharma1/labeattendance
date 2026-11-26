import { Request, Response, NextFunction, RequestHandler } from 'express';
import { sendSuccess } from './response';

/** Wraps an async route body: sends its result as a success response, forwards errors. */
export const handle =
  (fn: (req: Request) => Promise<unknown>, status = 200): RequestHandler =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await fn(req), status);
    } catch (err) {
      next(err);
    }
  };

export const idParam = (req: Request) => String(req.params.id);
