import { Product } from '../../types/product.types';
import { ProductStore } from '../../models/product';

const store = new ProductStore();

describe('Product Model', () => {
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
    expect(store.index).toBeDefined();
  });

  it('should have a show method', () => {
    expect(store.show).toBeDefined();
  });

  it('should have a create method', () => {
    expect(store.create).toBeDefined();
  });

  it('should have a getByCategory method', () => {
    expect(store.getByCategory).toBeDefined();
  });

  it('create method should add a product', async () => {
    const result = await store.create(testProduct);
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
    const result = await store.index();
    expect(result.length).toBeGreaterThan(0);
  });

  it('show method should return the correct product', async () => {
    const products = await store.index();
    const result = await store.show(products[0].id as number);
    expect(result.id).toBe(products[0].id);
  });

  it('getByCategory method should return products in the category', async () => {
    const result = await store.getByCategory(testProduct.category as string);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].category).toBe(testProduct.category);
  });

  it('getByCategory method should be case-insensitive', async () => {
    const result = await store.getByCategory(
      (testProduct.category as string).toLowerCase()
    );
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].category).toBe(testProduct.category);
  });

  it('update method should update product information', async () => {
    const products = await store.index();
    const productId = products[0].id as number;
    const result = await store.update(productId, {
      name: 'Updated Product',
      price: 39.99,
      description: 'Updated description',
      stock: 100
    });
    expect(result.name).toBe('Updated Product');
    expect(parseFloat(result.price as unknown as string)).toBe(39.99);
    expect(result.description).toBe('Updated description');
    expect(result.stock).toBe(100);
  });

  it('delete method should remove the product', async () => {
    const created = await store.create({
      name: 'To Delete',
      price: 5.00,
      category: 'Temp',
      stock: 0,
      isActive: false
    });
    const result = await store.delete(created.id as number);
    expect(result.id).toBe(created.id);
    const remaining = await store.index();
    const found = remaining.find((p) => p.id === created.id);
    expect(found).toBeUndefined();
  });
});
