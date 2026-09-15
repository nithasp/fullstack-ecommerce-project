import { Request } from 'express';
import { AppError } from './response';

// Compares against the verified token user, so a user id taken from the URL, query or body can't reach another account
export function requireSelf(req: Request, userId: number): void {
  if (userId !== req.user!.userId) throw new AppError('You can only access your own data', 403);
}
