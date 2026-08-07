import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

// Returns distinct error codes (no_token / token_expired / token_invalid) for frontend token-refresh logic
export const verifyAuthToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: 'Access denied. No token provided.', code: 'no_token' });
    return;
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    res.status(401).json({ error: 'Invalid token.', code: 'token_invalid' });
    return;
  }

  try {
    req.user = jwt.verify(token, config.jwt.secret) as { userId: number };
    next();
  } catch (err) {
    if ((err as { name?: string }).name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Access token has expired.', code: 'token_expired' });
    } else {
      res.status(401).json({ error: 'Invalid token.', code: 'token_invalid' });
    }
  }
};
