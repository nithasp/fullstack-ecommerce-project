export type UserRole = 'customer' | 'admin';

export const USER_ROLES: readonly UserRole[] = ['customer', 'admin'] as const;

// What a caller passes in to create an account; the repository hashes the plain-text password
export interface NewUser {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  role?: UserRole;
}

// Profile fields a caller may change; undefined leaves a field as is. The role is changed
// only through UserRepository.updateRole, so it can't ride along on a profile update.
export type UserUpdate = Partial<Omit<NewUser, 'role'>>;

// An account as the API returns it. There is no password field, so the hash can't leak by accident.
export interface PublicUser {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  role: UserRole;
}
