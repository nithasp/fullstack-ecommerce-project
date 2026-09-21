import { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config';

const WINDOW_MS = 15 * 60 * 1000;

// Both limiters are switched off under ENV=test so the suite can sign in as often as it needs
const isTest = process.env.ENV === 'test';
const passThrough: RequestHandler = (_req, _res, next) => next();

// Login/register/refresh get a tight limit against credential stuffing (OWASP API2)
export const authLimiter: RequestHandler = isTest
  ? passThrough
  : rateLimit({
      windowMs: WINDOW_MS,
      max: 20,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests. Please wait a moment and try again.', code: 'rate_limited' },
    });

// Every other route gets a looser per-IP ceiling (OWASP API4)
export const apiLimiter: RequestHandler = isTest
  ? passThrough
  : rateLimit({
      windowMs: WINDOW_MS,
      max: config.apiRateLimit,
      standardHeaders: true,
      legacyHeaders: false,
      message: { status: 429, message: 'Too many requests. Please wait a moment and try again.', data: null },
    });
