import { randomUUID } from 'crypto';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { config } from './config';
import { checkDatabase } from './database';
import { logger } from './logger';
import { recordActivity } from './middleware/audit';
import { errorMiddleware, notFoundMiddleware } from './middleware/error';
import { apiLimiter } from './middleware/rateLimit';
import apiRoutes from './routes';
import docsRoutes from './routes/docs.routes';

export const API_PREFIX = '/api/v1';
export const HEALTH_PATH = '/healthz';

const MAX_REQUEST_ID_LENGTH = 64;

const app = express();

app.set('trust proxy', config.trustProxy);

app.use(
  pinoHttp({
    logger,
    genReqId: (req, res) => {
      const forwarded = req.headers['x-request-id'];
      const id =
        typeof forwarded === 'string' && forwarded.length > 0 && forwarded.length <= MAX_REQUEST_ID_LENGTH
          ? forwarded
          : randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    customLogLevel: (_req, res, err) =>
      err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
    autoLogging: { ignore: (req) => req.url === HEALTH_PATH },
  }),
);

app.use(helmet());
app.use(cors({ origin: config.allowedOrigins, credentials: true }));
// Bounded body size so a single request can't exhaust memory (OWASP API4); bulk product import stays well under it
app.use(express.json({ limit: config.jsonBodyLimit }));
app.use(cookieParser());
app.set('etag', false);

app.get(HEALTH_PATH, async (_req: Request, res: Response) => {
  if (!(await checkDatabase())) {
    res.status(503).json({ status: 'unavailable' });
    return;
  }
  res.json({ status: 'ok' });
});

// Per-IP ceiling on every route (OWASP API4); the auth routes add a tighter one of their own
app.use(apiLimiter);

app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Storefront API is running!' });
});

app.use(docsRoutes);
app.use(API_PREFIX, recordActivity, apiRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
