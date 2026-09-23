import pool from '../database';
import { AuditAction, AuditDetails, AuditLog, AuditLogFilters, NewAuditLog } from '../types/auditLog.types';
import { Pagination } from '../types/pagination.types';
import { UserRole } from '../types/user.types';

// Cuts a value to its column's width. Much of a row is request data (a path, a user agent, a
// username someone typed), and an oversized value should shorten the row, not lose it.
const clip = (val: string | null | undefined, max: number): string | null => (val ? val.slice(0, max) : null);

export class AuditLogRepository {
  async create(entry: NewAuditLog): Promise<void> {
    await pool.query(
      `INSERT INTO audit_logs
         (user_id, username, user_role, action, event, method, path, status_code, ip_address, user_agent, details)
       VALUES (
         COALESCE($1::int, (SELECT id FROM users WHERE username = $2)),
         COALESCE($2, (SELECT username FROM users WHERE id = $1::int)),
         $3, $4, $5, $6, $7, $8, $9, $10, $11
       )`,
      [
        entry.userId ?? null,
        clip(entry.username, 100),
        entry.userRole ?? null,
        entry.action,
        clip(entry.event, 60),
        clip(entry.method, 10),
        clip(entry.path, 255),
        entry.statusCode ?? null,
        clip(entry.ipAddress, 45),
        clip(entry.userAgent, 255),
        entry.details ? JSON.stringify(entry.details) : null,
      ],
    );
  }

  async index(filters: AuditLogFilters, page: Pagination): Promise<AuditLog[]> {
    const params: unknown[] = [];
    let sql = `SELECT * FROM audit_logs${this.where(filters, params)}`;
    params.push(page.limit);
    sql += ` ORDER BY created_at DESC, id DESC LIMIT $${params.length}`;
    params.push(page.offset);
    sql += ` OFFSET $${params.length}`;
    const { rows } = await pool.query(sql, params);
    return rows.map((row) => this.mapRow(row));
  }

  async count(filters: AuditLogFilters): Promise<number> {
    const params: unknown[] = [];
    const { rows } = await pool.query(
      `SELECT COUNT(*) FROM audit_logs${this.where(filters, params)}`,
      params,
    );
    return parseInt(rows[0].count, 10);
  }

  async deleteOlderThan(days: number): Promise<number> {
    const { rowCount } = await pool.query(
      `DELETE FROM audit_logs WHERE created_at < NOW() - $1::int * INTERVAL '1 day'`,
      [days],
    );
    return rowCount ?? 0;
  }

  private where(filters: AuditLogFilters, params: unknown[]): string {
    const conditions: string[] = [];
    if (filters.userId) {
      params.push(filters.userId);
      conditions.push(`user_id = $${params.length}`);
    }
    if (filters.username) {
      params.push(filters.username.toLowerCase());
      conditions.push(`STRPOS(LOWER(username), $${params.length}) > 0`);
    }
    if (filters.actions?.length) {
      params.push(filters.actions);
      conditions.push(`action = ANY($${params.length}::varchar[])`);
    }
    if (filters.result === 'success') conditions.push('status_code < 400');
    if (filters.result === 'failure') conditions.push('status_code >= 400');
    if (filters.from) {
      params.push(filters.from);
      conditions.push(`created_at >= $${params.length}`);
    }
    if (filters.to) {
      params.push(filters.to);
      conditions.push(`created_at < $${params.length}`);
    }
    return conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
  }

  private mapRow(row: Record<string, unknown>): AuditLog {
    return {
      id: Number(row.id),
      createdAt: row.created_at as Date,
      userId: row.user_id as number | null,
      username: row.username as string | null,
      userRole: row.user_role as UserRole | null,
      action: row.action as AuditAction,
      event: row.event as string,
      method: row.method as string | null,
      path: row.path as string | null,
      statusCode: row.status_code as number | null,
      ipAddress: row.ip_address as string | null,
      userAgent: row.user_agent as string | null,
      details: row.details as AuditDetails | null,
    };
  }
}
