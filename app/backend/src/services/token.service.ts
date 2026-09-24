import jwt from 'jsonwebtoken';
import { config } from '../config';
import { withTransaction } from '../database';
import { logger } from '../logger';
import { AccessTokenPayload, TokenPair } from '../types/auth.types';
import { AuditSource } from '../types/auditLog.types';
import { TokenServiceDeps } from '../types/service.types';
import { PublicUser, USER_ROLES, UserRole } from '../types/user.types';
import { AppError } from '../utils/errors';

// Pinned when signing and when verifying, so a token can't pick the algorithm it is checked with
const JWT_ALGORITHM: jwt.Algorithm = 'HS256';
const INVALID_REFRESH_TOKEN = 'Invalid or expired refresh token';

// A replay this soon after the token's own rotation is renewed; past the window a second use is
// taken as a copied token and the whole session is revoked (OWASP API2)
const REUSE_GRACE_MS = 10_000;

// The role claim is only ever used to describe a request in the audit log; every authorization
// check reads the role from the database (OWASP API5)
export function signAccessToken(user: Pick<PublicUser, 'id' | 'role'>): string {
  return jwt.sign({ userId: user.id, role: user.role }, config.tokenSecret, {
    algorithm: JWT_ALGORITHM,
    expiresIn: config.accessTokenExpiry as NonNullable<jwt.SignOptions['expiresIn']>,
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

function issue(user: PublicUser, refreshToken: string): TokenPair & { user: PublicUser } {
  return { user, accessToken: signAccessToken(user), refreshToken };
}

export function createTokenService({ refreshTokens, users, audit }: TokenServiceDeps) {
  return {
    async issueSession(user: PublicUser): Promise<TokenPair> {
      const refreshToken = await refreshTokens.create(user.id, config.refreshTokenExpiryMs);
      refreshTokens
        .deleteExpired()
        .catch((err: unknown) => logger.warn({ err }, 'could not clear expired tokens'));
      return { accessToken: signAccessToken(user), refreshToken };
    },

    async rotateRefreshToken(
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
        return issue(user, refreshToken);
      });
      if (rotated) return rotated;

      // A revoked family is deleted outright, so a row here means the session is still live
      const reused = await refreshTokens.findUsed(token);
      if (!reused) throw new AppError(INVALID_REFRESH_TOKEN, 401, 'token_invalid');

      const now = Date.now();
      const withinGrace = reused.usedAt !== null && now - reused.usedAt.getTime() <= REUSE_GRACE_MS;

      if (withinGrace && reused.expiresAt.getTime() > now) {
        const renewed = await withTransaction(async (tx) => {
          const user = await users.show(reused.userId, tx);
          if (!user) return null;

          const refreshToken = await refreshTokens.create(
            user.id,
            config.refreshTokenExpiryMs,
            reused.familyId,
            tx,
          );
          return issue(user, refreshToken);
        });
        if (renewed) return renewed;
      }

      await refreshTokens.deleteFamily(reused.familyId);
      logger.warn(
        { event: 'auth.refresh_token_reuse', userId: reused.userId },
        'refresh token reuse detected',
      );
      audit.recordEvent({
        ...source,
        userId: reused.userId,
        action: 'SECURITY',
        event: 'auth.refresh_token_reuse',
        statusCode: 401,
      });
      throw new AppError(INVALID_REFRESH_TOKEN, 401, 'token_invalid');
    },

    async revokeSession(refreshToken: string): Promise<number | null> {
      return refreshTokens.deleteFamilyOf(refreshToken);
    },

    async revokeAllSessions(userId: number): Promise<void> {
      await refreshTokens.deleteAllForUser(userId);
    },
  };
}

export type TokenService = ReturnType<typeof createTokenService>;
