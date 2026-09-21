import { UserRole } from './user.types';

export interface AccessTokenPayload {
  userId: number;
  role?: UserRole;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
