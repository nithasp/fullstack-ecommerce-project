import { Response } from 'express';
import { ErrorCode } from '../types/error.types';
import { PageMeta } from '../types/pagination.types';

export function sendSuccess<T>(
  res: Response,
  data: T,
  message: string,
  statusCode = 200,
  meta?: PageMeta,
): void {
  res.status(statusCode).json({ status: statusCode, message, data, meta });
}

export function sendError(res: Response, statusCode: number, message: string, code: ErrorCode): void {
  res.status(statusCode).json({ status: statusCode, message, data: null, code });
}
