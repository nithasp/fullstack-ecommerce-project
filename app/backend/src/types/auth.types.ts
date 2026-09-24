import { PublicUser, UserRole } from './user.types';

export interface AccessTokenPayload {
  userId: number;
  role?: UserRole | undefined;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthSession {
  user: PublicUser;
  accessToken: string;
}
