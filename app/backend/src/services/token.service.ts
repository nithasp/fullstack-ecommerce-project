import jwt from 'jsonwebtoken';
import { config } from '../config';
import { withTransaction } from '../database';
import { logger } from '../logger';
import { RefreshTokenRepository } from '../repositories/refreshToken.repository';
import { UserRepository } from '../repositories/user.repository';
import { AccessTokenPayload, TokenPair } from '../types/auth.types';
import { AuditSource } from '../types/auditLog.types';
import { PublicUser, USER_ROLES, UserRole } from '../types/user.types';
import { AppError } from '../utils/response';
import { recordEvent } from './audit.service';

const refreshTokens = new RefreshTokenRepository();
const users = new UserRepository();

// Pinned when signing and when verifying, so a token can't pick the algorithm it is checked with
const JWT_ALGORITHM: jwt.Algorithm = 'HS256';
const INVALID_REFRESH_TOKEN = 'Invalid or expired refresh token';

// The role claim is only ever used to describe a request in the audit log; every authorization
// check reads the role from the database (OWASP API5)
export function signAccessToken(user: Pick<PublicUser, 'id' | 'role'>): string {
  return jwt.sign({ userId: user.id, role: user.role }, config.tokenSecret, {
    algorithm: JWT_ALGORITHM,
    expiresIn: config.accessTokenExpiry as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): { userId: number; role: UserRole } {
  const decoded = jwt.verify(token, config.tokenSecret, {
    algorithms: [JWT_ALGORITHM],
  }) as AccessTokenPayload;
  if (typeof decoded.userId !== 'number') throw new jwt.JsonWebTokenError('token has no numeric userId');
  const role = USER_ROLES.includes(decoded.role as UserRole) ? (decoded.role as UserRole) : 'customer';
  return { userId: decoded.userId, role };
}

export async function issueSession(user: PublicUser): Promise<TokenPair> {
  const refreshToken = await refreshTokens.create(user.id, config.refreshTokenExpiryMs);
  refreshTokens
    .deleteExpired()
    .catch((err: unknown) => logger.warn({ err }, 'could not clear expired tokens'));
  return { accessToken: signAccessToken(user), refreshToken };
}

/**
 * Exchanges a refresh token for a new pair. Consuming the old token and storing its successor
 * happen in one transaction, and consuming is a single conditional UPDATE, so two requests racing
 * with the same token can't both walk away with a new pair.
 *
 * A token that was already exchanged and turns up again has been copied: one of its two holders
 * is not the user, and there is no telling which. So the whole session (every token in the
 * family) is revoked and the user signs in again.
 */
export async function rotateRefreshToken(
  token: string,
  source: AuditSource = {},
): Promise<TokenPair & { user: PublicUser }> {
  const rotated = await withTransaction(async (tx) => {
    const consumed = await refreshTokens.consume(token, tx);
    if (!consumed) return null;

    const user = await users.show(consumed.userId, tx);
    if (!user) throw new AppError(INVALID_REFRESH_TOKEN, 401, 'token_invalid');

    const refreshToken = await refreshTokens.create(
      user.id,
      config.refreshTokenExpiryMs,
      consumed.familyId,
      tx,
    );
    return { user, accessToken: signAccessToken(user), refreshToken };
  });
  if (rotated) return rotated;

  const reused = await refreshTokens.findUsed(token);
  if (reused) {
    await refreshTokens.deleteFamily(reused.familyId);
    logger.warn({ event: 'auth.refresh_token_reuse', userId: reused.userId }, 'refresh token reuse detected');
    recordEvent({
      ...source,
      userId: reused.userId,
      action: 'SECURITY',
      event: 'auth.refresh_token_reuse',
      statusCode: 401,
    });
  }
  throw new AppError(INVALID_REFRESH_TOKEN, 401, 'token_invalid');
}

export async function revokeSession(refreshToken: string): Promise<number | null> {
  return refreshTokens.deleteFamilyOf(refreshToken);
}

// Logout everywhere; also used when a role, a password or an account changes so the old session
// cannot be renewed
export async function revokeAllSessions(userId: number): Promise<void> {
  await refreshTokens.deleteAllForUser(userId);
}
