import pool from '../database';
import { AddressLabel } from '../types/address.types';
import { Queryable } from '../types/database.types';
import {
  NewOrderLine,
  NewOrderShipping,
  Order,
  OrderFilters,
  OrderLine,
  OrderStatus,
  RecentPurchase,
} from '../types/order.types';
import { Pagination } from '../types/pagination.types';

const SHIPPING = 'o.address_id, o.ship_full_name, o.ship_phone, o.ship_address, o.ship_city, o.ship_label';

const WITH_TOTAL = `SELECT o.id, o.user_id, o.status, o.created_at, ${SHIPPING},
         COALESCE(SUM(op.quantity * op.unit_price), 0) AS total
  FROM orders o
  LEFT JOIN order_products op ON op.order_id = o.id`;

export class OrderRepository {
  async index(filters: OrderFilters, page: Pagination, db: Queryable = pool): Promise<Order[]> {
    const params: unknown[] = [];
    const sql = `${WITH_TOTAL}${where(filters, params)}
                 GROUP BY o.id ORDER BY o.created_at DESC, o.id DESC
                 LIMIT $${params.push(page.limit)} OFFSET $${params.push(page.offset)}`;
    const { rows } = await db.query(sql, params);
    return rows.map(toOrder);
  }

  async count(filters: OrderFilters, db: Queryable = pool): Promise<number> {
    const params: unknown[] = [];
    const { rows } = await db.query(`SELECT COUNT(*) FROM orders o${where(filters, params)}`, params);
    return Number(rows[0].count);
  }

  async show(id: number, db: Queryable = pool): Promise<Order | null> {
    const params: unknown[] = [id];
    const { rows } = await db.query(`${WITH_TOTAL} WHERE o.id = $1 GROUP BY o.id`, params);
    return rows[0] ? toOrder(rows[0]) : null;
  }

  async create(
    userId: number,
    status: OrderStatus,
    shipping: NewOrderShipping | null = null,
    db: Queryable = pool,
  ): Promise<Order> {
    const { rows } = await db.query(
      `INSERT INTO orders (user_id, status, address_id, ship_full_name, ship_phone, ship_address, ship_city, ship_label)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, user_id, status, created_at, address_id, ship_full_name, ship_phone,
                 ship_address, ship_city, ship_label, 0 AS total`,
      [
        userId,
        status,
        shipping?.addressId ?? null,
        shipping?.fullName ?? null,
        shipping?.phone ?? null,
        shipping?.address ?? null,
        shipping?.city ?? null,
        shipping?.label ?? null,
      ],
    );
    return toOrder(rows[0]);
  }

  async updateStatus(id: number, status: OrderStatus, db: Queryable = pool): Promise<Order | null> {
    const { rows } = await db.query('UPDATE orders SET status = $1 WHERE id = $2 RETURNING id', [status, id]);
    return rows[0] ? this.show(id, db) : null;
  }

  async delete(id: number, db: Queryable = pool): Promise<Order | null> {
    const existing = await this.show(id, db);
    if (!existing) return null;
    await db.query('DELETE FROM orders WHERE id = $1', [id]);
    return existing;
  }

  async lines(orderId: number, db: Queryable = pool): Promise<OrderLine[]> {
    const { rows } = await db.query('SELECT * FROM order_products WHERE order_id = $1 ORDER BY id ASC', [
      orderId,
    ]);
    return rows.map(toOrderLine);
  }

  async addLine(orderId: number, line: NewOrderLine, db: Queryable = pool): Promise<OrderLine> {
    const [created] = await this.addLines(orderId, [line], db);
    return created;
  }

  async addLines(orderId: number, lines: NewOrderLine[], db: Queryable = pool): Promise<OrderLine[]> {
    const params: unknown[] = [orderId];
    const tuples = lines.map((line) => {
      const values = [line.productId, line.variantId, line.typeId, line.quantity, line.unitPrice];
      return `($1, ${values.map((value) => `$${params.push(value)}`).join(', ')})`;
    });
    const { rows } = await db.query(
      `INSERT INTO order_products (order_id, product_id, variant_id, type_id, quantity, unit_price)
       VALUES ${tuples.join(', ')} RETURNING *`,
      params,
    );
    return rows.map(toOrderLine);
  }

  async recentPurchases(userId: number, limit = 5, db: Queryable = pool): Promise<RecentPurchase[]> {
    const { rows } = await db.query(
      `SELECT p.id AS product_id, p.name, op.unit_price, p.category, p.image, p.description,
              op.quantity, o.id AS order_id, o.created_at
       FROM orders o
       JOIN order_products op ON op.order_id = o.id
       JOIN products p ON p.id = op.product_id
       WHERE o.user_id = $1 AND o.status = 'complete'
       ORDER BY o.created_at DESC, o.id DESC, op.id ASC
       LIMIT $2`,
      [userId, limit],
    );
    return rows.map((row) => ({
      productId: row.product_id as number,
      name: row.name as string,
      price: row.unit_price as string,
      category: (row.category as string | null) ?? null,
      image: (row.image as string | null) ?? null,
      description: (row.description as string | null) ?? null,
      quantity: row.quantity as number,
      orderId: row.order_id as number,
      purchasedAt: row.created_at as Date,
    }));
  }
}

function where(filters: OrderFilters, params: unknown[]): string {
  const conditions: string[] = [];
  if (filters.status) conditions.push(`o.status = $${params.push(filters.status)}`);
  if (filters.userId) conditions.push(`o.user_id = $${params.push(filters.userId)}`);
  return conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
}

function toOrder(row: Record<string, unknown>): Order {
  return {
    id: row.id as number,
    userId: row.user_id as number,
    status: row.status as OrderStatus,
    createdAt: row.created_at as Date,
    total: String(row.total ?? '0'),
    addressId: (row.address_id as number | null) ?? null,
    shippingAddress: row.ship_address
      ? {
          fullName: row.ship_full_name as string,
          phone: (row.ship_phone as string | null) ?? null,
          address: row.ship_address as string,
          city: row.ship_city as string,
          label: row.ship_label as AddressLabel,
        }
      : null,
  };
}

function toOrderLine(row: Record<string, unknown>): OrderLine {
  return {
    id: row.id as number,
    orderId: row.order_id as number,
    productId: row.product_id as number,
    variantId: (row.variant_id as number | null) ?? null,
    typeId: (row.type_id as string | null) ?? null,
    quantity: row.quantity as number,
    unitPrice: row.unit_price as string,
  };
}
