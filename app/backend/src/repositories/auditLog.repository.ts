import pool from '../database';
import { AuditAction, AuditDetails, AuditLog, AuditLogFilters, NewAuditLog } from '../types/auditLog.types';
import { Queryable } from '../types/database.types';
import { Pagination } from '../types/pagination.types';
import { UserRole } from '../types/user.types';
import { clip } from '../utils/text';

export class AuditLogRepository {
  async create(entry: NewAuditLog, db: Queryable = pool): Promise<void> {
    await db.query(
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

  async index(filters: AuditLogFilters, page: Pagination, db: Queryable = pool): Promise<AuditLog[]> {
    const params: unknown[] = [];
    const sql = `SELECT * FROM audit_logs${where(filters, params)}
                 ORDER BY created_at DESC, id DESC
                 LIMIT $${params.push(page.limit)} OFFSET $${params.push(page.offset)}`;
    const { rows } = await db.query(sql, params);
    return rows.map(toAuditLog);
  }

  async count(filters: AuditLogFilters, db: Queryable = pool): Promise<number> {
    const params: unknown[] = [];
    const { rows } = await db.query(`SELECT COUNT(*) FROM audit_logs${where(filters, params)}`, params);
    return Number(rows[0]?.count ?? 0);
  }

  async deleteOlderThan(days: number, db: Queryable = pool): Promise<number> {
    const { rowCount } = await db.query(
      `DELETE FROM audit_logs WHERE created_at < NOW() - $1::int * INTERVAL '1 day'`,
      [days],
    );
    return rowCount ?? 0;
  }
}

function where(filters: AuditLogFilters, params: unknown[]): string {
  const conditions: string[] = [];
  if (filters.userId) conditions.push(`user_id = $${params.push(filters.userId)}`);
  if (filters.username) {
    conditions.push(`STRPOS(LOWER(username), $${params.push(filters.username.toLowerCase())}) > 0`);
  }
  if (filters.actions?.length) {
    conditions.push(`action = ANY($${params.push(filters.actions)}::varchar[])`);
  }
  if (filters.result === 'success') conditions.push('status_code < 400');
  if (filters.result === 'failure') conditions.push('status_code >= 400');
  if (filters.from) conditions.push(`created_at >= $${params.push(filters.from)}`);
  if (filters.to) conditions.push(`created_at < $${params.push(filters.to)}`);
  return conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
}

function toAuditLog(row: Record<string, unknown>): AuditLog {
  return {
    id: Number(row.id),
    createdAt: row.created_at as Date,
    userId: (row.user_id as number | null) ?? null,
    username: (row.username as string | null) ?? null,
    userRole: (row.user_role as UserRole | null) ?? null,
    action: row.action as AuditAction,
    event: row.event as string,
    method: (row.method as string | null) ?? null,
    path: (row.path as string | null) ?? null,
    statusCode: (row.status_code as number | null) ?? null,
    ipAddress: (row.ip_address as string | null) ?? null,
    userAgent: (row.user_agent as string | null) ?? null,
    details: (row.details as AuditDetails | null) ?? null,
  };
}
