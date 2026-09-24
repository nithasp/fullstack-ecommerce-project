import { Page, Pagination } from '../types/pagination.types';
import { NewProduct, Product, ProductFilters, ProductUpdate } from '../types/product.types';
import { ProductServiceDeps } from '../types/service.types';
import { AppError } from '../utils/errors';
import { pageOf } from '../utils/paging';

const notFound = (id: number) => new AppError(`product with id ${id} not found`, 404, 'not_found');

export function createProductService({ products }: ProductServiceDeps) {
  function list(filters: ProductFilters, page: Pagination): Promise<Page<Product>> {
    return pageOf(
      () => products.index(filters, page),
      () => products.count(filters),
    );
  }

  return {
    listCatalog(filters: ProductFilters, page: Pagination) {
      return list({ ...filters, includeInactive: false }, page);
    },

    listAllProducts(filters: ProductFilters, page: Pagination) {
      return list({ ...filters, includeInactive: true }, page);
    },

    async getCatalogProduct(id: number): Promise<Product> {
      const product = await products.show(id);
      if (!product) throw notFound(id);
      return product;
    },

    async getAnyProduct(id: number): Promise<Product> {
      const product = await products.show(id, true);
      if (!product) throw notFound(id);
      return product;
    },

    listCategories(): Promise<string[]> {
      return products.categories();
    },

    listMostPopular(): Promise<Product[]> {
      return products.mostPopular();
    },

    createProduct(input: NewProduct): Promise<Product> {
      return products.create(input);
    },

    createProducts(inputs: NewProduct[]): Promise<Product[]> {
      return products.createMany(inputs);
    },

    async updateProduct(id: number, changes: ProductUpdate): Promise<Product> {
      const updated = await products.update(id, changes);
      if (!updated) throw notFound(id);
      return updated;
    },

    async archiveProduct(id: number): Promise<Product> {
      const archived = await products.archive(id);
      if (!archived) throw notFound(id);
      return archived;
    },
  };
}

export type ProductService = ReturnType<typeof createProductService>;
