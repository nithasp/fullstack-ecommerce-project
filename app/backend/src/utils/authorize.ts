import { Request } from 'express';
import { AppError } from './response';

export const isAdmin = (req: Request): boolean => req.user?.role === 'admin';

// Compares against the verified token user, so a user id taken from the URL, query or body can't reach another account.
// Admins may act on any account.
export function requireSelf(req: Request, userId: number): void {
  if (isAdmin(req)) return;
  if (userId !== req.user!.userId) throw new AppError('You can only access your own data', 403);
}
