import client, { withTransaction } from '../database';
import { buildSetAssignments } from '../utils/sql';
import { Product } from '../types/product.types';

const INSERT_PRODUCT_SQL = `
  INSERT INTO products (name, price, category, image, description, preview_img, types, reviews, overall_rating, stock, is_active, shop_id, shop_name)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`;

export class ProductStore {
  async index(): Promise<Product[]> {
    const { rows } = await client.query('SELECT * FROM products');
    return rows.map((row) => this.mapRow(row));
  }

  async show(id: number): Promise<Product | null> {
    const { rows } = await client.query('SELECT * FROM products WHERE id=$1', [id]);
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async create(product: Product): Promise<Product> {
    const { rows } = await client.query(INSERT_PRODUCT_SQL, this.toInsertValues(product));
    return this.mapRow(rows[0]);
  }

  /** Insert all products in one transaction — either every row is created or none. */
  async bulkCreate(products: Product[]): Promise<Product[]> {
    return withTransaction(async (tx) => {
      const results: Product[] = [];
      for (const product of products) {
        const { rows } = await tx.query(INSERT_PRODUCT_SQL, this.toInsertValues(product));
        results.push(this.mapRow(rows[0]));
      }
      return results;
    });
  }

  async update(id: number, product: Partial<Product>): Promise<Product | null> {
    const { assignments, values } = buildSetAssignments({
      name: product.name,
      price: product.price,
      category: product.category,
      image: product.image,
      description: product.description,
      preview_img: product.previewImg !== undefined ? JSON.stringify(product.previewImg) : undefined,
      types: product.types !== undefined ? JSON.stringify(product.types) : undefined,
      reviews: product.reviews !== undefined ? JSON.stringify(product.reviews) : undefined,
      overall_rating: product.overallRating,
      stock: product.stock,
      is_active: product.isActive,
      shop_id: product.shopId,
      shop_name: product.shopName,
    });
    if (assignments.length === 0) return this.show(id);

    values.push(id);
    const { rows } = await client.query(
      `UPDATE products SET ${assignments.join(', ')} WHERE id=$${values.length} RETURNING *`,
      values
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async delete(id: number): Promise<Product | null> {
    const { rows } = await client.query('DELETE FROM products WHERE id=$1 RETURNING *', [id]);
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async mostPopular(limit: number = 5): Promise<Product[]> {
    const { rows } = await client.query(
      `SELECT p.*, COALESCE(SUM(op.quantity), 0) AS total_quantity
       FROM products p LEFT JOIN order_products op ON p.id = op.product_id
       GROUP BY p.id ORDER BY total_quantity DESC LIMIT $1`,
      [limit]
    );
    return rows.map((row) => this.mapRow(row));
  }

  async getByCategory(category: string): Promise<Product[]> {
    const { rows } = await client.query(
      'SELECT * FROM products WHERE LOWER(category) = LOWER($1)',
      [category]
    );
    return rows.map((row) => this.mapRow(row));
  }

  private toInsertValues(product: Product): unknown[] {
    return [
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
    ];
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
