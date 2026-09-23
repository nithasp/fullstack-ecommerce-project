import { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { sendError } from '../utils/response';

const WINDOW_MS = 15 * 60 * 1000;

const passThrough: RequestHandler = (_req, _res, next) => next();

const limiter = (limit: number, message: string): RequestHandler =>
  config.isTest
    ? passThrough
    : rateLimit({
        windowMs: WINDOW_MS,
        limit,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (_req, res) => sendError(res, 429, message, 'rate_limited'),
      });

// Login, register and refresh get a tight limit against credential stuffing (OWASP API2)
export const authLimiter = limiter(
  config.authRateLimit,
  'Too many attempts. Please wait a moment and try again.',
);

export const apiLimiter = limiter(
  config.apiRateLimit,
  'Too many requests. Please wait a moment and try again.',
);
