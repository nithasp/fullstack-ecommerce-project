import { Request, Response, NextFunction } from 'express';
import { PageMeta } from '../types/pagination.types';

export class AppError extends Error {
  constructor(public message: string, public statusCode: number = 400) {
    super(message);
  }
}

export function sendSuccess<T>(res: Response, data: T, message: string, statusCode = 200): void {
  res.status(statusCode).json({ status: statusCode, message, data });
}

export function sendPage<T>(res: Response, items: T[], meta: PageMeta, message: string): void {
  res.status(200).json({ status: 200, message, data: items, meta });
}

function fromPostgres(err: { code?: string; constraint?: string }): { statusCode: number; message: string } | null {
  switch (err.code) {
    case '23505':
      return {
        statusCode: 409,
        message: err.constraint === 'users_username_key' ? 'Username already exists' : 'A record with that value already exists',
      };
    case '23503': {
      const entity = /_(product|user|order)_id_fkey$/.exec(err.constraint ?? '')?.[1];
      return {
        statusCode: 400,
        message: entity ? `${entity[0].toUpperCase()}${entity.slice(1)} does not exist` : 'A referenced record does not exist',
      };
    }
    case '22001':
      return { statusCode: 400, message: 'A value is too long' };
    case '22003':
      return { statusCode: 400, message: 'A number is out of range' };
    case '22P02':
      return { statusCode: 400, message: 'A value has an invalid format' };
    default:
      return null;
  }
}

export const notFoundMiddleware = (req: Request, res: Response): void => {
  res.status(404).json({ status: 404, message: `Route ${req.method} ${req.path} not found`, data: null });
};

// Unexpected errors (DB failures, bugs) are logged server-side and never echoed to the client,
// so stack traces, SQL and internal paths don't leak (OWASP API8)
export const errorMiddleware = (
  err: Error, req: Request, res: Response, _next: NextFunction
): void => {
  const known = err as AppError & { status?: number; type?: string };
  const db = fromPostgres(err as { code?: string; constraint?: string });
  const statusCode = db?.statusCode || known.statusCode || known.status || 500;

  if (statusCode >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
    res.status(statusCode).json({ status: statusCode, message: 'Internal Server Error', data: null });
    return;
  }

  const message = db?.message
    ?? (known.type === 'entity.parse.failed' ? 'Request body must be valid JSON'
      : known.type === 'entity.too.large' ? 'Request body is too large'
      : err.message || 'Request failed');

  res.status(statusCode).json({ status: statusCode, message, data: null });
};
