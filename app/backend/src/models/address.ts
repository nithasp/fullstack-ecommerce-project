import client, { withTransaction } from '../database';
import { buildSetAssignments } from '../utils/sql';
import { Address, AddressForm } from '../types/address.types';

export class AddressStore {
  async getByUser(userId: number): Promise<Address[]> {
    const { rows } = await client.query(
      `SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at ASC`,
      [userId]
    );
    return rows.map(this.mapRow);
  }

  async show(id: number, userId: number): Promise<Address | null> {
    const { rows } = await client.query(
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

      // The user's first address becomes the default automatically.
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

      const { assignments, values } = buildSetAssignments({
        full_name: form.fullName,
        phone: form.phone,
        address: form.address,
        city: form.city,
        label: form.label,
        is_default: form.isDefault,
      });
      assignments.push('updated_at = NOW()');

      const idIndex = values.push(id);
      const userIdIndex = values.push(userId);
      const { rows } = await tx.query(
        `UPDATE addresses SET ${assignments.join(', ')} WHERE id = $${idIndex} AND user_id = $${userIdIndex} RETURNING *`,
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

      // If the default address was removed, promote the oldest remaining one.
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

  private mapRow(row: Record<string, unknown>): Address {
    return {
      id: row.id as number,
      userId: row.user_id as number,
      fullName: row.full_name as string,
      phone: (row.phone as string | null) ?? undefined,
      address: row.address as string,
      city: row.city as string,
      label: row.label as 'home' | 'work' | 'other',
      isDefault: row.is_default as boolean,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  }
}
