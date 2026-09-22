import pool, { withTransaction } from '../database';
import { Address, AddressForm, AddressLabel } from '../types/address.types';
import { Pagination } from '../types/pagination.types';

export class AddressRepository {
  async getByUser(userId: number): Promise<Address[]> {
    const { rows } = await pool.query(
      `SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at ASC`,
      [userId]
    );
    return rows.map((row) => this.mapRow(row));
  }

  // Admin: every user's addresses, optionally filtered to one user
  async getAll(filters: { userId?: number }, page: Pagination): Promise<Address[]> {
    const params: number[] = [];
    let sql = `SELECT * FROM addresses${this.where(filters, params)}`;
    params.push(page.limit);  sql += ` ORDER BY user_id ASC, is_default DESC, created_at ASC LIMIT $${params.length}`;
    params.push(page.offset); sql += ` OFFSET $${params.length}`;
    const { rows } = await pool.query(sql, params);
    return rows.map((row) => this.mapRow(row));
  }

  async count(filters: { userId?: number }): Promise<number> {
    const params: number[] = [];
    const { rows } = await pool.query(`SELECT COUNT(*) FROM addresses${this.where(filters, params)}`, params);
    return parseInt(rows[0].count, 10);
  }

  // Admin: an address by id regardless of owner
  async showById(id: number): Promise<Address | null> {
    const { rows } = await pool.query(`SELECT * FROM addresses WHERE id = $1`, [id]);
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async show(id: number, userId: number): Promise<Address | null> {
    const { rows } = await pool.query(
      `SELECT * FROM addresses WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async create(userId: number, form: AddressForm): Promise<Address> {
    return withTransaction(async (tx) => {
      if (form.isDefault) {
        await tx.query(`UPDATE addresses SET is_default = false WHERE user_id = $1`, [userId]);
      }

      const { rows: existing } = await tx.query(
        `SELECT COUNT(*) FROM addresses WHERE user_id = $1`,
        [userId]
      );
      const isFirst = parseInt(existing[0].count, 10) === 0;

      const { rows } = await tx.query(
        `INSERT INTO addresses (user_id, full_name, phone, address, city, label, is_default)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [userId, form.fullName, form.phone ?? null, form.address, form.city, form.label, form.isDefault || isFirst]
      );
      return this.mapRow(rows[0]);
    });
  }

  async update(id: number, userId: number, form: Partial<AddressForm>): Promise<Address | null> {
    return withTransaction(async (tx) => {
      if (form.isDefault) {
        await tx.query(`UPDATE addresses SET is_default = false WHERE user_id = $1`, [userId]);
      }

      const fields: string[] = [];
      const values: (string | number | boolean | null)[] = [];
      let i = 1;

      if (form.fullName !== undefined) { fields.push(`full_name = $${i++}`);  values.push(form.fullName); }
      if (form.phone !== undefined)    { fields.push(`phone = $${i++}`);      values.push(form.phone ?? null); }
      if (form.address !== undefined)  { fields.push(`address = $${i++}`);    values.push(form.address); }
      if (form.city !== undefined)     { fields.push(`city = $${i++}`);       values.push(form.city); }
      if (form.label !== undefined)    { fields.push(`label = $${i++}`);      values.push(form.label); }
      if (form.isDefault !== undefined){ fields.push(`is_default = $${i++}`); values.push(form.isDefault); }

      fields.push(`updated_at = NOW()`);
      values.push(id, userId);

      const { rows } = await tx.query(
        `UPDATE addresses SET ${fields.join(', ')} WHERE id = $${i} AND user_id = $${i + 1} RETURNING *`,
        values
      );
      return rows[0] ? this.mapRow(rows[0]) : null;
    });
  }

  async delete(id: number, userId: number): Promise<Address | null> {
    return withTransaction(async (tx) => {
      const { rows: deleted } = await tx.query(
        `DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING *`,
        [id, userId]
      );
      if (!deleted[0]) return null;

      if (deleted[0].is_default) {
        await tx.query(
          `UPDATE addresses SET is_default = true
           WHERE id = (SELECT id FROM addresses WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1)`,
          [userId]
        );
      }
      return this.mapRow(deleted[0]);
    });
  }

  private where(filters: { userId?: number }, params: number[]): string {
    if (!filters.userId) return '';
    params.push(filters.userId);
    return ` WHERE user_id = $${params.length}`;
  }

  private mapRow(row: Record<string, unknown>): Address {
    return {
      id: row.id as number,
      userId: row.user_id as number,
      fullName: row.full_name as string,
      phone: (row.phone as string | null) ?? undefined,
      address: row.address as string,
      city: row.city as string,
      label: row.label as AddressLabel,
      isDefault: row.is_default as boolean,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  }
}
