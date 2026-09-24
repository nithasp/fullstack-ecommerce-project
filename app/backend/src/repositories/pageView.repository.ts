import pool from '../database';
import { Queryable } from '../types/database.types';
import { NewPageView, PageView, PageViewFilters } from '../types/pageView.types';
import { Pagination } from '../types/pagination.types';
import { clip } from '../utils/text';

export class PageViewRepository {
  async create(view: NewPageView, db: Queryable = pool): Promise<void> {
    await db.query(
      `INSERT INTO page_views (user_id, username, path, page, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        view.userId,
        clip(view.username, 100),
        clip(view.path, 255),
        clip(view.page, 60),
        clip(view.ipAddress, 45),
        clip(view.userAgent, 255),
      ],
    );
  }

  async index(filters: PageViewFilters, page: Pagination, db: Queryable = pool): Promise<PageView[]> {
    const params: unknown[] = [];
    const sql = `SELECT * FROM page_views${where(filters, params)}
                 ORDER BY created_at DESC, id DESC
                 LIMIT $${params.push(page.limit)} OFFSET $${params.push(page.offset)}`;
    const { rows } = await db.query(sql, params);
    return rows.map(toPageView);
  }

  async count(filters: PageViewFilters, db: Queryable = pool): Promise<number> {
    const params: unknown[] = [];
    const { rows } = await db.query(`SELECT COUNT(*) FROM page_views${where(filters, params)}`, params);
    return Number(rows[0]?.count ?? 0);
  }

  async deleteOlderThan(days: number, db: Queryable = pool): Promise<number> {
    const { rowCount } = await db.query(
      `DELETE FROM page_views WHERE created_at < NOW() - $1::int * INTERVAL '1 day'`,
      [days],
    );
    return rowCount ?? 0;
  }
}

function where(filters: PageViewFilters, params: unknown[]): string {
  const conditions: string[] = [];
  if (filters.userId) conditions.push(`user_id = $${params.push(filters.userId)}`);
  if (filters.username) {
    conditions.push(`STRPOS(LOWER(username), $${params.push(filters.username.toLowerCase())}) > 0`);
  }
  if (filters.path) conditions.push(`STRPOS(LOWER(path), $${params.push(filters.path.toLowerCase())}) > 0`);
  if (filters.from) conditions.push(`created_at >= $${params.push(filters.from)}`);
  if (filters.to) conditions.push(`created_at < $${params.push(filters.to)}`);
  return conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
}

function toPageView(row: Record<string, unknown>): PageView {
  return {
    id: Number(row.id),
    createdAt: row.created_at as Date,
    userId: (row.user_id as number | null) ?? null,
    username: (row.username as string | null) ?? null,
    path: row.path as string,
    page: (row.page as string | null) ?? null,
    ipAddress: (row.ip_address as string | null) ?? null,
    userAgent: (row.user_agent as string | null) ?? null,
  };
}
