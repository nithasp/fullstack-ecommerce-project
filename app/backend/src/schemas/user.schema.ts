import { z } from 'zod';
import { USER_ROLES } from '../types/user.types';
import { optionalText, password, requiredText } from './common.schema';

export const roleSchema = z.enum(USER_ROLES, { error: `must be one of: ${USER_ROLES.join(', ')}` });

export const newUserSchema = z.object({
  firstName: requiredText(100),
  lastName: requiredText(100),
  username: requiredText(100),
  password,
});

export const adminNewUserSchema = newUserSchema.extend({ role: roleSchema.default('customer') });

// The role is not accepted here, so a profile update can never grant privileges (OWASP API3)
export const profileUpdateSchema = z
  .object({
    firstName: optionalText(100),
    lastName: optionalText(100),
    username: optionalText(100),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    error: 'at least one of firstName, lastName or username is required',
  });

export const changePasswordSchema = z.object({
  currentPassword: z.string('is required').min(1, 'is required'),
  newPassword: password,
});

export const resetPasswordSchema = z.object({ newPassword: password });

export const roleUpdateSchema = z.object({ role: roleSchema });

export type NewUserInput = z.infer<typeof newUserSchema>;
export type AdminNewUserInput = z.infer<typeof adminNewUserSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
