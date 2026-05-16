import client from '../database';
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
    const poolClient = await client.connect();
    try {
      await poolClient.query('BEGIN');

      if (form.isDefault) {
        await poolClient.query(`UPDATE addresses SET is_default = false WHERE user_id = $1`, [userId]);
      }

      const { rows: existing } = await poolClient.query(
        `SELECT COUNT(*) FROM addresses WHERE user_id = $1`,
        [userId]
      );
      const isFirst = parseInt(existing[0].count, 10) === 0;

      const { rows } = await poolClient.query(
        `INSERT INTO addresses (user_id, full_name, phone, address, city, label, is_default)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [userId, form.fullName, form.phone ?? null, form.address, form.city, form.label, form.isDefault || isFirst]
      );

      await poolClient.query('COMMIT');
      return this.mapRow(rows[0]);
    } catch (err) {
      await poolClient.query('ROLLBACK');
      throw err;
    } finally {
      poolClient.release();
    }
  }

  async update(id: number, userId: number, form: Partial<AddressForm>): Promise<Address | null> {
    const poolClient = await client.connect();
    try {
      await poolClient.query('BEGIN');

      if (form.isDefault) {
        await poolClient.query(`UPDATE addresses SET is_default = false WHERE user_id = $1`, [userId]);
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

      const { rows } = await poolClient.query(
        `UPDATE addresses SET ${fields.join(', ')} WHERE id = $${i} AND user_id = $${i + 1} RETURNING *`,
        values
      );

      await poolClient.query('COMMIT');
      return rows[0] ? this.mapRow(rows[0]) : null;
    } catch (err) {
      await poolClient.query('ROLLBACK');
      throw err;
    } finally {
      poolClient.release();
    }
  }

  async delete(id: number, userId: number): Promise<Address | null> {
    const poolClient = await client.connect();
    try {
      await poolClient.query('BEGIN');

      const { rows: deleted } = await poolClient.query(
        `DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING *`,
        [id, userId]
      );

      if (!deleted[0]) {
        await poolClient.query('COMMIT');
        return null;
      }

      if (deleted[0].is_default) {
        await poolClient.query(
          `UPDATE addresses SET is_default = true
           WHERE id = (SELECT id FROM addresses WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1)`,
          [userId]
        );
      }

      await poolClient.query('COMMIT');
      return this.mapRow(deleted[0]);
    } catch (err) {
      await poolClient.query('ROLLBACK');
      throw err;
    } finally {
      poolClient.release();
    }
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
