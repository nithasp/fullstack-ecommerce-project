import { Product } from '../../types/product.types';
import { ProductRepository } from '../../repositories/product.repository';

const repository = new ProductRepository();

describe('Product Repository', () => {
  const testProduct: Product = {
    name: 'Wireless Bluetooth Headphones',
    price: 79.99,
    category: 'Electronics',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
    description: 'Premium wireless headphones with active noise cancellation.',
    previewImg: [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
      'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=500'
    ],
    types: [
      {
        _id: undefined,
        productId: 1001,
        color: 'Black',
        quantity: 50,
        price: 79.99,
        stock: 50,
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
      },
    ],
    reviews: [
      {
        star: 5,
        comment: 'Amazing sound quality!',
        userId: 'user123',
        userName: 'John Doe',
        date: '2026-01-15T10:30:00.000Z'
      }
    ],
    overallRating: 4.5,
    stock: 85,
    isActive: true
  };

  it('should have an index method', () => {
    expect(repository.index).toBeDefined();
  });

  it('should have a show method', () => {
    expect(repository.show).toBeDefined();
  });

  it('should have a create method', () => {
    expect(repository.create).toBeDefined();
  });

  it('should have count and categories methods', () => {
    expect(repository.count).toBeDefined();
    expect(repository.categories).toBeDefined();
  });

  it('create method should add a product', async () => {
    const result = await repository.create(testProduct);
    expect(result.name).toBe(testProduct.name);
    expect(parseFloat(result.price as unknown as string)).toBe(testProduct.price);
    expect(result.category).toBe(testProduct.category);
    expect(result.image).toBe(testProduct.image);
    expect(result.description).toBe(testProduct.description);
    expect(result.previewImg).toEqual(testProduct.previewImg);
    expect(result.types).toEqual(testProduct.types);
    expect(result.reviews).toEqual(testProduct.reviews);
    expect(result.overallRating).toBe(testProduct.overallRating);
    expect(result.stock).toBe(testProduct.stock);
    expect(result.isActive).toBe(testProduct.isActive);
  });

  it('index method should return a list of products', async () => {
    const result = await repository.index();
    expect(result.length).toBeGreaterThan(0);
  });

  it('show method should return the correct product', async () => {
    const products = await repository.index();
    const result = await repository.show(products[0].id as number);
    expect(result?.id).toBe(products[0].id);
  });

  it('show method should return null for a missing product', async () => {
    expect(await repository.show(999999)).toBeNull();
  });

  it('index method should filter by category', async () => {
    const result = await repository.index({ category: testProduct.category });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].category).toBe(testProduct.category);
  });

  it('index method should match the category case-insensitively', async () => {
    const result = await repository.index({ category: (testProduct.category as string).toLowerCase() });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].category).toBe(testProduct.category);
  });

  it('index method should search the name and description case-insensitively', async () => {
    const byName = await repository.index({ search: 'BLUETOOTH' });
    expect(byName.some((p) => p.name === testProduct.name)).toBe(true);

    const byDescription = await repository.index({ search: 'noise cancellation' });
    expect(byDescription.some((p) => p.name === testProduct.name)).toBe(true);
  });

  it('index method should treat % and _ in a search as plain characters', async () => {
    expect(await repository.index({ search: '%_%' })).toEqual([]);
  });

  it('index method should return the requested page', async () => {
    await repository.create({ name: 'Second Page Product', price: 1 });
    const firstPage = await repository.index({}, { limit: 1, offset: 0 });
    const secondPage = await repository.index({}, { limit: 1, offset: 1 });
    expect(firstPage.length).toBe(1);
    expect(secondPage.length).toBe(1);
    expect(firstPage[0].id).not.toBe(secondPage[0].id);
  });

  it('count method should count the rows index would return', async () => {
    const filters = { category: testProduct.category };
    expect(await repository.count(filters)).toBe((await repository.index(filters)).length);
    expect(await repository.count()).toBe((await repository.index()).length);
  });

  it('categories method should list each category once', async () => {
    const result = await repository.categories();
    expect(result).toContain(testProduct.category as string);
    expect(new Set(result).size).toBe(result.length);
  });

  it('update method should update product information', async () => {
    const products = await repository.index();
    const productId = products[0].id as number;
    const result = await repository.update(productId, {
      name: 'Updated Product',
      price: 39.99,
      description: 'Updated description',
      stock: 100
    });
    expect(result?.name).toBe('Updated Product');
    expect(parseFloat(result?.price as unknown as string)).toBe(39.99);
    expect(result?.description).toBe('Updated description');
    expect(result?.stock).toBe(100);
  });

  it('update method with no fields should return the product unchanged', async () => {
    const [product] = await repository.index({}, { limit: 1, offset: 0 });
    const result = await repository.update(product.id as number, {});
    expect(result?.name).toBe(product.name);
  });

  it('bulkCreate method should insert nothing when one row is rejected', async () => {
    const before = await repository.count();
    await expectAsync(repository.bulkCreate([
      { name: 'Bulk Row That Fits', price: 1 },
      { name: 'Bulk Row Out Of Range', price: 1, stock: 1e12 }, // too large for the INTEGER column
    ])).toBeRejected();
    expect(await repository.count()).toBe(before);
  });

  it('delete method should remove the product', async () => {
    const created = await repository.create({
      name: 'To Delete',
      price: 5.00,
      category: 'Temp',
      stock: 0,
      isActive: false
    });
    const result = await repository.delete(created.id as number);
    expect(result?.id).toBe(created.id);
    const remaining = await repository.index();
    const found = remaining.find((p) => p.id === created.id);
    expect(found).toBeUndefined();
  });
});
