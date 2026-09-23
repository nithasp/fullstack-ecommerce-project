import crypto from 'crypto';
import pool from '../database';
import { Queryable } from '../types/database.types';
import { StoredRefreshToken } from '../types/refreshToken.types';

// Only a SHA-256 hash of each token is stored, so a database leak doesn't hand out live sessions
const hashToken = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');

export class RefreshTokenRepository {
  async create(
    userId: number,
    expiresInMs: number,
    familyId: string = crypto.randomUUID(),
    db: Queryable = pool,
  ): Promise<string> {
    const token = crypto.randomBytes(40).toString('hex');
    await db.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at) VALUES ($1, $2, $3, $4)',
      [userId, hashToken(token), familyId, new Date(Date.now() + expiresInMs)],
    );
    return token;
  }

  // Marks a live, unused token as used and returns it. It is one conditional UPDATE, so when two
  // requests race with the same token only one of them gets the row back.
  async consume(token: string, db: Queryable = pool): Promise<StoredRefreshToken | null> {
    const { rows } = await db.query(
      `UPDATE refresh_tokens SET used_at = NOW()
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
       RETURNING *`,
      [hashToken(token)],
    );
    return rows[0] ? toRefreshToken(rows[0]) : null;
  }

  async findUsed(token: string, db: Queryable = pool): Promise<StoredRefreshToken | null> {
    const { rows } = await db.query(
      'SELECT * FROM refresh_tokens WHERE token_hash = $1 AND used_at IS NOT NULL',
      [hashToken(token)],
    );
    return rows[0] ? toRefreshToken(rows[0]) : null;
  }

  async deleteFamily(familyId: string, db: Queryable = pool): Promise<void> {
    await db.query('DELETE FROM refresh_tokens WHERE family_id = $1', [familyId]);
  }

  async deleteFamilyOf(token: string, db: Queryable = pool): Promise<number | null> {
    const { rows } = await db.query(
      'DELETE FROM refresh_tokens WHERE family_id = (SELECT family_id FROM refresh_tokens WHERE token_hash = $1) RETURNING user_id',
      [hashToken(token)],
    );
    return rows[0] ? (rows[0].user_id as number) : null;
  }

  async deleteAllForUser(userId: number, db: Queryable = pool): Promise<void> {
    await db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
  }

  // Used tokens are kept until they expire so a replay can still be recognised; this clears them out
  async deleteExpired(db: Queryable = pool): Promise<void> {
    await db.query('DELETE FROM refresh_tokens WHERE expires_at <= NOW()');
  }
}

function toRefreshToken(row: Record<string, unknown>): StoredRefreshToken {
  return {
    id: row.id as number,
    userId: row.user_id as number,
    familyId: row.family_id as string,
    expiresAt: row.expires_at as Date,
    usedAt: (row.used_at as Date | null) ?? null,
    createdAt: row.created_at as Date,
  };
}
