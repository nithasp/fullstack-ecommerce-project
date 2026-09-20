export type UserRole = 'customer' | 'admin';

export const USER_ROLES: readonly UserRole[] = ['customer', 'admin'] as const;

export interface User {
  id?: number;
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  role?: UserRole;
}
