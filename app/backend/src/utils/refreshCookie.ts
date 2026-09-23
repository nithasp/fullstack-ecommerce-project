import { Request, Response } from 'express';
import { config } from '../config';

const { name, path, sameSite, httpOnly, secure, maxAgeMs } = config.refreshCookie;

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(name, token, { httpOnly, secure, sameSite, path, maxAge: maxAgeMs });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(name, { httpOnly, secure, sameSite, path });
}

export function readRefreshCookie(req: Request): string | null {
  const token: unknown = req.cookies?.[name];
  return typeof token === 'string' && token.length > 0 ? token : null;
}
