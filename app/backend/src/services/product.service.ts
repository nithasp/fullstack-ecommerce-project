import { ProductRepository } from '../repositories/product.repository';
import { NewProductInput, ProductUpdateInput } from '../schemas/product.schema';
import { Pagination } from '../types/pagination.types';
import { Product, ProductFilters } from '../types/product.types';
import { AppError } from '../utils/response';

const products = new ProductRepository();

const notFound = (id: number) => new AppError(`product with id ${id} not found`, 404, 'not_found');

async function list(filters: ProductFilters, page: Pagination): Promise<{ items: Product[]; total: number }> {
  const [items, total] = await Promise.all([products.index(filters, page), products.count(filters)]);
  return { items, total };
}

export function listCatalog(filters: ProductFilters, page: Pagination) {
  return list({ ...filters, includeInactive: false }, page);
}

export function listAllProducts(filters: ProductFilters, page: Pagination) {
  return list({ ...filters, includeInactive: true }, page);
}

export async function getCatalogProduct(id: number): Promise<Product> {
  const product = await products.show(id);
  if (!product) throw notFound(id);
  return product;
}

export async function getAnyProduct(id: number): Promise<Product> {
  const product = await products.show(id, true);
  if (!product) throw notFound(id);
  return product;
}

export function listCategories(): Promise<string[]> {
  return products.categories();
}

export function listMostPopular(): Promise<Product[]> {
  return products.mostPopular();
}

export function createProduct(input: NewProductInput): Promise<Product> {
  return products.create(input);
}

export function createProducts(inputs: NewProductInput[]): Promise<Product[]> {
  return products.createMany(inputs);
}

export async function updateProduct(id: number, changes: ProductUpdateInput): Promise<Product> {
  const updated = await products.update(id, changes);
  if (!updated) throw notFound(id);
  return updated;
}

export async function archiveProduct(id: number): Promise<Product> {
  const archived = await products.archive(id);
  if (!archived) throw notFound(id);
  return archived;
}
