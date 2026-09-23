import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../services/token.service';
import { findUser } from '../services/user.service';
import { sendError } from '../utils/response';

export const verifyAuthToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    sendError(res, 401, 'Access denied. No token provided.', 'no_token');
    return;
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    sendError(res, 401, 'Invalid token.', 'token_invalid');
    return;
  }

  try {
    req.user = verifyAccessToken(token);
  } catch (err) {
    const name = (err as { name?: string }).name;
    if (name === 'TokenExpiredError') {
      sendError(res, 401, 'Access token has expired.', 'token_expired');
    } else {
      sendError(res, 401, 'Invalid token.', 'token_invalid');
    }
    return;
  }
  next();
};

// The role is read from the database on every admin request, so a demoted, closed or deleted
// admin loses access at once instead of when the token expires (OWASP API5)
export const requireAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, 401, 'Access denied. No token provided.', 'no_token');
      return;
    }

    const user = await findUser(req.user.userId);
    if (!user) {
      sendError(res, 401, 'Invalid token.', 'token_invalid');
      return;
    }
    if (user.role !== 'admin') {
      sendError(res, 403, 'Admin access required', 'forbidden');
      return;
    }

    req.user.role = 'admin';
    next();
  } catch (err) {
    next(err);
  }
};
