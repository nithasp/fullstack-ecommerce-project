import { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config';

/** Brute-force protection for credential endpoints; disabled in tests. */
export const authLimiter: RequestHandler | undefined = config.isTest
  ? undefined
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 20,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests. Please wait a moment and try again.', code: 'rate_limited' },
    });
