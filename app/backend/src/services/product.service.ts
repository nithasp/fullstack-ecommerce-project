import { ProductRepository } from '../repositories/product.repository';
import { Page, Pagination } from '../types/pagination.types';
import { NewProduct, Product, ProductFilters, ProductUpdate } from '../types/product.types';
import { AppError } from '../utils/errors';
import { pageOf } from '../utils/paging';

const products = new ProductRepository();

const notFound = (id: number) => new AppError(`product with id ${id} not found`, 404, 'not_found');

function list(filters: ProductFilters, page: Pagination): Promise<Page<Product>> {
  return pageOf(
    () => products.index(filters, page),
    () => products.count(filters),
  );
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

export function createProduct(input: NewProduct): Promise<Product> {
  return products.create(input);
}

export function createProducts(inputs: NewProduct[]): Promise<Product[]> {
  return products.createMany(inputs);
}

export async function updateProduct(id: number, changes: ProductUpdate): Promise<Product> {
  const updated = await products.update(id, changes);
  if (!updated) throw notFound(id);
  return updated;
}

export async function archiveProduct(id: number): Promise<Product> {
  const archived = await products.archive(id);
  if (!archived) throw notFound(id);
  return archived;
}
