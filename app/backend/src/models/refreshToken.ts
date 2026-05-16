import crypto from 'crypto';
import client from '../database';
import { StoredRefreshToken } from '../types/refreshToken.types';

export class RefreshTokenStore {
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async create(userId: number, expiresInMs: number): Promise<string> {
    const token = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + expiresInMs);
    await client.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [userId, tokenHash, expiresAt]
    );
    return token;
  }

  async findByToken(token: string): Promise<StoredRefreshToken | null> {
    const { rows } = await client.query(
      'SELECT * FROM refresh_tokens WHERE token_hash = $1 AND expires_at > NOW()',
      [this.hashToken(token)]
    );
    return rows[0] || null;
  }

  async deleteByToken(token: string): Promise<boolean> {
    const result = await client.query(
      'DELETE FROM refresh_tokens WHERE token_hash = $1',
      [this.hashToken(token)]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async deleteAllForUser(userId: number): Promise<void> {
    await client.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
  }

  async deleteExpired(): Promise<void> {
    await client.query('DELETE FROM refresh_tokens WHERE expires_at <= NOW()');
  }
}
