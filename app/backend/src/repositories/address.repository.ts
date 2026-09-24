import pool from '../database';
import { Address, AddressFilters, AddressLabel, AddressUpdate, NewAddress } from '../types/address.types';
import { Queryable } from '../types/database.types';
import { Pagination } from '../types/pagination.types';
import { requireRow } from '../utils/rows';

export class AddressRepository {
  async listByUser(userId: number, db: Queryable = pool): Promise<Address[]> {
    const { rows } = await db.query(
      'SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at ASC',
      [userId],
    );
    return rows.map(toAddress);
  }

  async listAll(filters: AddressFilters, page: Pagination, db: Queryable = pool): Promise<Address[]> {
    const params: unknown[] = [];
    const sql = `SELECT * FROM addresses${where(filters, params)}
                 ORDER BY user_id ASC, is_default DESC, created_at ASC
                 LIMIT $${params.push(page.limit)} OFFSET $${params.push(page.offset)}`;
    const { rows } = await db.query(sql, params);
    return rows.map(toAddress);
  }

  async count(filters: AddressFilters, db: Queryable = pool): Promise<number> {
    const params: unknown[] = [];
    const { rows } = await db.query(`SELECT COUNT(*) FROM addresses${where(filters, params)}`, params);
    return Number(rows[0]?.count ?? 0);
  }

  async findById(id: number, db: Queryable = pool): Promise<Address | null> {
    const { rows } = await db.query('SELECT * FROM addresses WHERE id = $1', [id]);
    return rows[0] ? toAddress(rows[0]) : null;
  }

  async findForUser(id: number, userId: number, db: Queryable = pool): Promise<Address | null> {
    const { rows } = await db.query('SELECT * FROM addresses WHERE id = $1 AND user_id = $2', [id, userId]);
    return rows[0] ? toAddress(rows[0]) : null;
  }

  async countForUser(userId: number, db: Queryable = pool): Promise<number> {
    const { rows } = await db.query('SELECT COUNT(*) FROM addresses WHERE user_id = $1', [userId]);
    return Number(rows[0]?.count ?? 0);
  }

  async create(userId: number, form: NewAddress, isDefault: boolean, db: Queryable = pool): Promise<Address> {
    const { rows } = await db.query(
      `INSERT INTO addresses (user_id, full_name, phone, address, city, label, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, form.fullName, form.phone ?? null, form.address, form.city, form.label, isDefault],
    );
    return toAddress(requireRow(rows, 'INSERT INTO addresses'));
  }

  async update(id: number, changes: AddressUpdate, db: Queryable = pool): Promise<Address | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    const set = (column: string, value: unknown) => fields.push(`${column} = $${values.push(value)}`);

    if (changes.fullName !== undefined) set('full_name', changes.fullName);
    if (changes.phone !== undefined) set('phone', changes.phone);
    if (changes.address !== undefined) set('address', changes.address);
    if (changes.city !== undefined) set('city', changes.city);
    if (changes.label !== undefined) set('label', changes.label);
    if (changes.isDefault !== undefined) set('is_default', changes.isDefault);
    fields.push('updated_at = NOW()');

    const { rows } = await db.query(
      `UPDATE addresses SET ${fields.join(', ')} WHERE id = $${values.push(id)} RETURNING *`,
      values,
    );
    return rows[0] ? toAddress(rows[0]) : null;
  }

  async clearDefault(userId: number, db: Queryable = pool): Promise<void> {
    await db.query('UPDATE addresses SET is_default = false WHERE user_id = $1 AND is_default', [userId]);
  }

  async makeOldestDefault(userId: number, db: Queryable = pool): Promise<void> {
    await db.query(
      `UPDATE addresses SET is_default = true
       WHERE id = (SELECT id FROM addresses WHERE user_id = $1 ORDER BY created_at ASC, id ASC LIMIT 1)`,
      [userId],
    );
  }

  async delete(id: number, db: Queryable = pool): Promise<void> {
    await db.query('DELETE FROM addresses WHERE id = $1', [id]);
  }

  async deleteByUser(userId: number, db: Queryable = pool): Promise<void> {
    await db.query('DELETE FROM addresses WHERE user_id = $1', [userId]);
  }
}

function where(filters: AddressFilters, params: unknown[]): string {
  return filters.userId ? ` WHERE user_id = $${params.push(filters.userId)}` : '';
}

function toAddress(row: Record<string, unknown>): Address {
  return {
    id: row.id as number,
    userId: row.user_id as number,
    fullName: row.full_name as string,
    phone: (row.phone as string | null) ?? null,
    address: row.address as string,
    city: row.city as string,
    label: row.label as AddressLabel,
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}
