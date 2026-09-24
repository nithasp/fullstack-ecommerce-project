import { PoolClient } from 'pg';
import pool from '../database';
import { Queryable } from '../types/database.types';
import { Pagination } from '../types/pagination.types';
import {
  LockedCatalog,
  NewProduct,
  Product,
  ProductFilters,
  ProductType,
  ProductUpdate,
  ProductVariant,
  Review,
  VariantInput,
} from '../types/product.types';
import { requireRow } from '../utils/rows';

const COLUMNS =
  'name, price, category, image, description, preview_img, reviews, overall_rating, stock, is_active, shop_id, shop_name';

const VARIANTS = `LEFT JOIN LATERAL (
    SELECT COALESCE(
             json_agg(
               json_build_object(
                 '_id', v.ext_id, 'productId', v.product_id, 'color', v.color,
                 'price', v.price, 'stock', v.stock, 'image', v.image
               ) ORDER BY v.position, v.id
             ),
             '[]'::json
           ) AS options,
           SUM(v.stock)::int AS options_stock
    FROM product_variants v
    WHERE v.product_id = p.id
  ) pv ON true`;

const SELECT_PRODUCT = `SELECT p.*, pv.options, pv.options_stock FROM products p ${VARIANTS}`;

const valuesOf = (product: NewProduct): unknown[] => [
  product.name,
  product.price,
  product.category ?? null,
  product.image ?? null,
  product.description ?? null,
  JSON.stringify(product.previewImg),
  JSON.stringify(product.reviews),
  product.overallRating,
  product.stock,
  product.isActive,
  product.shopId ?? null,
  product.shopName ?? null,
];

export const toVariantInputs = (types: ProductType[]): VariantInput[] =>
  types.map((type, index) => ({
    extId: type._id?.trim() || `v${index + 1}`,
    color: type.color,
    price: type.price,
    stock: type.stock,
    image: type.image ?? null,
    position: index + 1,
  }));

export class ProductRepository {
  async index(filters: ProductFilters, page: Pagination, db: Queryable = pool): Promise<Product[]> {
    const params: unknown[] = [];
    const sql = `${SELECT_PRODUCT}${where(filters, params)} ORDER BY p.id ASC
                 LIMIT $${params.push(page.limit)} OFFSET $${params.push(page.offset)}`;
    const { rows } = await db.query(sql, params);
    return rows.map(toProduct);
  }

  async count(filters: ProductFilters, db: Queryable = pool): Promise<number> {
    const params: unknown[] = [];
    const { rows } = await db.query(`SELECT COUNT(*) FROM products p${where(filters, params)}`, params);
    return Number(rows[0]?.count ?? 0);
  }

  async categories(db: Queryable = pool): Promise<string[]> {
    const { rows } = await db.query(
      `SELECT DISTINCT category FROM products
       WHERE is_active AND category IS NOT NULL AND category <> '' ORDER BY category ASC`,
    );
    return rows.map((row) => row.category as string);
  }

  async show(id: number, includeInactive = false, db: Queryable = pool): Promise<Product | null> {
    const { rows } = await db.query(
      `${SELECT_PRODUCT} WHERE p.id = $1${includeInactive ? '' : ' AND p.is_active'}`,
      [id],
    );
    return rows[0] ? toProduct(rows[0]) : null;
  }

  async findVariant(productId: number, extId: string, db: Queryable = pool): Promise<ProductVariant | null> {
    const { rows } = await db.query('SELECT * FROM product_variants WHERE product_id = $1 AND ext_id = $2', [
      productId,
      extId,
    ]);
    return rows[0] ? toVariant(rows[0]) : null;
  }

  // Both tables are locked in id order before checkout reads a stock figure, so two checkouts
  // spending the same rows cannot interleave and oversell
  async lockForCheckout(productIds: number[], tx: PoolClient): Promise<LockedCatalog> {
    const { rows: products } = await tx.query(
      `SELECT id, name, price, stock, is_active FROM products
       WHERE id = ANY($1::int[]) ORDER BY id ASC FOR UPDATE`,
      [productIds],
    );
    const { rows: variants } = await tx.query(
      `SELECT * FROM product_variants WHERE product_id = ANY($1::int[]) ORDER BY id ASC FOR UPDATE`,
      [productIds],
    );

    return {
      products: products.map((row) => ({
        id: row.id as number,
        name: row.name as string,
        price: row.price as string,
        stock: Number(row.stock ?? 0),
        isActive: Boolean(row.is_active),
      })),
      variants: variants.map(toVariant),
    };
  }

  async create(product: NewProduct, db: Queryable = pool): Promise<Product> {
    const { rows } = await db.query(
      `INSERT INTO products (${COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      valuesOf(product),
    );
    const id = requireRow(rows, 'INSERT INTO products').id as number;
    await this.insertVariants([{ productId: id, variants: toVariantInputs(product.types) }], db);
    return (await this.show(id, true, db)) as Product;
  }

  async createMany(products: NewProduct[], db: Queryable = pool): Promise<Product[]> {
    const params: unknown[] = [];
    const tuples = products.map((product) => {
      const placeholders = valuesOf(product).map((value) => `$${params.push(value)}`);
      return `(${placeholders.join(', ')})`;
    });
    const { rows } = await db.query(
      `INSERT INTO products (${COLUMNS}) VALUES ${tuples.join(', ')} RETURNING id`,
      params,
    );

    const ids = rows.map((row) => row.id as number);
    await this.insertVariants(
      ids.map((productId, index) => ({ productId, variants: toVariantInputs(products[index]?.types ?? []) })),
      db,
    );
    return this.byIds(ids, db);
  }

  async update(id: number, changes: ProductUpdate, db: Queryable = pool): Promise<Product | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    const set = (column: string, value: unknown) => fields.push(`${column} = $${values.push(value)}`);

    if (changes.name !== undefined) set('name', changes.name);
    if (changes.price !== undefined) set('price', changes.price);
    if (changes.category !== undefined) set('category', changes.category);
    if (changes.image !== undefined) set('image', changes.image);
    if (changes.description !== undefined) set('description', changes.description);
    if (changes.previewImg !== undefined) set('preview_img', JSON.stringify(changes.previewImg));
    if (changes.reviews !== undefined) set('reviews', JSON.stringify(changes.reviews));
    if (changes.overallRating !== undefined) set('overall_rating', changes.overallRating);
    if (changes.stock !== undefined) set('stock', changes.stock);
    if (changes.isActive !== undefined) set('is_active', changes.isActive);
    if (changes.shopId !== undefined) set('shop_id', changes.shopId);
    if (changes.shopName !== undefined) set('shop_name', changes.shopName);

    if (fields.length) {
      const { rowCount } = await db.query(
        `UPDATE products SET ${fields.join(', ')} WHERE id = $${values.push(id)}`,
        values,
      );
      if (!rowCount) return null;
    } else if (!(await this.show(id, true, db))) {
      return null;
    }

    if (changes.types !== undefined) {
      await this.replaceVariants(id, toVariantInputs(changes.types), db);
    }
    return this.show(id, true, db);
  }

  async archive(id: number, db: Queryable = pool): Promise<Product | null> {
    const { rowCount } = await db.query('UPDATE products SET is_active = false WHERE id = $1', [id]);
    return rowCount ? this.show(id, true, db) : null;
  }

  async takeProductStock(id: number, quantity: number, db: Queryable = pool): Promise<boolean> {
    const { rowCount } = await db.query(
      'UPDATE products SET stock = stock - $2 WHERE id = $1 AND stock >= $2',
      [id, quantity],
    );
    return (rowCount ?? 0) > 0;
  }

  async takeVariantStock(id: number, quantity: number, db: Queryable = pool): Promise<boolean> {
    const { rowCount } = await db.query(
      'UPDATE product_variants SET stock = stock - $2 WHERE id = $1 AND stock >= $2',
      [id, quantity],
    );
    return (rowCount ?? 0) > 0;
  }

  async mostPopular(limit = 5, db: Queryable = pool): Promise<Product[]> {
    const { rows } = await db.query(
      `${SELECT_PRODUCT}
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(op.quantity), 0) AS sold
         FROM order_products op
         JOIN orders o ON o.id = op.order_id
         WHERE op.product_id = p.id AND o.status = 'complete'
       ) pop ON true
       WHERE p.is_active
       ORDER BY pop.sold DESC, p.id ASC
       LIMIT $1`,
      [limit],
    );
    return rows.map(toProduct);
  }

  private async byIds(ids: number[], db: Queryable): Promise<Product[]> {
    if (!ids.length) return [];
    const { rows } = await db.query(`${SELECT_PRODUCT} WHERE p.id = ANY($1::int[]) ORDER BY p.id ASC`, [ids]);
    return rows.map(toProduct);
  }

  private async replaceVariants(productId: number, variants: VariantInput[], db: Queryable): Promise<void> {
    await db.query(
      `DELETE FROM product_variants WHERE product_id = $1 AND NOT (ext_id = ANY($2::varchar[]))`,
      [productId, variants.map((variant) => variant.extId)],
    );
    await this.insertVariants([{ productId, variants }], db);
  }

  private async insertVariants(
    groups: { productId: number; variants: VariantInput[] }[],
    db: Queryable,
  ): Promise<void> {
    const params: unknown[] = [];
    const tuples = groups.flatMap((group) =>
      group.variants.map(
        (variant) =>
          `(${[
            group.productId,
            variant.extId,
            variant.color,
            variant.price,
            variant.stock,
            variant.image,
            variant.position,
          ]
            .map((value) => `$${params.push(value)}`)
            .join(', ')})`,
      ),
    );
    if (!tuples.length) return;

    await db.query(
      `INSERT INTO product_variants (product_id, ext_id, color, price, stock, image, position)
       VALUES ${tuples.join(', ')}
       ON CONFLICT ON CONSTRAINT product_variants_product_ext_unique DO UPDATE SET
         color = EXCLUDED.color,
         price = EXCLUDED.price,
         stock = EXCLUDED.stock,
         image = EXCLUDED.image,
         position = EXCLUDED.position`,
      params,
    );
  }
}

// % and _ in a search term are escaped so they match those characters, instead of acting as
// wildcards that would widen the query beyond what the caller asked for
const likeTerm = (search: string): string => `%${search.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;

function where(filters: ProductFilters, params: unknown[]): string {
  const conditions: string[] = [];
  if (!filters.includeInactive) conditions.push('p.is_active');
  if (filters.category) conditions.push(`LOWER(p.category) = LOWER($${params.push(filters.category)})`);
  if (filters.search) {
    const index = params.push(likeTerm(filters.search));
    conditions.push(`(p.name ILIKE $${index} OR p.description ILIKE $${index})`);
  }
  return conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
}

function toVariant(row: Record<string, unknown>): ProductVariant {
  return {
    id: row.id as number,
    productId: row.product_id as number,
    extId: row.ext_id as string,
    color: row.color as string,
    price: Number(row.price),
    stock: Number(row.stock ?? 0),
    image: (row.image as string | null) ?? null,
    position: Number(row.position ?? 0),
  };
}

export function toProductType(value: Record<string, unknown>): ProductType {
  return {
    _id: value._id as string | undefined,
    productId: (value.productId ?? value.product_id) as number | undefined,
    color: value.color as string,
    price: Number(value.price),
    stock: Number(value.stock ?? 0),
    image: (value.image as string | undefined) ?? undefined,
  };
}

export function toProductTypes(value: unknown): ProductType[] {
  return Array.isArray(value) ? value.map((item) => toProductType(item as Record<string, unknown>)) : [];
}

export function toProduct(row: Record<string, unknown>): Product {
  const options = toProductTypes(row.options);
  return {
    id: row.id as number,
    name: row.name as string,
    price: row.price as string,
    category: (row.category as string | null) ?? null,
    image: (row.image as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    previewImg: Array.isArray(row.preview_img) ? (row.preview_img as string[]) : [],
    types: options,
    reviews: Array.isArray(row.reviews) ? (row.reviews as Review[]) : [],
    overallRating: Number(row.overall_rating ?? 0),
    stock: options.length ? Number(row.options_stock ?? 0) : Number(row.stock ?? 0),
    isActive: Boolean(row.is_active),
    shopId: (row.shop_id as string | null) ?? null,
    shopName: (row.shop_name as string | null) ?? null,
  };
}
