import { ErrorCode } from '../types/error.types';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code: ErrorCode = 'bad_request',
  ) {
    super(message);
  }
}
