import { PoolClient } from 'pg';
import pool from '../database';
import { CartFilters, CartItem, CheckoutLine, MAX_CART_QUANTITY, UpsertCartItem } from '../types/cart.types';
import { Queryable } from '../types/database.types';
import { Pagination } from '../types/pagination.types';
import { Review } from '../types/product.types';
import { toProductType, toProductTypes } from './product.repository';
import { requireRow } from '../utils/rows';

// The chosen option is read from product_variants on every request rather than from a copy taken
// when the item was added, so the cart cannot show a price that checkout will not charge
const selectItems = (source: string): string => `SELECT ci.*,
         p.name           AS product_name,
         p.price          AS product_price,
         p.category       AS product_category,
         p.image          AS product_image,
         p.description    AS product_description,
         p.preview_img    AS product_preview_img,
         p.reviews        AS product_reviews,
         p.overall_rating AS product_overall_rating,
         p.stock          AS product_stock,
         p.is_active      AS product_is_active,
         p.shop_id        AS product_shop_id,
         p.shop_name      AS product_shop_name,
         pv.options       AS product_types,
         pv.options_stock AS product_options_stock,
         CASE WHEN v.id IS NULL THEN NULL ELSE json_build_object(
           '_id', v.ext_id, 'productId', v.product_id, 'color', v.color,
           'price', v.price, 'stock', v.stock, 'image', v.image
         ) END AS selected_type
  FROM ${source} ci
  JOIN products p ON p.id = ci.product_id
  LEFT JOIN product_variants v ON v.id = ci.variant_id
  LEFT JOIN LATERAL (
    SELECT COALESCE(
             json_agg(
               json_build_object(
                 '_id', pvv.ext_id, 'productId', pvv.product_id, 'color', pvv.color,
                 'price', pvv.price, 'stock', pvv.stock, 'image', pvv.image
               ) ORDER BY pvv.position, pvv.id
             ),
             '[]'::json
           ) AS options,
           SUM(pvv.stock)::int AS options_stock
    FROM product_variants pvv
    WHERE pvv.product_id = p.id
  ) pv ON true`;

const WITH_PRODUCT = selectItems('cart_items');

export class CartRepository {
  async listByUser(userId: number, db: Queryable = pool): Promise<CartItem[]> {
    const { rows } = await db.query(`${WITH_PRODUCT} WHERE ci.user_id = $1 ORDER BY ci.created_at ASC`, [
      userId,
    ]);
    return rows.map(toCartItem);
  }

  async listAll(filters: CartFilters, page: Pagination, db: Queryable = pool): Promise<CartItem[]> {
    const params: unknown[] = [];
    const sql = `${WITH_PRODUCT}${where(filters, params)}
                 ORDER BY ci.user_id ASC, ci.created_at ASC
                 LIMIT $${params.push(page.limit)} OFFSET $${params.push(page.offset)}`;
    const { rows } = await db.query(sql, params);
    return rows.map(toCartItem);
  }

  async count(filters: CartFilters, db: Queryable = pool): Promise<number> {
    const params: unknown[] = [];
    const { rows } = await db.query(`SELECT COUNT(*) FROM cart_items ci${where(filters, params)}`, params);
    return Number(rows[0]?.count ?? 0);
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
    db: Queryable = pool,
  ): Promise<CartItem> {
    const { rows } = await db.query(
      `INSERT INTO cart_items (user_id, product_id, quantity, variant_id, shop_id, shop_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, product_id, COALESCE(variant_id, 0))
         DO UPDATE SET
           quantity   = LEAST(cart_items.quantity + EXCLUDED.quantity, ${MAX_CART_QUANTITY}),
           shop_id    = EXCLUDED.shop_id,
           shop_name  = EXCLUDED.shop_name,
           updated_at = NOW()
       RETURNING id`,
      [userId, item.productId, item.quantity, item.variantId, shop.shopId, shop.shopName],
    );
    const id = requireRow(rows, 'INSERT INTO cart_items').id as number;
    return (await this.findById(id, userId, db)) as CartItem;
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

  // Deleting and reading the deleted row is one statement, so two requests racing on the same item
  // cannot both be told they removed it
  async remove(cartItemId: number, userId?: number, db: Queryable = pool): Promise<CartItem | null> {
    const params: unknown[] = [cartItemId];
    const scope = userId === undefined ? '' : ` AND user_id = $${params.push(userId)}`;
    const { rows } = await db.query(
      `WITH deleted AS (DELETE FROM cart_items WHERE id = $1${scope} RETURNING *)
       ${selectItems('deleted')}`,
      params,
    );
    return rows[0] ? toCartItem(rows[0]) : null;
  }

  async clearByUser(userId: number, db: Queryable = pool): Promise<void> {
    await db.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);
  }

  // Checkout reads the quantities it is about to charge for from the cart rows it locks, never
  // from the request body (OWASP API3)
  async lockForCheckout(userId: number, cartItemIds: number[], tx: PoolClient): Promise<CheckoutLine[]> {
    const { rows } = await tx.query(
      `SELECT id, product_id, variant_id, quantity FROM cart_items
       WHERE user_id = $1 AND id = ANY($2::int[]) ORDER BY id ASC FOR UPDATE`,
      [userId, cartItemIds],
    );
    return rows.map((row) => ({
      id: row.id as number,
      productId: row.product_id as number,
      variantId: (row.variant_id as number | null) ?? null,
      quantity: row.quantity as number,
    }));
  }

  async deleteMany(cartItemIds: number[], db: Queryable = pool): Promise<void> {
    await db.query('DELETE FROM cart_items WHERE id = ANY($1::int[])', [cartItemIds]);
  }
}

function where(filters: CartFilters, params: unknown[]): string {
  return filters.userId ? ` WHERE ci.user_id = $${params.push(filters.userId)}` : '';
}

function toCartItem(row: Record<string, unknown>): CartItem {
  const selectedType = row.selected_type ? toProductType(row.selected_type as Record<string, unknown>) : null;
  const options = toProductTypes(row.product_types);

  return {
    id: row.id as number,
    userId: row.user_id as number,
    productId: row.product_id as number,
    quantity: row.quantity as number,
    typeId: selectedType?._id ?? null,
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
    productTypes: options,
    productReviews: Array.isArray(row.product_reviews) ? (row.product_reviews as Review[]) : [],
    productOverallRating: Number(row.product_overall_rating ?? 0),
    productStock: options.length ? Number(row.product_options_stock ?? 0) : Number(row.product_stock ?? 0),
    productIsActive: Boolean(row.product_is_active),
    productShopId: (row.product_shop_id as string | null) ?? null,
    productShopName: (row.product_shop_name as string | null) ?? null,
  };
}
