import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(public message: string, public statusCode: number = 400) {
    super(message);
  }
}

export function sendSuccess<T>(res: Response, data: T, message: string, statusCode = 200): void {
  res.status(statusCode).json({ status: statusCode, message, data });
}

export const errorMiddleware = (
  err: Error, _req: Request, res: Response, _next: NextFunction
): void => {
  const statusCode = (err as AppError).statusCode || 500;
  res.status(statusCode).json({
    status: statusCode,
    message: err.message || 'Internal Server Error',
    data: null,
  });
};
