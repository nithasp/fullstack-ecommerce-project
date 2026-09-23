import { PoolClient } from 'pg';
import pool from '../database';
import { Queryable } from '../types/database.types';
import { Pagination } from '../types/pagination.types';
import { Product, ProductFilters, ProductType, Review } from '../types/product.types';
import { NewProductInput, ProductUpdateInput } from '../schemas/product.schema';

const COLUMNS =
  'name, price, category, image, description, preview_img, types, reviews, overall_rating, stock, is_active, shop_id, shop_name';

const valuesOf = (product: NewProductInput): unknown[] => [
  product.name,
  product.price,
  product.category ?? null,
  product.image ?? null,
  product.description ?? null,
  JSON.stringify(product.previewImg),
  JSON.stringify(product.types),
  JSON.stringify(product.reviews),
  product.overallRating,
  product.stock,
  product.isActive,
  product.shopId ?? null,
  product.shopName ?? null,
];

export class ProductRepository {
  async index(filters: ProductFilters, page: Pagination): Promise<Product[]> {
    const params: unknown[] = [];
    const sql = `SELECT * FROM products${where(filters, params)} ORDER BY id ASC
                 LIMIT $${params.push(page.limit)} OFFSET $${params.push(page.offset)}`;
    const { rows } = await pool.query(sql, params);
    return rows.map(toProduct);
  }

  async count(filters: ProductFilters): Promise<number> {
    const params: unknown[] = [];
    const { rows } = await pool.query(`SELECT COUNT(*) FROM products${where(filters, params)}`, params);
    return Number(rows[0].count);
  }

  async categories(): Promise<string[]> {
    const { rows } = await pool.query(
      `SELECT DISTINCT category FROM products
       WHERE is_active AND category IS NOT NULL AND category <> '' ORDER BY category ASC`,
    );
    return rows.map((row) => row.category as string);
  }

  async show(id: number, includeInactive = false): Promise<Product | null> {
    const { rows } = await pool.query(
      `SELECT * FROM products WHERE id = $1${includeInactive ? '' : ' AND is_active'}`,
      [id],
    );
    return rows[0] ? toProduct(rows[0]) : null;
  }

  async lockByIds(ids: number[], tx: PoolClient): Promise<Product[]> {
    const { rows } = await tx.query(
      'SELECT * FROM products WHERE id = ANY($1::int[]) ORDER BY id ASC FOR UPDATE',
      [ids],
    );
    return rows.map(toProduct);
  }

  async create(product: NewProductInput, db: Queryable = pool): Promise<Product> {
    const { rows } = await db.query(
      `INSERT INTO products (${COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      valuesOf(product),
    );
    return toProduct(rows[0]);
  }

  async createMany(products: NewProductInput[], db: Queryable = pool): Promise<Product[]> {
    const params: unknown[] = [];
    const tuples = products.map((product) => {
      const placeholders = valuesOf(product).map((value) => `$${params.push(value)}`);
      return `(${placeholders.join(', ')})`;
    });
    const { rows } = await db.query(
      `INSERT INTO products (${COLUMNS}) VALUES ${tuples.join(', ')} RETURNING *`,
      params,
    );
    return rows.map(toProduct);
  }

  async update(id: number, changes: ProductUpdateInput): Promise<Product | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    const set = (column: string, value: unknown) => fields.push(`${column} = $${values.push(value)}`);

    if (changes.name !== undefined) set('name', changes.name);
    if (changes.price !== undefined) set('price', changes.price);
    if (changes.category !== undefined) set('category', changes.category);
    if (changes.image !== undefined) set('image', changes.image);
    if (changes.description !== undefined) set('description', changes.description);
    if (changes.previewImg !== undefined) set('preview_img', JSON.stringify(changes.previewImg));
    if (changes.types !== undefined) set('types', JSON.stringify(changes.types));
    if (changes.reviews !== undefined) set('reviews', JSON.stringify(changes.reviews));
    if (changes.overallRating !== undefined) set('overall_rating', changes.overallRating);
    if (changes.stock !== undefined) set('stock', changes.stock);
    if (changes.isActive !== undefined) set('is_active', changes.isActive);
    if (changes.shopId !== undefined) set('shop_id', changes.shopId);
    if (changes.shopName !== undefined) set('shop_name', changes.shopName);

    if (!fields.length) return this.show(id, true);

    const { rows } = await pool.query(
      `UPDATE products SET ${fields.join(', ')} WHERE id = $${values.push(id)} RETURNING *`,
      values,
    );
    return rows[0] ? toProduct(rows[0]) : null;
  }

  async archive(id: number): Promise<Product | null> {
    const { rows } = await pool.query('UPDATE products SET is_active = false WHERE id = $1 RETURNING *', [
      id,
    ]);
    return rows[0] ? toProduct(rows[0]) : null;
  }

  async updateStock(id: number, stock: number, types: ProductType[], db: Queryable = pool): Promise<void> {
    await db.query('UPDATE products SET stock = $2, types = $3::jsonb WHERE id = $1', [
      id,
      stock,
      JSON.stringify(types),
    ]);
  }

  async mostPopular(limit = 5): Promise<Product[]> {
    const { rows } = await pool.query(
      `SELECT p.*, COALESCE(SUM(op.quantity) FILTER (WHERE o.status = 'complete'), 0) AS total_quantity
       FROM products p
       LEFT JOIN order_products op ON op.product_id = p.id
       LEFT JOIN orders o ON o.id = op.order_id
       WHERE p.is_active
       GROUP BY p.id
       ORDER BY total_quantity DESC, p.id ASC
       LIMIT $1`,
      [limit],
    );
    return rows.map(toProduct);
  }
}

function where(filters: ProductFilters, params: unknown[]): string {
  const conditions: string[] = [];
  if (!filters.includeInactive) conditions.push('is_active');
  if (filters.category) conditions.push(`LOWER(category) = LOWER($${params.push(filters.category)})`);
  if (filters.search) {
    const index = params.push(filters.search.toLowerCase());
    conditions.push(
      `(STRPOS(LOWER(name), $${index}) > 0 OR STRPOS(LOWER(COALESCE(description, '')), $${index}) > 0)`,
    );
  }
  return conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
}

function toProductType(value: Record<string, unknown>): ProductType {
  return {
    _id: value._id as string | undefined,
    productId: (value.productId ?? value.product_id) as number | undefined,
    color: value.color as string,
    quantity: value.quantity as number | undefined,
    price: Number(value.price),
    stock: Number(value.stock ?? 0),
    image: value.image as string | undefined,
  };
}

function toArray<T>(value: unknown, map: (item: Record<string, unknown>) => T): T[] {
  return Array.isArray(value) ? value.map((item) => map(item as Record<string, unknown>)) : [];
}

export function toProductTypes(value: unknown): ProductType[] {
  return toArray(value, toProductType);
}

export function toProduct(row: Record<string, unknown>): Product {
  return {
    id: row.id as number,
    name: row.name as string,
    price: row.price as string,
    category: (row.category as string | null) ?? null,
    image: (row.image as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    previewImg: Array.isArray(row.preview_img) ? (row.preview_img as string[]) : [],
    types: toProductTypes(row.types),
    reviews: Array.isArray(row.reviews) ? (row.reviews as Review[]) : [],
    overallRating: Number(row.overall_rating ?? 0),
    stock: Number(row.stock ?? 0),
    isActive: Boolean(row.is_active),
    shopId: (row.shop_id as string | null) ?? null,
    shopName: (row.shop_name as string | null) ?? null,
  };
}
