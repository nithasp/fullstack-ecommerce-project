export const USER_ROLES = ['customer', 'admin'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface PublicUser {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  role: UserRole;
}

// Never sent to a client: it carries the password hash
export interface StoredUser extends PublicUser {
  passwordHash: string;
  passwordVersion: number;
}

export interface NewUser {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  role?: UserRole;
}

export interface NewUserRow extends Omit<NewUser, 'password'> {
  passwordHash: string;
  passwordVersion: number;
}

export interface ProfileUpdate {
  firstName?: string;
  lastName?: string;
  username?: string;
}
