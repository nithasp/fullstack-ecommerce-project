import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(public message: string, public statusCode: number = 400) {
    super(message);
  }
}

export function sendSuccess<T>(res: Response, data: T, message: string, statusCode = 200): void {
  res.status(statusCode).json({ status: statusCode, message, data });
}

// Unexpected errors (DB failures, bugs) are logged server-side and never echoed to the client,
// so stack traces, SQL and internal paths don't leak (OWASP API8)
export const errorMiddleware = (
  err: Error, req: Request, res: Response, _next: NextFunction
): void => {
  const known = err as AppError & { status?: number; type?: string };
  const statusCode = known.statusCode || known.status || 500;

  if (statusCode >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
    res.status(statusCode).json({ status: statusCode, message: 'Internal Server Error', data: null });
    return;
  }

  // body-parser raises these for malformed or oversized JSON bodies
  const message = known.type === 'entity.parse.failed' ? 'Request body must be valid JSON'
    : known.type === 'entity.too.large' ? 'Request body is too large'
    : err.message || 'Request failed';

  res.status(statusCode).json({ status: statusCode, message, data: null });
};
