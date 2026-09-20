import client from '../database';
import bcrypt from 'bcrypt';
import { User, UserRole } from '../types/user.types';
import { Pagination } from '../types/pagination.types';

const { BCRYPT_PASSWORD, SALT_ROUNDS } = process.env;
const SAFE_FIELDS = 'id, first_name, last_name, username, role';

export class UserStore {
  async index(page?: Pagination): Promise<User[]> {
    const { rows } = page
      ? await client.query(`SELECT ${SAFE_FIELDS} FROM users ORDER BY id ASC LIMIT $1 OFFSET $2`, [page.limit, page.offset])
      : await client.query(`SELECT ${SAFE_FIELDS} FROM users ORDER BY id ASC`);
    return rows.map(this.mapRow);
  }

  async show(id: number): Promise<User> {
    const { rows } = await client.query(`SELECT ${SAFE_FIELDS} FROM users WHERE id=$1`, [id]);
    return rows[0] ? this.mapRow(rows[0]) : rows[0];
  }

  async create(user: User): Promise<User> {
    const hash = bcrypt.hashSync(user.password + BCRYPT_PASSWORD, parseInt(SALT_ROUNDS as string));
    const { rows } = await client.query(
      `INSERT INTO users (first_name, last_name, username, password, role) VALUES ($1, $2, $3, $4, $5) RETURNING ${SAFE_FIELDS}`,
      [user.firstName, user.lastName, user.username, hash, user.role ?? 'customer']
    );
    return this.mapRow(rows[0]);
  }

  async update(id: number, user: Partial<User>): Promise<User> {
    const fields: string[] = [];
    const values: (string | number)[] = [];
    let i = 1;

    if (user.firstName) { fields.push(`first_name=$${i++}`); values.push(user.firstName); }
    if (user.lastName)  { fields.push(`last_name=$${i++}`);  values.push(user.lastName); }
    if (user.username)  { fields.push(`username=$${i++}`);   values.push(user.username); }
    if (user.password) {
      const hash = bcrypt.hashSync(user.password + BCRYPT_PASSWORD, parseInt(SALT_ROUNDS as string));
      fields.push(`password=$${i++}`);
      values.push(hash);
    }
    if (user.role)      { fields.push(`role=$${i++}`);       values.push(user.role); }

    values.push(id);
    const { rows } = await client.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id=$${i} RETURNING ${SAFE_FIELDS}`,
      values
    );
    return rows[0] ? this.mapRow(rows[0]) : rows[0];
  }

  async delete(id: number): Promise<User> {
    const { rows } = await client.query(
      `DELETE FROM users WHERE id=$1 RETURNING ${SAFE_FIELDS}`,
      [id]
    );
    return rows[0] ? this.mapRow(rows[0]) : rows[0];
  }

  async updateRole(id: number, role: UserRole): Promise<User | undefined> {
    const { rows } = await client.query(
      `UPDATE users SET role=$1 WHERE id=$2 RETURNING ${SAFE_FIELDS}`,
      [role, id]
    );
    return rows[0] ? this.mapRow(rows[0]) : rows[0];
  }

  async findByUsername(username: string): Promise<User | undefined> {
    const { rows } = await client.query(`SELECT ${SAFE_FIELDS} FROM users WHERE username=$1`, [username]);
    return rows[0] ? this.mapRow(rows[0]) : rows[0];
  }

  async authenticate(username: string, password: string): Promise<User | null> {
    const { rows } = await client.query('SELECT * FROM users WHERE username=$1', [username]);
    if (rows.length && bcrypt.compareSync(password + BCRYPT_PASSWORD, rows[0].password)) {
      const { password: _pw, ...safeUser } = rows[0];
      return this.mapRow(safeUser);
    }
    return null;
  }

  private mapRow(row: Record<string, unknown>): User {
    return {
      id: row.id as number | undefined,
      firstName: row.first_name as string,
      lastName: row.last_name as string,
      username: row.username as string,
      password: row.password as string,
      role: (row.role as UserRole | undefined) ?? 'customer',
    };
  }
}
