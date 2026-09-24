import { createOrderService } from '../../services/order.service';
import { createProductService } from '../../services/product.service';
import { Order, OrderLine } from '../../types/order.types';
import { Product, ProductFilters, ProductVariant } from '../../types/product.types';
import { OrderServiceDeps, ProductServiceDeps } from '../../types/service.types';

const aProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 1,
  name: 'Test Product',
  price: '19.99',
  category: 'TestCategory',
  image: null,
  description: null,
  previewImg: [],
  types: [],
  reviews: [],
  overallRating: 0,
  stock: 5,
  isActive: true,
  shopId: null,
  shopName: null,
  ...overrides,
});

const anOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 10,
  userId: 100,
  status: 'complete',
  createdAt: new Date(),
  total: '19.99',
  addressId: null,
  shippingAddress: null,
  ...overrides,
});

const aVariant = (overrides: Partial<ProductVariant> = {}): ProductVariant => ({
  id: 7,
  productId: 1,
  extId: 'red',
  color: 'Red',
  price: 25.5,
  stock: 3,
  image: null,
  position: 0,
  ...overrides,
});

const aLine = (overrides: Partial<OrderLine> = {}): OrderLine => ({
  id: 1,
  orderId: 10,
  productId: 1,
  variantId: null,
  typeId: null,
  quantity: 1,
  unitPrice: '19.99',
  ...overrides,
});

function productStore(
  overrides: Partial<ProductServiceDeps['products']> = {},
): ProductServiceDeps['products'] {
  return {
    index: async () => [],
    count: async () => 0,
    show: async () => null,
    categories: async () => [],
    mostPopular: async () => [],
    create: async () => aProduct(),
    createMany: async () => [],
    update: async () => null,
    archive: async () => null,
    ...overrides,
  };
}

function orderStore(overrides: Partial<OrderServiceDeps['orders']> = {}): OrderServiceDeps['orders'] {
  return {
    index: async () => [],
    count: async () => 0,
    show: async () => null,
    lines: async () => [],
    create: async () => anOrder(),
    updateStatus: async () => null,
    delete: async () => null,
    addLine: async () => aLine(),
    ...overrides,
  };
}

describe('Product service', () => {
  it('hides archived products from the catalogue even when a caller asks for them', async () => {
    const seen: ProductFilters[] = [];
    const service = createProductService({
      products: productStore({
        index: async (filters) => {
          seen.push(filters);
          return [];
        },
        count: async (filters) => {
          seen.push(filters);
          return 0;
        },
      }),
    });

    await service.listCatalog({ includeInactive: true }, { limit: 10, offset: 0 });

    expect(seen.length).toBe(2);
    for (const filters of seen) expect(filters.includeInactive).toBe(false);
  });

  it('lets an admin listing include archived products', async () => {
    const seen: ProductFilters[] = [];
    const service = createProductService({
      products: productStore({
        index: async (filters) => {
          seen.push(filters);
          return [];
        },
        count: async (filters) => {
          seen.push(filters);
          return 0;
        },
      }),
    });

    await service.listAllProducts({}, { limit: 10, offset: 0 });

    for (const filters of seen) expect(filters.includeInactive).toBe(true);
  });

  it('reads a catalogue product without archived ones, and an admin one with them', async () => {
    const asked: Array<boolean | undefined> = [];
    const service = createProductService({
      products: productStore({
        show: async (_id, includeInactive) => {
          asked.push(includeInactive);
          return aProduct();
        },
      }),
    });

    await service.getCatalogProduct(1);
    await service.getAnyProduct(1);

    expect(asked[0]).toBeFalsy();
    expect(asked[1]).toBe(true);
  });

  it('reports a missing product as 404', async () => {
    const service = createProductService({ products: productStore() });

    await expectAppError(() => service.getCatalogProduct(99), 404);
    await expectAppError(() => service.updateProduct(99, { name: 'x' }), 404);
    await expectAppError(() => service.archiveProduct(99), 404);
  });
});

describe('Order service', () => {
  it("reports another customer's order as not found rather than forbidden", async () => {
    const service = createOrderService({
      orders: orderStore({ show: async () => anOrder({ userId: 100 }) }),
      products: { show: async () => null, findVariant: async () => null },
    });

    expect((await service.getOwnOrder(10, 100)).id).toBe(10);
    await expectAppError(() => service.getOwnOrder(10, 999), 404);
  });

  it('prices a line from the product, not from the request', async () => {
    const added: Array<{ unitPrice: string; typeId: string | null }> = [];
    const service = createOrderService({
      orders: orderStore({
        addLine: async (_orderId, line) => {
          added.push({ unitPrice: line.unitPrice, typeId: line.typeId });
          return aLine(line);
        },
      }),
      products: {
        show: async () => aProduct({ price: '19.99' }),
        findVariant: async () => aVariant({ price: 25.5 }),
      },
    });

    await service.addLine(10, { productId: 1, quantity: 2 });
    await service.addLine(10, { productId: 1, quantity: 2, typeId: 'red' });

    expect(added[0]?.unitPrice).toBe('19.99');
    expect(added[0]?.typeId).toBeNull();
    expect(added[1]?.unitPrice).toBe('25.50');
    expect(added[1]?.typeId).toBe('red');
  });

  it('refuses a line for an option the product does not have', async () => {
    const service = createOrderService({
      orders: orderStore(),
      products: { show: async () => aProduct(), findVariant: async () => null },
    });

    await expectAppError(() => service.addLine(10, { productId: 1, quantity: 1, typeId: 'gone' }), 400);
  });
});

async function expectAppError(run: () => Promise<unknown>, statusCode: number): Promise<void> {
  try {
    await run();
  } catch (err) {
    expect((err as { statusCode?: number }).statusCode).toBe(statusCode);
    return;
  }
  fail(`expected a ${statusCode} to be thrown`);
}
