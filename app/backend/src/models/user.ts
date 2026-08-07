import bcrypt from 'bcrypt';
import client from '../database';
import { config } from '../config';
import { buildSetAssignments } from '../utils/sql';
import { User } from '../types/user.types';

const SAFE_FIELDS = 'id, first_name, last_name, username';

export class UserStore {
  async index(): Promise<User[]> {
    const { rows } = await client.query(`SELECT ${SAFE_FIELDS} FROM users`);
    return rows.map(this.mapRow);
  }

  async show(id: number): Promise<User | null> {
    const { rows } = await client.query(`SELECT ${SAFE_FIELDS} FROM users WHERE id=$1`, [id]);
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async create(user: User): Promise<User> {
    const hash = await this.hashPassword(user.password);
    const { rows } = await client.query(
      `INSERT INTO users (first_name, last_name, username, password) VALUES ($1, $2, $3, $4) RETURNING ${SAFE_FIELDS}`,
      [user.firstName, user.lastName, user.username, hash]
    );
    return this.mapRow(rows[0]);
  }

  async update(id: number, user: Partial<User>): Promise<User | null> {
    const { assignments, values } = buildSetAssignments({
      first_name: user.firstName,
      last_name: user.lastName,
      username: user.username,
      password: user.password ? await this.hashPassword(user.password) : undefined,
    });
    if (assignments.length === 0) return this.show(id);

    values.push(id);
    const { rows } = await client.query(
      `UPDATE users SET ${assignments.join(', ')} WHERE id=$${values.length} RETURNING ${SAFE_FIELDS}`,
      values
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async delete(id: number): Promise<User | null> {
    const { rows } = await client.query(
      `DELETE FROM users WHERE id=$1 RETURNING ${SAFE_FIELDS}`,
      [id]
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const { rows } = await client.query(`SELECT ${SAFE_FIELDS} FROM users WHERE username=$1`, [username]);
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async authenticate(username: string, password: string): Promise<User | null> {
    const { rows } = await client.query('SELECT * FROM users WHERE username=$1', [username]);
    if (rows.length && (await bcrypt.compare(password + config.bcrypt.pepper, rows[0].password))) {
      const { password: _pw, ...safeUser } = rows[0];
      return this.mapRow(safeUser);
    }
    return null;
  }

  private hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password + config.bcrypt.pepper, config.bcrypt.saltRounds);
  }

  private mapRow(row: Record<string, unknown>): User {
    return {
      id: row.id as number | undefined,
      firstName: row.first_name as string,
      lastName: row.last_name as string,
      username: row.username as string,
      password: row.password as string,
    };
  }
}
