import { Request, Response, NextFunction } from 'express';
import { UserRepository } from '../repositories/user.repository';
import { verifyAccessToken } from '../services/token.service';

const users = new UserRepository();

export const verifyAuthToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: 'Access denied. No token provided.', code: 'no_token' });
    return;
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    res.status(401).json({ error: 'Invalid token.', code: 'token_invalid' });
    return;
  }

  try {
    req.user = verifyAccessToken(token);
  } catch (err) {
    const jwtErr = err as { name?: string };
    if (jwtErr.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Access token has expired.', code: 'token_expired' });
    } else {
      res.status(401).json({ error: 'Invalid token.', code: 'token_invalid' });
    }
    return;
  }
  next();
};

// Admin routes re-read the role from the database instead of trusting the JWT claim alone,
// so a demoted or deleted admin loses access immediately, not when the token expires (OWASP API5)
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Access denied. No token provided.', code: 'no_token' });
      return;
    }
    const user = await users.show(req.user.userId);
    if (!user) {
      res.status(401).json({ error: 'Invalid token.', code: 'token_invalid' });
      return;
    }
    if (user.role !== 'admin') {
      res.status(403).json({ status: 403, message: 'Admin access required', data: null });
      return;
    }
    req.user.role = 'admin';
    next();
  } catch (err) {
    next(err);
  }
};
