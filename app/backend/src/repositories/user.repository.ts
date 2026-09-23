import pool from '../database';
import { Queryable } from '../types/database.types';
import { Pagination } from '../types/pagination.types';
import { NewUserRow, ProfileUpdate, PublicUser, StoredUser, UserRole } from '../types/user.types';

const SAFE_FIELDS = 'id, first_name, last_name, username, role';
const LIVE = 'deleted_at IS NULL';

export class UserRepository {
  async index(page: Pagination, db: Queryable = pool): Promise<PublicUser[]> {
    const { rows } = await db.query(
      `SELECT ${SAFE_FIELDS} FROM users WHERE ${LIVE} ORDER BY id ASC LIMIT $1 OFFSET $2`,
      [page.limit, page.offset],
    );
    return rows.map(toPublicUser);
  }

  async count(db: Queryable = pool): Promise<number> {
    const { rows } = await db.query(`SELECT COUNT(*) FROM users WHERE ${LIVE}`);
    return Number(rows[0].count);
  }

  async show(id: number, db: Queryable = pool): Promise<PublicUser | null> {
    const { rows } = await db.query(`SELECT ${SAFE_FIELDS} FROM users WHERE id = $1 AND ${LIVE}`, [id]);
    return rows[0] ? toPublicUser(rows[0]) : null;
  }

  async findByUsername(username: string, db: Queryable = pool): Promise<PublicUser | null> {
    const { rows } = await db.query(
      `SELECT ${SAFE_FIELDS} FROM users WHERE LOWER(username) = LOWER($1) AND ${LIVE}`,
      [username],
    );
    return rows[0] ? toPublicUser(rows[0]) : null;
  }

  // This and findCredentialsById are the only queries that read the password hash; neither returns a
  // closed account
  async findCredentials(username: string, db: Queryable = pool): Promise<StoredUser | null> {
    const { rows } = await db.query(
      `SELECT ${SAFE_FIELDS}, password, password_version FROM users
       WHERE LOWER(username) = LOWER($1) AND ${LIVE}`,
      [username],
    );
    if (!rows[0]) return null;
    return {
      ...toPublicUser(rows[0]),
      passwordHash: rows[0].password as string,
      passwordVersion: Number(rows[0].password_version),
    };
  }

  async findCredentialsById(id: number, db: Queryable = pool): Promise<StoredUser | null> {
    const { rows } = await db.query(
      `SELECT ${SAFE_FIELDS}, password, password_version FROM users WHERE id = $1 AND ${LIVE}`,
      [id],
    );
    if (!rows[0]) return null;
    return {
      ...toPublicUser(rows[0]),
      passwordHash: rows[0].password as string,
      passwordVersion: Number(rows[0].password_version),
    };
  }

  async create(user: NewUserRow, db: Queryable = pool): Promise<PublicUser> {
    const { rows } = await db.query(
      `INSERT INTO users (first_name, last_name, username, password, password_version, role)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${SAFE_FIELDS}`,
      [
        user.firstName,
        user.lastName,
        user.username,
        user.passwordHash,
        user.passwordVersion,
        user.role ?? 'customer',
      ],
    );
    return toPublicUser(rows[0]);
  }

  async updateProfile(id: number, changes: ProfileUpdate, db: Queryable = pool): Promise<PublicUser | null> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (changes.firstName !== undefined) fields.push(`first_name = $${values.push(changes.firstName)}`);
    if (changes.lastName !== undefined) fields.push(`last_name = $${values.push(changes.lastName)}`);
    if (changes.username !== undefined) fields.push(`username = $${values.push(changes.username)}`);
    if (!fields.length) return this.show(id, db);

    const { rows } = await db.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${values.push(id)} AND ${LIVE} RETURNING ${SAFE_FIELDS}`,
      values,
    );
    return rows[0] ? toPublicUser(rows[0]) : null;
  }

  async updatePassword(
    id: number,
    passwordHash: string,
    passwordVersion: number,
    db: Queryable = pool,
  ): Promise<boolean> {
    const { rowCount } = await db.query(
      `UPDATE users SET password = $1, password_version = $2 WHERE id = $3 AND ${LIVE}`,
      [passwordHash, passwordVersion, id],
    );
    return (rowCount ?? 0) > 0;
  }

  async updateRole(id: number, role: UserRole, db: Queryable = pool): Promise<PublicUser | null> {
    const { rows } = await db.query(
      `UPDATE users SET role = $1 WHERE id = $2 AND ${LIVE} RETURNING ${SAFE_FIELDS}`,
      [role, id],
    );
    return rows[0] ? toPublicUser(rows[0]) : null;
  }

  async anonymise(id: number, db: Queryable = pool): Promise<PublicUser | null> {
    const { rows } = await db.query(
      `WITH closing AS (
         SELECT ${SAFE_FIELDS} FROM users WHERE id = $1 AND ${LIVE} FOR UPDATE
       )
       UPDATE users u
       SET first_name = 'Deleted',
           last_name = 'User',
           username = 'deleted-' || u.id || '-' || substr(md5(random()::text), 1, 8),
           password = '',
           password_version = 2,
           role = 'customer',
           deleted_at = NOW()
       FROM closing
       WHERE u.id = closing.id
       RETURNING closing.id, closing.first_name, closing.last_name, closing.username, closing.role`,
      [id],
    );
    return rows[0] ? toPublicUser(rows[0]) : null;
  }
}

function toPublicUser(row: Record<string, unknown>): PublicUser {
  return {
    id: row.id as number,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    username: row.username as string,
    role: (row.role as UserRole | undefined) ?? 'customer',
  };
}
