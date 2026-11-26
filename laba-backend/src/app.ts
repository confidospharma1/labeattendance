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
import { fieldTaskRoutes } from './routes/fieldTask.routes';
import { faceRoutes } from './routes/face.routes';
import { attendanceRoutes } from './routes/attendance.routes';
import { reportRoutes } from './routes/report.routes';
import { auditRoutes } from './routes/audit.routes';
import { policyRoutes } from './routes/policy.routes';
import { shiftRoutes } from './routes/shift.routes';
import { campRoutes } from './routes/camp.routes';
import { customerRoutes } from './routes/customer.routes';
import { geoRoutes } from './routes/geo.routes';

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

        // Android app (Capacitor WebView) and local development origins
        if (
          /^(https?|capacitor):\/\/localhost(:\d+)?$/.test(requestOrigin) ||
          /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(requestOrigin) ||
          /^http:\/\/(10|192\.168)\.[\d.]+(:\d+)?$/.test(requestOrigin)
        ) {
          return callback(null, true);
        }

        return callback(new Error(`Origin ${requestOrigin} is not allowed by CORS`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
      exposedHeaders: ['Set-Cookie', 'Content-Disposition'],
    })
  );

  // Body parsers
  app.use(express.json({ limit: '4mb' })); // face descriptors, selfie thumbnails, boundary polygons
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
  apiRouter.use('/field-tasks', fieldTaskRoutes);
  apiRouter.use('/face', faceRoutes);
  apiRouter.use('/attendance', attendanceRoutes);
  apiRouter.use('/reports', reportRoutes);
  apiRouter.use('/audit-logs', auditRoutes);
  apiRouter.use('/policies', policyRoutes);
  apiRouter.use('/shifts', shiftRoutes);
  apiRouter.use('/camps', campRoutes);
  apiRouter.use('/customers', customerRoutes);
  apiRouter.use('/geo', geoRoutes);

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
