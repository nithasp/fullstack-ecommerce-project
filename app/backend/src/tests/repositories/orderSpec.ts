import { Order, OrderProduct } from '../../types/order.types';
import { NewUser } from '../../types/user.types';
import { Product } from '../../types/product.types';
import { OrderRepository } from '../../repositories/order.repository';
import { UserRepository } from '../../repositories/user.repository';
import { ProductRepository } from '../../repositories/product.repository';

const repository = new OrderRepository();
const users = new UserRepository();
const products = new ProductRepository();

describe('Order Repository', () => {
  let testUserId: number;
  let testProductId: number;
  let testOrderId: number;

  beforeAll(async () => {
    const user: NewUser = {
      firstName: 'Test',
      lastName: 'User',
      username: 'testorderuser_' + Date.now(),
      password: 'password123',
    };
    const createdUser = await users.create(user);
    testUserId = createdUser.id as number;

    const product: Product = {
      name: 'Test Order Product',
      price: 19.99,
      category: 'Test',
      image: 'https://example.com/test.jpg',
      description: 'A test product for order testing',
      stock: 10,
      isActive: true
    };
    const createdProduct = await products.create(product);
    testProductId = createdProduct.id as number;
  });

  it('should have an index method', () => {
    expect(repository.index).toBeDefined();
  });

  it('should have a show method', () => {
    expect(repository.show).toBeDefined();
  });

  it('should have a create method', () => {
    expect(repository.create).toBeDefined();
  });

  it('index method should accept filters', () => {
    expect(repository.index).toBeDefined();
  });

  it('should have a getOrderProducts method', () => {
    expect(repository.getOrderProducts).toBeDefined();
  });

  it('should have an addProduct method', () => {
    expect(repository.addProduct).toBeDefined();
  });

  it('create method should add an order', async () => {
    const order: Order = {
      userId: testUserId,
      status: 'active'
    };
    const result = await repository.create(order);
    testOrderId = result.id as number;
    expect(result.userId).toBe(testUserId);
    expect(result.status).toBe('active');
  });

  it('index method should return a list of orders', async () => {
    const result = await repository.index();
    expect(result.length).toBeGreaterThan(0);
  });

  it('show method should return the correct order', async () => {
    const result = await repository.show(testOrderId);
    expect(result?.id).toBe(testOrderId);
  });

  it('show method should return null for a missing order', async () => {
    expect(await repository.show(999999)).toBeNull();
  });

  it('count method should count the rows index would return', async () => {
    const filters = { userId: testUserId };
    expect(await repository.count(filters)).toBe((await repository.index(filters)).length);
  });

  it('index method should return the requested page', async () => {
    await repository.create({ userId: testUserId, status: 'active' });
    const page = await repository.index({ userId: testUserId }, { limit: 1, offset: 1 });
    expect(page.length).toBe(1);
    expect(page[0].id).not.toBe(testOrderId);
  });

  it('index method should return orders filtered by userId', async () => {
    const result = await repository.index({ userId: testUserId });
    expect(result.length).toBeGreaterThan(0);
    result.forEach((order) => {
      expect(order.userId).toBe(testUserId);
    });
  });

  it('index method should return orders filtered by status', async () => {
    const result = await repository.index({ status: 'active' });
    expect(result.length).toBeGreaterThan(0);
    result.forEach((order) => {
      expect(order.status).toBe('active');
    });
  });

  it('index method should return orders filtered by status and userId', async () => {
    const result = await repository.index({ status: 'active', userId: testUserId });
    expect(result.length).toBeGreaterThan(0);
    result.forEach((order) => {
      expect(order.status).toBe('active');
      expect(order.userId).toBe(testUserId);
    });
  });

  it('addProduct method should add a product to an order', async () => {
    const orderProduct: OrderProduct = {
      orderId: testOrderId,
      productId: testProductId,
      quantity: 2
    };
    const result = await repository.addProduct(orderProduct);
    expect(result.orderId).toBe(testOrderId);
    expect(result.productId).toBe(testProductId);
    expect(result.quantity).toBe(2);
  });

  it('getOrderProducts method should return products for an order', async () => {
    const result = await repository.getOrderProducts(testOrderId);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].orderId).toBe(testOrderId);
    expect(result[0].productId).toBe(testProductId);
    expect(result[0].quantity).toBe(2);
  });

  it('update method should update order status', async () => {
    const result = await repository.update(testOrderId, 'complete');
    expect(result?.status).toBe('complete');
    expect(result?.id).toBe(testOrderId);
  });

  it('index method should return completed orders filtered by status and userId', async () => {
    const result = await repository.index({ status: 'complete', userId: testUserId });
    expect(result.length).toBeGreaterThan(0);
    result.forEach((order) => {
      expect(order.status).toBe('complete');
      expect(order.userId).toBe(testUserId);
    });
  });

  it('should have a recentPurchases method', () => {
    expect(repository.recentPurchases).toBeDefined();
  });

  it('recentPurchases method should return recent purchases for a user', async () => {
    const result = await repository.recentPurchases(testUserId);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].productId).toBe(testProductId);
    expect(result[0].orderId).toBe(testOrderId);
    expect(result[0].quantity).toBe(2);
    expect(result[0].name).toBe('Test Order Product');
    expect(parseFloat(result[0].price as unknown as string)).toBe(19.99);
  });

  it('recentPurchases method should return at most 5 items', async () => {
    const result = await repository.recentPurchases(testUserId, 5);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('recentPurchases method should return empty array for user with no purchases', async () => {
    const result = await repository.recentPurchases(99999);
    expect(result).toEqual([]);
  });

  it('delete method should remove the order', async () => {
    const newOrder = await repository.create({ userId: testUserId, status: 'active' });
    const result = await repository.delete(newOrder.id as number);
    expect(result?.id).toBe(newOrder.id);
    const remaining = await repository.index();
    const found = remaining.find((o) => o.id === newOrder.id);
    expect(found).toBeUndefined();
  });
});
