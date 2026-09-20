import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UserStore } from '../models/user';
import { USER_ROLES, UserRole } from '../types/user.types';
import { AccessTokenPayload } from '../types/auth.types';

const userStore = new UserStore();

// Returns distinct error codes (no_token / token_expired / token_invalid) for frontend token-refresh logic
export const verifyAuthToken = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: 'Access denied. No token provided.', code: 'no_token' });
      return;
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.tokenSecret) as AccessTokenPayload;
    if (typeof decoded.userId !== 'number') {
      res.status(401).json({ error: 'Invalid token.', code: 'token_invalid' });
      return;
    }
    // Tokens issued before roles existed carry no role and are treated as customers
    const role: UserRole = USER_ROLES.includes(decoded.role as UserRole) ? (decoded.role as UserRole) : 'customer';
    req.user = { userId: decoded.userId, role };
    next();
  } catch (err) {
    const jwtErr = err as { name?: string };
    if (jwtErr.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Access token has expired.', code: 'token_expired' });
    } else {
      res.status(401).json({ error: 'Invalid token.', code: 'token_invalid' });
    }
  }
};

// Admin routes re-read the role from the database instead of trusting the JWT claim alone,
// so a demoted or deleted admin loses access immediately, not when the token expires (OWASP API5)
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Access denied. No token provided.', code: 'no_token' });
      return;
    }
    const user = await userStore.show(req.user.userId);
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

// Records who changed what through the admin API (OWASP API9/API10 monitoring)
export const auditAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'GET') return next();
  res.on('finish', () => {
    console.info(JSON.stringify({
      event: 'admin.action',
      at: new Date().toISOString(),
      adminId: req.user?.userId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
    }));
  });
  next();
};
