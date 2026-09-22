import bcrypt from 'bcrypt';
import pool, { Queryable } from '../database';
import { NewUser, PublicUser, UserRole, UserUpdate } from '../types/user.types';
import { Pagination } from '../types/pagination.types';

const { BCRYPT_PASSWORD, SALT_ROUNDS } = process.env;
const SAFE_FIELDS = 'id, first_name, last_name, username, role';

const hashPassword = (password: string): Promise<string> =>
  bcrypt.hash(password + BCRYPT_PASSWORD, parseInt(SALT_ROUNDS as string));

export class UserRepository {
  async index(page?: Pagination): Promise<PublicUser[]> {
    const { rows } = page
      ? await pool.query(`SELECT ${SAFE_FIELDS} FROM users ORDER BY id ASC LIMIT $1 OFFSET $2`, [page.limit, page.offset])
      : await pool.query(`SELECT ${SAFE_FIELDS} FROM users ORDER BY id ASC`);
    return rows.map((row) => this.mapRow(row));
  }

  async count(): Promise<number> {
    const { rows } = await pool.query('SELECT COUNT(*) FROM users');
    return parseInt(rows[0].count, 10);
  }

  async show(id: number, db: Queryable = pool): Promise<PublicUser | null> {
    const { rows } = await db.query(`SELECT ${SAFE_FIELDS} FROM users WHERE id=$1`, [id]);
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async create(user: NewUser): Promise<PublicUser> {
    const hash = await hashPassword(user.password);
    const { rows } = await pool.query(
      `INSERT INTO users (first_name, last_name, username, password, role) VALUES ($1, $2, $3, $4, $5) RETURNING ${SAFE_FIELDS}`,
      [user.firstName, user.lastName, user.username, hash, user.role ?? 'customer']
    );
    return this.mapRow(rows[0]);
  }

  async update(id: number, changes: UserUpdate): Promise<PublicUser | null> {
    const fields: string[] = [];
    const values: (string | number)[] = [];
    let i = 1;

    if (changes.firstName) { fields.push(`first_name=$${i++}`); values.push(changes.firstName); }
    if (changes.lastName)  { fields.push(`last_name=$${i++}`);  values.push(changes.lastName); }
    if (changes.username)  { fields.push(`username=$${i++}`);   values.push(changes.username); }
    if (changes.password)  { fields.push(`password=$${i++}`);   values.push(await hashPassword(changes.password)); }

    if (!fields.length) return this.show(id);

    values.push(id);
    const { rows } = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id=$${i} RETURNING ${SAFE_FIELDS}`,
      values
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async delete(id: number): Promise<PublicUser | null> {
    const { rows } = await pool.query(`DELETE FROM users WHERE id=$1 RETURNING ${SAFE_FIELDS}`, [id]);
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async updateRole(id: number, role: UserRole): Promise<PublicUser | null> {
    const { rows } = await pool.query(
      `UPDATE users SET role=$1 WHERE id=$2 RETURNING ${SAFE_FIELDS}`,
      [role, id]
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async findByUsername(username: string): Promise<PublicUser | null> {
    const { rows } = await pool.query(`SELECT ${SAFE_FIELDS} FROM users WHERE username=$1`, [username]);
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async authenticate(username: string, password: string): Promise<PublicUser | null> {
    const { rows } = await pool.query('SELECT * FROM users WHERE username=$1', [username]);
    if (rows.length && await bcrypt.compare(password + BCRYPT_PASSWORD, rows[0].password)) {
      return this.mapRow(rows[0]);
    }
    return null;
  }

  // Builds the public shape only, so the password hash in a SELECT * row is dropped here
  private mapRow(row: Record<string, unknown>): PublicUser {
    return {
      id: row.id as number,
      firstName: row.first_name as string,
      lastName: row.last_name as string,
      username: row.username as string,
      role: (row.role as UserRole | undefined) ?? 'customer',
    };
  }
}
