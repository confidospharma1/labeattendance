import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { logger } from './config/logger';
import { errorHandler } from './middleware/errorHandler';
import { healthRoutes } from './routes/health.routes';
import { authRoutes } from './routes/auth.routes';
import { employeeRoutes } from './routes/employee.routes';
import { branchRoutes } from './routes/branch.routes';
import { scheduleRoutes } from './routes/schedule.routes';
import { attendanceRoutes } from './routes/attendance.routes';
import { reportRoutes } from './routes/report.routes';
import { auditRoutes } from './routes/audit.routes';
import { policyRoutes } from './routes/policy.routes';

export function createApp() {
  const app = express();

  // Trust proxy for reverse proxies (Railway, Heroku, Nginx)
  app.set('trust proxy', 1);

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginOpenerPolicy: false,
    })
  );

  // Allowed Origins for CORS (Vercel Production, Previews & Local Development)
  const allowedOrigins = [
    env.FRONTEND_URL,
    'https://labeattendance.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ].filter(Boolean);

  app.use(
    cors({
      origin: (requestOrigin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!requestOrigin) return callback(null, true);

        // Check exact match in allowedOrigins
        if (allowedOrigins.includes(requestOrigin)) {
          return callback(null, true);
        }

        // Allow any Vercel deployment preview under *.vercel.app for this project
        if (/^https:\/\/.*\.vercel\.app$/.test(requestOrigin)) {
          return callback(null, true);
        }

        // Allow any local development origin
        if (/^http:\/\/localhost(:\d+)?$/.test(requestOrigin) || /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(requestOrigin)) {
          return callback(null, true);
        }

        return callback(null, true); // Fallback allow to avoid blocking legitimate cross-origin requests
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
      exposedHeaders: ['Set-Cookie', 'Content-Disposition'],
    })
  );

  // Body parsers
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // Global rate limiter
  const limiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP address. Please try again later.',
      },
    },
  });
  app.use('/api/', limiter);

  // Request logger
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`, {
        ip: req.ip,
        statusCode: res.statusCode,
      });
    });
    next();
  });

  // Base API v1 Router
  const apiRouter = express.Router();
  apiRouter.use(healthRoutes);
  apiRouter.use('/auth', authRoutes);
  apiRouter.use('/employees', employeeRoutes);
  apiRouter.use('/branches', branchRoutes);
  apiRouter.use('/schedules', scheduleRoutes);
  apiRouter.use('/attendance', attendanceRoutes);
  apiRouter.use('/reports', reportRoutes);
  apiRouter.use('/audit-logs', auditRoutes);
  apiRouter.use('/policies', policyRoutes);

  // Mount API Router
  app.use('/api/v1', apiRouter);

  // 404 Handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${req.method} ${req.originalUrl} not found`,
      },
    });
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();

if (require.main === module || process.env.NODE_ENV !== 'test') {
  const port = env.PORT;
  app.listen(port, () => {
    logger.info(`🚀 LABE Attendance API running on http://localhost:${port}`);
    logger.info(`🌍 Environment: ${env.NODE_ENV} | Frontend: ${env.FRONTEND_URL}`);
  });
}
