import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './handlers/auth';
import userRoutes from './handlers/users';
import productRoutes from './handlers/products';
import orderRoutes from './handlers/orders';
import cartRoutes from './handlers/cart';
import addressRoutes from './handlers/addresses';
import adminRoutes from './handlers/admin';
import docsRoutes from './handlers/docs';
import { errorMiddleware } from './utils/response';
import { config } from './config';

const app = express();
const isTest = process.env.ENV === 'test';

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: config.allowedOrigins, credentials: true }));
// Bounded body size so a single request can't exhaust memory (OWASP API4); bulk product import stays well under it
app.use(express.json({ limit: config.jsonBodyLimit }));
app.set('etag', false);

// Login/register/refresh get a tight limit against credential stuffing (OWASP API2);
// every other route gets a looser per-IP ceiling (OWASP API4)
const authLimiter = isTest
  ? undefined
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 20,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests. Please wait a moment and try again.', code: 'rate_limited' },
    });

if (!isTest) {
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: config.apiRateLimit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 429, message: 'Too many requests. Please wait a moment and try again.', data: null },
  }));
}

app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Storefront API is running!' });
});

authRoutes(app, authLimiter);
userRoutes(app);
productRoutes(app);
orderRoutes(app);
cartRoutes(app);
addressRoutes(app);
adminRoutes(app);
docsRoutes(app);

app.use(errorMiddleware);

if (!isTest) {
  app.listen(config.port, () => console.log(`Server running on port ${config.port}`));
}

export default app;
