import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import apiRoutes from './routes';
import docsRoutes from './routes/docs.routes';
import { apiLimiter } from './middleware/rateLimit';
import { recordActivity } from './middleware/audit';
import { errorMiddleware, notFoundMiddleware } from './utils/response';
import { config } from './config';

// Every API route lives under this prefix, so a breaking change can ship as /api/v2 next to it
export const API_PREFIX = '/api/v1';

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: config.allowedOrigins, credentials: true }));
// Bounded body size so a single request can't exhaust memory (OWASP API4); bulk product import stays well under it
app.use(express.json({ limit: config.jsonBodyLimit }));
app.set('etag', false);

// Per-IP ceiling on every route (OWASP API4); the auth routes add a tighter one of their own
app.use(apiLimiter);

app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Storefront API is running!' });
});

app.use(docsRoutes);
// recordActivity writes one audit-log row per signed-in request once its response has gone out
app.use(API_PREFIX, recordActivity, apiRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
