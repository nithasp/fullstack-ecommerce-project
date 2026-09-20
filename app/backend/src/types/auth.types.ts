import { UserRole } from './user.types';

export interface AccessTokenPayload {
  userId: number;
  role?: UserRole;
}
