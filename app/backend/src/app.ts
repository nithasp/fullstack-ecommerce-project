import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import createAuthRouter from './routes/auth';
import usersRouter from './routes/users';
import productsRouter from './routes/products';
import ordersRouter from './routes/orders';
import cartRouter from './routes/cart';
import addressesRouter from './routes/addresses';
import paymentsRouter, { stripeWebhook, omiseWebhook } from './routes/payments';
import { authLimiter } from './middleware/rateLimiter';
import { errorMiddleware, notFoundMiddleware } from './utils/response';
import { config } from './config';

const app = express();

app.set('trust proxy', 1);
app.set('etag', false);

app.use(helmet());
app.use(cors({ origin: config.allowedOrigins, credentials: true }));

// Stripe webhook needs the raw request body for signature verification,
// so its route is registered before the global JSON parser.
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhook);
app.use(express.json());
// Omise webhooks are unsigned JSON — the handler re-fetches the charge from
// the Omise API instead of trusting the payload, so the parsed body is fine.
app.post('/webhooks/omise', omiseWebhook);

app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Storefront API is running!' });
});

app.use('/auth', createAuthRouter(authLimiter));
app.use('/users', usersRouter);
app.use('/products', productsRouter);
app.use('/orders', ordersRouter);
app.use('/cart', cartRouter);
app.use('/addresses', addressesRouter);
app.use('/payments', paymentsRouter);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
