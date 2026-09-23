import pool from '../database';
import { Queryable } from '../types/database.types';
import {
  NewOrderLine,
  Order,
  OrderFilters,
  OrderLine,
  OrderStatus,
  RecentPurchase,
} from '../types/order.types';
import { Pagination } from '../types/pagination.types';

const WITH_TOTAL = `SELECT o.id, o.user_id, o.status, o.created_at,
         COALESCE(SUM(op.quantity * op.unit_price), 0) AS total
  FROM orders o
  LEFT JOIN order_products op ON op.order_id = o.id`;

export class OrderRepository {
  async index(filters: OrderFilters, page: Pagination): Promise<Order[]> {
    const params: unknown[] = [];
    const sql = `${WITH_TOTAL}${where(filters, params)}
                 GROUP BY o.id ORDER BY o.created_at DESC, o.id DESC
                 LIMIT $${params.push(page.limit)} OFFSET $${params.push(page.offset)}`;
    const { rows } = await pool.query(sql, params);
    return rows.map(toOrder);
  }

  async count(filters: OrderFilters): Promise<number> {
    const params: unknown[] = [];
    const { rows } = await pool.query(`SELECT COUNT(*) FROM orders o${where(filters, params)}`, params);
    return Number(rows[0].count);
  }

  async show(id: number, db: Queryable = pool): Promise<Order | null> {
    const params: unknown[] = [id];
    const { rows } = await db.query(`${WITH_TOTAL} WHERE o.id = $1 GROUP BY o.id`, params);
    return rows[0] ? toOrder(rows[0]) : null;
  }

  async create(userId: number, status: OrderStatus, db: Queryable = pool): Promise<Order> {
    const { rows } = await db.query(
      'INSERT INTO orders (user_id, status) VALUES ($1, $2) RETURNING id, user_id, status, created_at, 0 AS total',
      [userId, status],
    );
    return toOrder(rows[0]);
  }

  async updateStatus(id: number, status: OrderStatus): Promise<Order | null> {
    const { rows } = await pool.query('UPDATE orders SET status = $1 WHERE id = $2 RETURNING id', [
      status,
      id,
    ]);
    return rows[0] ? this.show(id) : null;
  }

  async delete(id: number): Promise<Order | null> {
    const existing = await this.show(id);
    if (!existing) return null;
    await pool.query('DELETE FROM orders WHERE id = $1', [id]);
    return existing;
  }

  async lines(orderId: number, db: Queryable = pool): Promise<OrderLine[]> {
    const { rows } = await db.query('SELECT * FROM order_products WHERE order_id = $1 ORDER BY id ASC', [
      orderId,
    ]);
    return rows.map(toOrderLine);
  }

  async addLine(orderId: number, line: NewOrderLine, db: Queryable = pool): Promise<OrderLine> {
    const { rows } = await db.query(
      `INSERT INTO order_products (order_id, product_id, type_id, quantity, unit_price)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [orderId, line.productId, line.typeId ?? null, line.quantity, line.unitPrice],
    );
    return toOrderLine(rows[0]);
  }

  async addLines(orderId: number, lines: NewOrderLine[], db: Queryable = pool): Promise<OrderLine[]> {
    const params: unknown[] = [orderId];
    const tuples = lines.map((line) => {
      const values = [line.productId, line.typeId ?? null, line.quantity, line.unitPrice];
      return `($1, ${values.map((value) => `$${params.push(value)}`).join(', ')})`;
    });
    const { rows } = await db.query(
      `INSERT INTO order_products (order_id, product_id, type_id, quantity, unit_price)
       VALUES ${tuples.join(', ')} RETURNING *`,
      params,
    );
    return rows.map(toOrderLine);
  }

  async recentPurchases(userId: number, limit = 5): Promise<RecentPurchase[]> {
    const { rows } = await pool.query(
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
  };
}

function toOrderLine(row: Record<string, unknown>): OrderLine {
  return {
    id: row.id as number,
    orderId: row.order_id as number,
    productId: row.product_id as number,
    typeId: (row.type_id as string | null) ?? null,
    quantity: row.quantity as number,
    unitPrice: row.unit_price as string,
  };
}
