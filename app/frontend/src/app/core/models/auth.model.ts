export type UserRole = 'customer' | 'admin';

export interface AuthUser {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

/**
 * What the API returns when a session starts or is renewed. The refresh token is not in here:
 * it travels in an HttpOnly cookie the browser stores and JavaScript cannot read.
 */
export interface AuthSession {
  user: AuthUser;
  accessToken: string;
}
