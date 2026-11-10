import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { sendSuccess } from '../utils/response';

const router = Router();

router.get('/health', async (req: Request, res: Response) => {
  let dbStatus = 'disconnected';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch (error) {
    dbStatus = 'error';
  }

  const isHealthy = dbStatus === 'connected';
  return sendSuccess(
    res,
    {
      status: isHealthy ? 'healthy' : 'degraded',
      service: 'labe-backend-api',
      version: '1.0.0',
      database: dbStatus,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      timezone: 'Asia/Kolkata',
    },
    isHealthy ? 200 : 503
  );
});

export const healthRoutes = router;

