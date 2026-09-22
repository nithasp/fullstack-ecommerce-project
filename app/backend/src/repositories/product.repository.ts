import pool, { Queryable, withTransaction } from '../database';
import { Product, ProductFilters } from '../types/product.types';
import { Pagination } from '../types/pagination.types';

const INSERT_PRODUCT = `INSERT INTO products (name, price, category, image, description, preview_img, types, reviews, overall_rating, stock, is_active, shop_id, shop_name)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`;

export class ProductRepository {
  async index(filters: ProductFilters = {}, page?: Pagination): Promise<Product[]> {
    const params: (string | number)[] = [];
    let sql = `SELECT * FROM products${this.where(filters, params)} ORDER BY id ASC`;
    if (page) {
      params.push(page.limit);  sql += ` LIMIT $${params.length}`;
      params.push(page.offset); sql += ` OFFSET $${params.length}`;
    }
    const { rows } = await pool.query(sql, params);
    return rows.map((row) => this.mapRow(row));
  }

  async count(filters: ProductFilters = {}): Promise<number> {
    const params: (string | number)[] = [];
    const { rows } = await pool.query(`SELECT COUNT(*) FROM products${this.where(filters, params)}`, params);
    return parseInt(rows[0].count, 10);
  }

  async categories(): Promise<string[]> {
    const { rows } = await pool.query(
      `SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category <> '' ORDER BY category ASC`
    );
    return rows.map((row) => row.category as string);
  }

  async show(id: number): Promise<Product | null> {
    const { rows } = await pool.query('SELECT * FROM products WHERE id=$1', [id]);
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async create(product: Product, db: Queryable = pool): Promise<Product> {
    const { rows } = await db.query(INSERT_PRODUCT, [
      product.name,
      product.price,
      product.category || null,
      product.image || null,
      product.description || null,
      JSON.stringify(product.previewImg || []),
      JSON.stringify(product.types || []),
      JSON.stringify(product.reviews || []),
      product.overallRating || 0,
      product.stock || 0,
      product.isActive !== undefined ? product.isActive : true,
      product.shopId || null,
      product.shopName || null,
    ]);
    return this.mapRow(rows[0]);
  }

  async update(id: number, product: Partial<Product>): Promise<Product | null> {
    const fields: string[] = [];
    const values: (string | number | boolean)[] = [];
    let i = 1;

    if (product.name)                  { fields.push(`name=$${i++}`);           values.push(product.name); }
    if (product.price !== undefined)   { fields.push(`price=$${i++}`);          values.push(product.price); }
    if (product.category !== undefined){ fields.push(`category=$${i++}`);       values.push(product.category as string); }
    if (product.image !== undefined)   { fields.push(`image=$${i++}`);          values.push(product.image as string); }
    if (product.description !== undefined){ fields.push(`description=$${i++}`); values.push(product.description as string); }
    if (product.previewImg !== undefined) { fields.push(`preview_img=$${i++}`); values.push(JSON.stringify(product.previewImg)); }
    if (product.types !== undefined)   { fields.push(`types=$${i++}`);          values.push(JSON.stringify(product.types)); }
    if (product.reviews !== undefined) { fields.push(`reviews=$${i++}`);        values.push(JSON.stringify(product.reviews)); }
    if (product.overallRating !== undefined){ fields.push(`overall_rating=$${i++}`); values.push(product.overallRating); }
    if (product.stock !== undefined)   { fields.push(`stock=$${i++}`);          values.push(product.stock); }
    if (product.isActive !== undefined){ fields.push(`is_active=$${i++}`);      values.push(product.isActive); }
    if (product.shopId !== undefined)  { fields.push(`shop_id=$${i++}`);        values.push(product.shopId as string); }
    if (product.shopName !== undefined){ fields.push(`shop_name=$${i++}`);      values.push(product.shopName as string); }

    if (!fields.length) return this.show(id);

    values.push(id);
    const { rows } = await pool.query(
      `UPDATE products SET ${fields.join(', ')} WHERE id=$${i} RETURNING *`,
      values
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async delete(id: number): Promise<Product | null> {
    const { rows } = await pool.query('DELETE FROM products WHERE id=$1 RETURNING *', [id]);
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async bulkCreate(products: Product[]): Promise<Product[]> {
    return withTransaction(async (tx) => {
      const created: Product[] = [];
      for (const product of products) created.push(await this.create(product, tx));
      return created;
    });
  }

  async mostPopular(limit: number = 5): Promise<Product[]> {
    const { rows } = await pool.query(
      `SELECT p.*, COALESCE(SUM(op.quantity), 0) AS total_quantity
       FROM products p LEFT JOIN order_products op ON p.id = op.product_id
       GROUP BY p.id ORDER BY total_quantity DESC LIMIT $1`,
      [limit]
    );
    return rows.map((row) => this.mapRow(row));
  }

  private where(filters: ProductFilters, params: (string | number)[]): string {
    const conditions: string[] = [];
    if (filters.category) {
      params.push(filters.category);
      conditions.push(`LOWER(category) = LOWER($${params.length})`);
    }
    if (filters.search) {
      params.push(filters.search.toLowerCase());
      conditions.push(
        `(STRPOS(LOWER(name), $${params.length}) > 0 OR STRPOS(LOWER(COALESCE(description, '')), $${params.length}) > 0)`
      );
    }
    return conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
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

  private mapRow(row: Record<string, unknown>): Product {
    const rawTypes = row.types as Record<string, unknown>[] | undefined;
    return {
      id: row.id as number,
      name: row.name as string,
      price: row.price as number,
      category: row.category as string | undefined,
      image: row.image as string | undefined,
      description: row.description as string | undefined,
      previewImg: row.preview_img as string[] | undefined,
      types: rawTypes ? rawTypes.map((t) => this.normalizeType(t)) : undefined,
      reviews: row.reviews as Product['reviews'],
      overallRating: row.overall_rating ? parseFloat(row.overall_rating as string) : undefined,
      stock: row.stock as number | undefined,
      isActive: row.is_active as boolean | undefined,
      shopId: row.shop_id as string | undefined,
      shopName: row.shop_name as string | undefined,
    };
  }
}
