import client from '../database';
import { Order, OrderProduct, RecentPurchase } from '../types/order.types';

export class OrderStore {
  async index(filters?: { status?: string; userId?: number }): Promise<Order[]> {
    let sql = 'SELECT * FROM orders';
    const params: (string | number)[] = [];
    const conditions: string[] = [];

    if (filters?.status) { params.push(filters.status); conditions.push(`status=$${params.length}`); }
    if (filters?.userId) { params.push(filters.userId); conditions.push(`user_id=$${params.length}`); }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');

    const { rows } = await client.query(sql, params);
    return rows.map(this.mapOrderRow);
  }

  async show(id: number): Promise<Order> {
    const { rows } = await client.query('SELECT * FROM orders WHERE id=$1', [id]);
    return rows[0] ? this.mapOrderRow(rows[0]) : rows[0];
  }

  async create(order: Order): Promise<Order> {
    const { rows } = await client.query(
      'INSERT INTO orders (user_id, status) VALUES ($1, $2) RETURNING *',
      [order.userId, order.status]
    );
    return this.mapOrderRow(rows[0]);
  }

  async update(id: number, status: string): Promise<Order> {
    const { rows } = await client.query(
      'UPDATE orders SET status=$1 WHERE id=$2 RETURNING *',
      [status, id]
    );
    return rows[0] ? this.mapOrderRow(rows[0]) : rows[0];
  }

  async delete(id: number): Promise<Order> {
    const { rows } = await client.query('DELETE FROM orders WHERE id=$1 RETURNING *', [id]);
    return rows[0] ? this.mapOrderRow(rows[0]) : rows[0];
  }

  async getOrderProducts(orderId: number): Promise<OrderProduct[]> {
    const { rows } = await client.query('SELECT * FROM order_products WHERE order_id=$1', [orderId]);
    return rows.map(this.mapOrderProductRow);
  }

  async addProduct(orderProduct: OrderProduct): Promise<OrderProduct> {
    const { rows } = await client.query(
      'INSERT INTO order_products (order_id, product_id, quantity) VALUES ($1, $2, $3) RETURNING *',
      [orderProduct.orderId, orderProduct.productId, orderProduct.quantity]
    );
    return this.mapOrderProductRow(rows[0]);
  }

  /** Create an 'active' order awaiting payment, together with its order_products, in one transaction. */
  async createPendingPaymentOrder(
    userId: number,
    items: { productId: number; quantity: number }[],
    totalCents: number,
    currency: string
  ): Promise<Order> {
    const poolClient = await client.connect();
    try {
      await poolClient.query('BEGIN');

      const { rows } = await poolClient.query(
        `INSERT INTO orders (user_id, status, payment_status, total_cents, currency)
         VALUES ($1, 'active', 'pending', $2, $3) RETURNING *`,
        [userId, totalCents, currency]
      );
      const order = rows[0];

      for (const item of items) {
        await poolClient.query(
          `INSERT INTO order_products (order_id, product_id, quantity) VALUES ($1, $2, $3)`,
          [order.id, item.productId, item.quantity]
        );
      }

      await poolClient.query('COMMIT');
      return this.mapOrderRow(order);
    } catch (err) {
      await poolClient.query('ROLLBACK');
      throw err;
    } finally {
      poolClient.release();
    }
  }

  async setPaymentIntent(orderId: number, paymentIntentId: string): Promise<void> {
    await client.query('UPDATE orders SET payment_intent_id=$1 WHERE id=$2', [paymentIntentId, orderId]);
  }

  async findByPaymentIntentId(paymentIntentId: string): Promise<Order | undefined> {
    const { rows } = await client.query('SELECT * FROM orders WHERE payment_intent_id=$1', [paymentIntentId]);
    return rows[0] ? this.mapOrderRow(rows[0]) : undefined;
  }

  /**
   * Mark the order tied to a PaymentIntent as paid/complete and remove the purchased
   * products from the user's cart. Idempotent — safe to call from both the client
   * confirmation endpoint and the Stripe webhook.
   */
  async markPaidByPaymentIntent(paymentIntentId: string): Promise<Order | undefined> {
    const poolClient = await client.connect();
    try {
      await poolClient.query('BEGIN');

      const { rows } = await poolClient.query(
        `UPDATE orders SET status='complete', payment_status='paid'
         WHERE payment_intent_id=$1 RETURNING *`,
        [paymentIntentId]
      );
      if (!rows[0]) {
        await poolClient.query('ROLLBACK');
        return undefined;
      }

      await poolClient.query(
        `DELETE FROM cart_items
         WHERE user_id = $1
           AND product_id IN (SELECT product_id FROM order_products WHERE order_id = $2)`,
        [rows[0].user_id, rows[0].id]
      );

      await poolClient.query('COMMIT');
      return this.mapOrderRow(rows[0]);
    } catch (err) {
      await poolClient.query('ROLLBACK');
      throw err;
    } finally {
      poolClient.release();
    }
  }

  async markPaymentFailed(paymentIntentId: string): Promise<void> {
    await client.query(
      `UPDATE orders SET payment_status='failed'
       WHERE payment_intent_id=$1 AND payment_status <> 'paid'`,
      [paymentIntentId]
    );
  }

  /** Remove a user's abandoned checkout orders (never paid) and return their PaymentIntent ids. */
  async deleteAbandonedPaymentOrders(userId: number): Promise<string[]> {
    const { rows } = await client.query(
      `DELETE FROM orders
       WHERE user_id=$1 AND status='active' AND payment_status IN ('pending', 'failed')
       RETURNING payment_intent_id`,
      [userId]
    );
    return rows.map((r) => r.payment_intent_id as string | null).filter((id): id is string => Boolean(id));
  }

  async recentPurchases(userId: number, limit: number = 5): Promise<RecentPurchase[]> {
    const { rows } = await client.query(
      `SELECT p.id AS product_id, p.name, p.price, p.category, p.image, p.description, op.quantity, o.id AS order_id
       FROM orders o
       JOIN order_products op ON o.id = op.order_id
       JOIN products p ON op.product_id = p.id
       WHERE o.user_id = $1 AND o.status = 'complete'
       ORDER BY o.id DESC
       LIMIT $2`,
      [userId, limit]
    );
    return rows.map(this.mapRecentPurchaseRow);
  }

  private mapOrderRow(row: Record<string, unknown>): Order {
    const order: Order = { id: row.id as number, userId: row.user_id as number, status: row.status as string };
    if (row.payment_status !== undefined) order.paymentStatus = row.payment_status as string;
    if (row.total_cents !== undefined && row.total_cents !== null) order.totalCents = Number(row.total_cents);
    if (row.currency !== undefined && row.currency !== null) order.currency = row.currency as string;
    return order;
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
