import 'express-serve-static-core';
import { UserRole } from './user.types';

declare module 'express-serve-static-core' {
  interface Request {
    user?: { userId: number; role: UserRole };
  }
}
