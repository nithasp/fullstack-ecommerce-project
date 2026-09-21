import pool, { Queryable } from '../database';
import { Order, OrderFilters, OrderProduct, RecentPurchase } from '../types/order.types';
import { Pagination } from '../types/pagination.types';

export class OrderRepository {
  async index(filters: OrderFilters = {}, page?: Pagination): Promise<Order[]> {
    const params: (string | number)[] = [];
    let sql = `SELECT * FROM orders${this.where(filters, params)} ORDER BY id ASC`;
    if (page) {
      params.push(page.limit);  sql += ` LIMIT $${params.length}`;
      params.push(page.offset); sql += ` OFFSET $${params.length}`;
    }
    const { rows } = await pool.query(sql, params);
    return rows.map((row) => this.mapOrderRow(row));
  }

  async count(filters: OrderFilters = {}): Promise<number> {
    const params: (string | number)[] = [];
    const { rows } = await pool.query(`SELECT COUNT(*) FROM orders${this.where(filters, params)}`, params);
    return parseInt(rows[0].count, 10);
  }

  async show(id: number): Promise<Order | null> {
    const { rows } = await pool.query('SELECT * FROM orders WHERE id=$1', [id]);
    return rows[0] ? this.mapOrderRow(rows[0]) : null;
  }

  async create(order: Order, db: Queryable = pool): Promise<Order> {
    const { rows } = await db.query(
      'INSERT INTO orders (user_id, status) VALUES ($1, $2) RETURNING *',
      [order.userId, order.status]
    );
    return this.mapOrderRow(rows[0]);
  }

  async update(id: number, status: string): Promise<Order | null> {
    const { rows } = await pool.query(
      'UPDATE orders SET status=$1 WHERE id=$2 RETURNING *',
      [status, id]
    );
    return rows[0] ? this.mapOrderRow(rows[0]) : null;
  }

  async delete(id: number): Promise<Order | null> {
    const { rows } = await pool.query('DELETE FROM orders WHERE id=$1 RETURNING *', [id]);
    return rows[0] ? this.mapOrderRow(rows[0]) : null;
  }

  async getOrderProducts(orderId: number): Promise<OrderProduct[]> {
    const { rows } = await pool.query('SELECT * FROM order_products WHERE order_id=$1', [orderId]);
    return rows.map((row) => this.mapOrderProductRow(row));
  }

  async addProduct(orderProduct: OrderProduct, db: Queryable = pool): Promise<OrderProduct> {
    const { rows } = await db.query(
      'INSERT INTO order_products (order_id, product_id, quantity) VALUES ($1, $2, $3) RETURNING *',
      [orderProduct.orderId, orderProduct.productId, orderProduct.quantity]
    );
    return this.mapOrderProductRow(rows[0]);
  }

  async recentPurchases(userId: number, limit: number = 5): Promise<RecentPurchase[]> {
    const { rows } = await pool.query(
      `SELECT p.id AS product_id, p.name, p.price, p.category, p.image, p.description, op.quantity, o.id AS order_id
       FROM orders o
       JOIN order_products op ON o.id = op.order_id
       JOIN products p ON op.product_id = p.id
       WHERE o.user_id = $1 AND o.status = 'complete'
       ORDER BY o.id DESC
       LIMIT $2`,
      [userId, limit]
    );
    return rows.map((row) => this.mapRecentPurchaseRow(row));
  }

  // Shared by index and count so a page and its total always describe the same rows
  private where(filters: OrderFilters, params: (string | number)[]): string {
    const conditions: string[] = [];
    if (filters.status) { params.push(filters.status); conditions.push(`status=$${params.length}`); }
    if (filters.userId) { params.push(filters.userId); conditions.push(`user_id=$${params.length}`); }
    return conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
  }

  private mapOrderRow(row: Record<string, unknown>): Order {
    return { id: row.id as number, userId: row.user_id as number, status: row.status as string };
  }

  private mapOrderProductRow(row: Record<string, unknown>): OrderProduct {
    return { id: row.id as number, orderId: row.order_id as number, productId: row.product_id as number, quantity: row.quantity as number };
  }

  private mapRecentPurchaseRow(row: Record<string, unknown>): RecentPurchase {
    return {
      productId: row.product_id as number,
      name: row.name as string,
      price: row.price as number,
      category: row.category as string | null,
      image: row.image as string | null,
      description: row.description as string | null,
      quantity: row.quantity as number,
      orderId: row.order_id as number,
    };
  }
}
