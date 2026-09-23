import { NextFunction, Request, Response } from 'express';
import { PostgresError } from '../types/database.types';
import { PageMeta } from '../types/pagination.types';

export type ErrorCode =
  | 'bad_request'
  | 'invalid_request'
  | 'no_token'
  | 'token_expired'
  | 'token_invalid'
  | 'invalid_credentials'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'internal_error';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code: ErrorCode = 'bad_request',
  ) {
    super(message);
  }
}

export function sendSuccess<T>(res: Response, data: T, message: string, statusCode = 200): void {
  res.status(statusCode).json({ status: statusCode, message, data });
}

export function sendPage<T>(res: Response, items: T[], meta: PageMeta, message: string): void {
  res.status(200).json({ status: 200, message, data: items, meta });
}

export function sendError(res: Response, statusCode: number, message: string, code: ErrorCode): void {
  res.status(statusCode).json({ status: statusCode, message, data: null, code });
}

function fromPostgres(err: PostgresError): { statusCode: number; message: string; code: ErrorCode } | null {
  switch (err.code) {
    case '23505':
      return {
        statusCode: 409,
        code: 'conflict',
        message: err.constraint?.startsWith('users_username')
          ? 'Username already exists'
          : 'A record with that value already exists',
      };
    case '23503': {
      if (err.detail?.includes('is still referenced')) {
        return {
          statusCode: 409,
          code: 'conflict',
          message: 'This record is used elsewhere and cannot be deleted',
        };
      }
      const entity = /_(product|user|order)_id_fkey$/.exec(err.constraint ?? '')?.[1];
      return {
        statusCode: 400,
        code: 'invalid_request',
        message: entity
          ? `${entity[0].toUpperCase()}${entity.slice(1)} does not exist`
          : 'A referenced record does not exist',
      };
    }
    case '23514':
      return { statusCode: 400, code: 'invalid_request', message: 'A value is not allowed here' };
    case '22001':
      return { statusCode: 400, code: 'invalid_request', message: 'A value is too long' };
    case '22003':
      return { statusCode: 400, code: 'invalid_request', message: 'A number is out of range' };
    case '22P02':
      return { statusCode: 400, code: 'invalid_request', message: 'A value has an invalid format' };
    case '40001':
    case '40P01':
      return {
        statusCode: 409,
        code: 'conflict',
        message: 'The request collided with another one, please try again',
      };
    default:
      return null;
  }
}

export const notFoundMiddleware = (req: Request, res: Response): void => {
  sendError(res, 404, `Route ${req.method} ${req.path} not found`, 'not_found');
};

// Unexpected errors (database failures, bugs) are logged server-side and never echoed to the client,
// so stack traces, SQL and internal paths don't leak (OWASP API8)
export const errorMiddleware = (err: Error, req: Request, res: Response, _next: NextFunction): void => {
  const known = err as AppError & { status?: number; type?: string };
  const db = fromPostgres(err as PostgresError);
  const statusCode = db?.statusCode ?? known.statusCode ?? known.status ?? 500;

  if (statusCode >= 500) {
    req.log.error({ err }, 'request failed');
    sendError(res, statusCode, 'Internal Server Error', 'internal_error');
    return;
  }

  if (db) {
    sendError(res, db.statusCode, db.message, db.code);
    return;
  }

  const bodyParserMessage =
    known.type === 'entity.parse.failed'
      ? 'Request body must be valid JSON'
      : known.type === 'entity.too.large'
        ? 'Request body is too large'
        : null;

  sendError(
    res,
    statusCode,
    bodyParserMessage ?? err.message ?? 'Request failed',
    bodyParserMessage ? 'invalid_request' : (known.code ?? 'bad_request'),
  );
};
