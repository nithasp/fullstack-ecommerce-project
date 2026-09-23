import { PublicUser, UserRole } from './user.types';

export interface AccessTokenPayload {
  userId: number;
  role?: UserRole;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// What a client receives: the refresh token travels in an HttpOnly cookie instead of the body
export interface AuthSession {
  user: PublicUser;
  accessToken: string;
}
