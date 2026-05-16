import client from '../database';
import { CartItem, UpsertCartItemPayload } from '../types/cart.types';

export class CartStore {
  async getByUser(userId: number): Promise<CartItem[]> {
    const { rows } = await client.query(
      `SELECT
         ci.*,
         p.name          AS product_name,
         p.price         AS product_price,
         p.category      AS product_category,
         p.image         AS product_image,
         p.description   AS product_description,
         p.preview_img   AS product_preview_img,
         p.types         AS product_types,
         p.reviews       AS product_reviews,
         p.overall_rating AS product_overall_rating,
         p.stock         AS product_stock,
         p.is_active     AS product_is_active,
         p.shop_id       AS product_shop_id,
         p.shop_name     AS product_shop_name
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.user_id = $1
       ORDER BY ci.created_at ASC`,
      [userId]
    );
    return rows.map((row) => this.mapRow(row));
  }

  async upsert(userId: number, payload: UpsertCartItemPayload): Promise<CartItem> {
    const { rows } = await client.query(
      `INSERT INTO cart_items (user_id, product_id, quantity, type_id, selected_type, shop_id, shop_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT ON CONSTRAINT cart_items_user_product_type_unique
         DO UPDATE SET
           quantity      = cart_items.quantity + EXCLUDED.quantity,
           selected_type = EXCLUDED.selected_type,
           shop_id       = EXCLUDED.shop_id,
           shop_name     = EXCLUDED.shop_name,
           updated_at    = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        userId,
        payload.productId,
        payload.quantity,
        payload.typeId ?? '',
        payload.selectedType ? JSON.stringify(payload.selectedType) : null,
        payload.shopId ?? null,
        payload.shopName ?? null,
      ]
    );
    return this.mapRow(rows[0]);
  }

  async updateQuantity(cartItemId: number, userId: number, quantity: number): Promise<CartItem | null> {
    const { rows } = await client.query(
      `UPDATE cart_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3 RETURNING *`,
      [quantity, cartItemId, userId]
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async remove(cartItemId: number, userId: number): Promise<CartItem | null> {
    const { rows } = await client.query(
      `DELETE FROM cart_items WHERE id = $1 AND user_id = $2 RETURNING *`,
      [cartItemId, userId]
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async clearByUser(userId: number): Promise<void> {
    await client.query(`DELETE FROM cart_items WHERE user_id = $1`, [userId]);
  }

  private normalizeType(t: Record<string, unknown>) {
    return {
      _id: t._id as string | undefined,
      productId: (t.productId ?? t.product_id) as number,
      color: t.color as string,
      quantity: t.quantity as number,
      price: t.price as number,
      stock: t.stock as number,
      image: t.image as string,
    };
  }

  private mapRow(row: Record<string, unknown>): CartItem {
    const rawSelectedType = row.selected_type as Record<string, unknown> | null;
    const item: Record<string, unknown> = {
      id: row.id,
      userId: row.user_id,
      productId: row.product_id,
      quantity: row.quantity,
      typeId: row.type_id,
      selectedType: rawSelectedType ? this.normalizeType(rawSelectedType) : null,
      shopId: row.shop_id,
      shopName: row.shop_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    // Joined product fields — only present when fetching via getByUser
    if (row.product_name !== undefined)         item['productName']        = row.product_name;
    if (row.product_price !== undefined)        item['productPrice']       = row.product_price;
    if (row.product_category !== undefined)     item['productCategory']    = row.product_category;
    if (row.product_image !== undefined)        item['productImage']       = row.product_image;
    if (row.product_description !== undefined)  item['productDescription'] = row.product_description;
    if (row.product_preview_img !== undefined)  item['productPreviewImg']  = row.product_preview_img;
    if (row.product_types !== undefined) {
      const rawTypes = row.product_types as Record<string, unknown>[];
      item['productTypes'] = Array.isArray(rawTypes) ? rawTypes.map((t) => this.normalizeType(t)) : rawTypes;
    }
    if (row.product_reviews !== undefined)      item['productReviews']     = row.product_reviews;
    if (row.product_overall_rating !== undefined) item['productOverallRating'] = row.product_overall_rating;
    if (row.product_stock !== undefined)        item['productStock']       = row.product_stock;
    if (row.product_is_active !== undefined)    item['productIsActive']    = row.product_is_active;
    if (row.product_shop_id !== undefined)      item['productShopId']      = row.product_shop_id;
    if (row.product_shop_name !== undefined)    item['productShopName']    = row.product_shop_name;

    return item as unknown as CartItem;
  }
}
