import { PoolClient } from 'pg';
import pool from '../database';
import { CartItem, CheckoutLine, UpsertCartItem } from '../types/cart.types';
import { Queryable } from '../types/database.types';
import { Pagination } from '../types/pagination.types';
import { Review } from '../types/product.types';
import { toProductTypes } from './product.repository';

const WITH_PRODUCT = `SELECT ci.*,
         p.name           AS product_name,
         p.price          AS product_price,
         p.category       AS product_category,
         p.image          AS product_image,
         p.description    AS product_description,
         p.preview_img    AS product_preview_img,
         p.types          AS product_types,
         p.reviews        AS product_reviews,
         p.overall_rating AS product_overall_rating,
         p.stock          AS product_stock,
         p.is_active      AS product_is_active,
         p.shop_id        AS product_shop_id,
         p.shop_name      AS product_shop_name
  FROM cart_items ci
  JOIN products p ON p.id = ci.product_id`;

export class CartRepository {
  async listByUser(userId: number, db: Queryable = pool): Promise<CartItem[]> {
    const { rows } = await db.query(`${WITH_PRODUCT} WHERE ci.user_id = $1 ORDER BY ci.created_at ASC`, [
      userId,
    ]);
    return rows.map(toCartItem);
  }

  async listAll(filters: { userId?: number }, page: Pagination): Promise<CartItem[]> {
    const params: unknown[] = [];
    const sql = `${WITH_PRODUCT}${where(filters, params)}
                 ORDER BY ci.user_id ASC, ci.created_at ASC
                 LIMIT $${params.push(page.limit)} OFFSET $${params.push(page.offset)}`;
    const { rows } = await pool.query(sql, params);
    return rows.map(toCartItem);
  }

  async count(filters: { userId?: number }): Promise<number> {
    const params: unknown[] = [];
    const { rows } = await pool.query(`SELECT COUNT(*) FROM cart_items ci${where(filters, params)}`, params);
    return Number(rows[0].count);
  }

  async findById(cartItemId: number, userId?: number, db: Queryable = pool): Promise<CartItem | null> {
    const params: unknown[] = [cartItemId];
    const scope = userId === undefined ? '' : ` AND ci.user_id = $${params.push(userId)}`;
    const { rows } = await db.query(`${WITH_PRODUCT} WHERE ci.id = $1${scope}`, params);
    return rows[0] ? toCartItem(rows[0]) : null;
  }

  async upsert(
    userId: number,
    item: UpsertCartItem,
    shop: { shopId: string | null; shopName: string | null },
    selectedType: unknown,
    db: Queryable = pool,
  ): Promise<CartItem> {
    const { rows } = await db.query(
      `INSERT INTO cart_items (user_id, product_id, quantity, type_id, selected_type, shop_id, shop_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT ON CONSTRAINT cart_items_user_product_type_unique
         DO UPDATE SET
           quantity      = LEAST(cart_items.quantity + EXCLUDED.quantity, 999),
           selected_type = EXCLUDED.selected_type,
           shop_id       = EXCLUDED.shop_id,
           shop_name     = EXCLUDED.shop_name,
           updated_at    = NOW()
       RETURNING id`,
      [
        userId,
        item.productId,
        item.quantity,
        item.typeId ?? '',
        selectedType ? JSON.stringify(selectedType) : null,
        shop.shopId,
        shop.shopName,
      ],
    );
    return (await this.findById(rows[0].id as number, userId, db)) as CartItem;
  }

  async updateQuantity(
    cartItemId: number,
    quantity: number,
    userId?: number,
    db: Queryable = pool,
  ): Promise<CartItem | null> {
    const params: unknown[] = [quantity, cartItemId];
    const scope = userId === undefined ? '' : ` AND user_id = $${params.push(userId)}`;
    const { rowCount } = await db.query(
      `UPDATE cart_items SET quantity = $1, updated_at = NOW() WHERE id = $2${scope}`,
      params,
    );
    return rowCount ? this.findById(cartItemId, userId, db) : null;
  }

  async remove(cartItemId: number, userId?: number, db: Queryable = pool): Promise<CartItem | null> {
    const existing = await this.findById(cartItemId, userId, db);
    if (!existing) return null;
    await db.query('DELETE FROM cart_items WHERE id = $1', [cartItemId]);
    return existing;
  }

  async clearByUser(userId: number, db: Queryable = pool): Promise<void> {
    await db.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);
  }

  // Checkout reads the quantities it is about to charge for from the cart rows it locks, never
  // from the request body (OWASP API3)
  async lockForCheckout(userId: number, cartItemIds: number[], tx: PoolClient): Promise<CheckoutLine[]> {
    const { rows } = await tx.query(
      `SELECT id, product_id, type_id, quantity FROM cart_items
       WHERE user_id = $1 AND id = ANY($2::int[]) ORDER BY id ASC FOR UPDATE`,
      [userId, cartItemIds],
    );
    return rows.map((row) => ({
      id: row.id as number,
      productId: row.product_id as number,
      typeId: (row.type_id as string | null) ?? '',
      quantity: row.quantity as number,
    }));
  }

  async deleteMany(cartItemIds: number[], db: Queryable = pool): Promise<void> {
    await db.query('DELETE FROM cart_items WHERE id = ANY($1::int[])', [cartItemIds]);
  }
}

function where(filters: { userId?: number }, params: unknown[]): string {
  return filters.userId ? ` WHERE ci.user_id = $${params.push(filters.userId)}` : '';
}

function toCartItem(row: Record<string, unknown>): CartItem {
  const selectedType = toProductTypes(row.selected_type ? [row.selected_type] : [])[0] ?? null;
  return {
    id: row.id as number,
    userId: row.user_id as number,
    productId: row.product_id as number,
    quantity: row.quantity as number,
    typeId: (row.type_id as string) || null,
    selectedType,
    shopId: (row.shop_id as string | null) ?? null,
    shopName: (row.shop_name as string | null) ?? null,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
    productName: row.product_name as string,
    productPrice: row.product_price as string,
    productCategory: (row.product_category as string | null) ?? null,
    productImage: (row.product_image as string | null) ?? null,
    productDescription: (row.product_description as string | null) ?? null,
    productPreviewImg: Array.isArray(row.product_preview_img) ? (row.product_preview_img as string[]) : [],
    productTypes: toProductTypes(row.product_types),
    productReviews: Array.isArray(row.product_reviews) ? (row.product_reviews as Review[]) : [],
    productOverallRating: Number(row.product_overall_rating ?? 0),
    productStock: Number(row.product_stock ?? 0),
    productIsActive: Boolean(row.product_is_active),
    productShopId: (row.product_shop_id as string | null) ?? null,
    productShopName: (row.product_shop_name as string | null) ?? null,
  };
}
