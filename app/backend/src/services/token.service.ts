import jwt from 'jsonwebtoken';
import { config } from '../config';
import { withTransaction } from '../database';
import { RefreshTokenRepository } from '../repositories/refreshToken.repository';
import { UserRepository } from '../repositories/user.repository';
import { AppError } from '../utils/response';
import { AccessTokenPayload, TokenPair } from '../types/auth.types';
import { PublicUser, USER_ROLES, UserRole } from '../types/user.types';

/**
 * Every token rule lives here: signing and verifying access tokens, and issuing, rotating and
 * revoking refresh tokens. The auth controller and the auth middleware both call in, so what
 * makes a token valid is written once.
 */

const refreshTokens = new RefreshTokenRepository();
const users = new UserRepository();

// Pinned when signing and when verifying, so a token can't pick the algorithm it is checked with
const JWT_ALGORITHM: jwt.Algorithm = 'HS256';
const INVALID_REFRESH_TOKEN = 'Invalid or expired refresh token';

// The role claim lets ordinary routes authorize without a DB hit; admin routes re-verify it against the DB
export function signAccessToken(user: Pick<PublicUser, 'id' | 'role'>): string {
  return jwt.sign({ userId: user.id, role: user.role }, config.tokenSecret, {
    algorithm: JWT_ALGORITHM,
    expiresIn: config.accessTokenExpiry as jwt.SignOptions['expiresIn'],
  });
}

// Throws jsonwebtoken's TokenExpiredError or JsonWebTokenError; the auth middleware maps them to 401 codes
export function verifyAccessToken(token: string): { userId: number; role: UserRole } {
  const decoded = jwt.verify(token, config.tokenSecret, { algorithms: [JWT_ALGORITHM] }) as AccessTokenPayload;
  if (typeof decoded.userId !== 'number') throw new jwt.JsonWebTokenError('token has no numeric userId');
  // Tokens issued before roles existed carry no role and are treated as customers
  const role = USER_ROLES.includes(decoded.role as UserRole) ? (decoded.role as UserRole) : 'customer';
  return { userId: decoded.userId, role };
}

// Login and registration start a new session, which is a new refresh-token family
export async function issueTokens(user: PublicUser): Promise<TokenPair> {
  const refreshToken = await refreshTokens.create(user.id, config.refreshTokenExpiryMs);
  // Fire-and-forget: clean up expired tokens without blocking the response
  refreshTokens.deleteExpired().catch(() => {});
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
export async function rotateRefreshToken(token: string): Promise<TokenPair> {
  const pair = await withTransaction(async (tx) => {
    const consumed = await refreshTokens.consume(token, tx);
    if (!consumed) return null;

    // Re-read the account so the new access token carries the current role
    const user = await users.show(consumed.userId, tx);
    if (!user) throw new AppError(INVALID_REFRESH_TOKEN, 401);

    const refreshToken = await refreshTokens.create(user.id, config.refreshTokenExpiryMs, consumed.familyId, tx);
    return { accessToken: signAccessToken(user), refreshToken };
  });
  if (pair) return pair;

  const reused = await refreshTokens.findUsed(token);
  if (reused) {
    await refreshTokens.deleteFamily(reused.familyId);
    console.warn(JSON.stringify({
      event: 'auth.refresh_token_reuse',
      at: new Date().toISOString(),
      userId: reused.userId,
    }));
  }
  throw new AppError(INVALID_REFRESH_TOKEN, 401);
}

// Logout: ends the session this refresh token belongs to
export async function revokeSession(refreshToken: string): Promise<void> {
  await refreshTokens.deleteFamilyOf(refreshToken);
}

// Logout everywhere; also used on a role change so the old privilege can't be renewed
export async function revokeAllSessions(userId: number): Promise<void> {
  await refreshTokens.deleteAllForUser(userId);
}
