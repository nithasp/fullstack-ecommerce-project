import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

// Returns distinct error codes (no_token / token_expired / token_invalid) for frontend token-refresh logic
export const verifyAuthToken = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: 'Access denied. No token provided.', code: 'no_token' });
      return;
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.tokenSecret) as { userId: number };
    req.user = decoded;
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
