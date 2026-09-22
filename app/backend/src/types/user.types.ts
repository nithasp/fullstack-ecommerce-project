export type UserRole = 'customer' | 'admin';

export const USER_ROLES: readonly UserRole[] = ['customer', 'admin'] as const;

export interface NewUser {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  role?: UserRole;
}

// The role is changed only through UserRepository.updateRole, so it can't ride along on a profile update.
export type UserUpdate = Partial<Omit<NewUser, 'role'>>;

// There is no password field, so the hash can't leak by accident.
export interface PublicUser {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  role: UserRole;
}
