import supertest from 'supertest';
import app from '../../app';
import { Product } from '../../types/product.types';
import { createAdmin } from '../support/admin';

const request = supertest(app);
let token: string;       // customer: may read the catalog
let adminToken: string;  // admin: may create, update and delete products

describe('Product Endpoints', () => {
  beforeAll(async () => {
    const user = {
      firstName: 'Product',
      lastName: 'Tester',
      username: 'producttester_' + Date.now(),
      password: 'testpass123',
    };
    const response = await request.post('/api/v1/auth/register').send(user);
    token = response.body.data.accessToken;
    adminToken = (await createAdmin(request, 'productadmin')).token;
  });

  const testProduct: Product = {
    name: 'Test API Product',
    price: 49.99,
    category: 'Books',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
    description: 'A test product for API testing.',
    previewImg: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500'],
    types: [
      {
        productId: 9001,
        color: 'Red',
        quantity: 10,
        price: 49.99,
        stock: 10,
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
      },
    ],
    reviews: [],
    overallRating: 0,
    stock: 10,
    isActive: true,
  };

  it('GET /products should return list of products', async () => {
    const response = await request
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it('GET /products should require token', async () => {
    await request.get('/api/v1/products').expect(401);
  });

  it('POST /products should create a product with an admin token', async () => {
    const response = await request
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(testProduct)
      .expect(201);

    expect(response.body.data.name).toBe(testProduct.name);
    expect(parseFloat(response.body.data.price)).toBe(testProduct.price);
    expect(response.body.data.category).toBe(testProduct.category);
    expect(response.body.data.image).toBe(testProduct.image);
    expect(response.body.data.description).toBe(testProduct.description);
    expect(response.body.data.previewImg).toEqual(testProduct.previewImg);
    expect(response.body.data.types).toEqual(testProduct.types);
    expect(response.body.data.stock).toBe(testProduct.stock);
    expect(response.body.data.isActive).toBe(testProduct.isActive);
  });

  it('POST /products should require token', async () => {
    await request.post('/api/v1/products').send(testProduct).expect(401);
  });

  describe('Admin-only writes', () => {
    it('POST /products should return 403 for a customer', async () => {
      const response = await request
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send(testProduct)
        .expect(403);
      expect(response.body.message).toBe('Admin access required');
    });

    it('POST /products/bulk should return 403 for a customer', async () => {
      await request
        .post('/api/v1/products/bulk')
        .set('Authorization', `Bearer ${token}`)
        .send([testProduct])
        .expect(403);
    });

    it('PUT /products/:id should return 403 for a customer and leave the product unchanged', async () => {
      const list = await request.get('/api/v1/products').set('Authorization', `Bearer ${token}`);
      const product = list.body.data[0];

      await request
        .put(`/api/v1/products/${product.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Tampered' })
        .expect(403);

      const after = await request.get(`/api/v1/products/${product.id}`).set('Authorization', `Bearer ${token}`).expect(200);
      expect(after.body.data.name).toBe(product.name);
    });

    it('DELETE /products/:id should return 403 for a customer and keep the product', async () => {
      const list = await request.get('/api/v1/products').set('Authorization', `Bearer ${token}`);
      const product = list.body.data[0];

      await request
        .delete(`/api/v1/products/${product.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      await request.get(`/api/v1/products/${product.id}`).set('Authorization', `Bearer ${token}`).expect(200);
    });
  });

  it('GET /products/:id should return a product', async () => {
    const productsResponse = await request
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${token}`);
    const productId = productsResponse.body.data[0].id;

    const response = await request
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(response.body.data.id).toBe(productId);
  });

  it('GET /products/:id should require token', async () => {
    await request.get('/api/v1/products/1').expect(401);
  });

  it('GET /products?category= should return products filtered by category', async () => {
    const response = await request
      .get(`/api/v1/products?category=${testProduct.category}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.data[0].category).toBe(testProduct.category);
  });

  it('GET /products?category= should be case-insensitive', async () => {
    const response = await request
      .get(`/api/v1/products?category=${(testProduct.category as string).toUpperCase()}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.data[0].category).toBe(testProduct.category);
  });

  it('GET /products/popular should return top 5 most popular products', async () => {
    const response = await request
      .get('/api/v1/products/popular')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeLessThanOrEqual(5);
  });

  it('GET /products/popular should require token', async () => {
    await request.get('/api/v1/products/popular').expect(401);
  });

  it('PUT /products/:id should update a product with an admin token', async () => {
    const productsResponse = await request
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${token}`);
    const productId = productsResponse.body.data[0].id;

    const response = await request
      .put(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated Product', price: 59.99, description: 'Updated description' })
      .expect(200);

    expect(response.body.data.name).toBe('Updated Product');
    expect(parseFloat(response.body.data.price)).toBe(59.99);
    expect(response.body.data.description).toBe('Updated description');
  });

  it('PUT /products/:id should require token', async () => {
    await request.put('/api/v1/products/1').send({ name: 'Fail' }).expect(401);
  });

  it('DELETE /products/:id should require token', async () => {
    await request.delete('/api/v1/products/1').expect(401);
  });

  it('DELETE /products/:id should delete a product with an admin token', async () => {
    const createRes = await request
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'To Delete', price: 1.0, category: 'Temp' });

    const deleteProductId = createRes.body.data.id;

    const response = await request
      .delete(`/api/v1/products/${deleteProductId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.data.id).toBe(deleteProductId);
  });

  describe('Input Validation', () => {
    it('POST /products should return 400 when name is missing', async () => {
      const response = await request
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ price: 9.99 })
        .expect(400);
      expect(response.body.message).toBe('name is required and must be a non-empty string');
    });

    it('POST /products should return 400 when price is missing', async () => {
      const response = await request
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'No Price Product' })
        .expect(400);
      expect(response.body.message).toBe('price is required and must be a valid number');
    });

    it('POST /products should return 400 when price is negative', async () => {
      const response = await request
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Negative Price', price: -5 })
        .expect(400);
      expect(response.body.message).toBe('price must be a non-negative number');
    });

    it('GET /products/:id should return 400 for invalid id', async () => {
      const response = await request
        .get('/api/v1/products/abc')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
      expect(response.body.message).toBe('product id must be a valid positive integer');
    });

    it('GET /products/:id should return 404 for nonexistent id', async () => {
      const response = await request
        .get('/api/v1/products/99999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
      expect(response.body.message).toBe('product with id 99999 not found');
    });

    it('PUT /products/:id should return 400 for invalid id', async () => {
      const response = await request
        .put('/api/v1/products/abc')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test' })
        .expect(400);
      expect(response.body.message).toBe('product id must be a valid positive integer');
    });

    it('PUT /products/:id should return 400 when no valid fields provided', async () => {
      const response = await request
        .put('/api/v1/products/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);
      expect(response.body.message).toBe('at least one field is required to update');
    });

    it('PUT /products/:id should return 400 when name is empty string', async () => {
      const response = await request
        .put('/api/v1/products/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '   ' })
        .expect(400);
      expect(response.body.message).toBe('name must be a non-empty string');
    });

    it('PUT /products/:id should return 400 when price is invalid', async () => {
      const response = await request
        .put('/api/v1/products/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ price: 'abc' })
        .expect(400);
      expect(response.body.message).toBe('price must be a valid number');
    });

    it('PUT /products/:id should return 400 when price is negative', async () => {
      const response = await request
        .put('/api/v1/products/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ price: -10 })
        .expect(400);
      expect(response.body.message).toBe('price must be a non-negative number');
    });

    it('DELETE /products/:id should return 400 for invalid id', async () => {
      const response = await request
        .delete('/api/v1/products/abc')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
      expect(response.body.message).toBe('product id must be a valid positive integer');
    });
  });

  describe('Pagination, search and categories', () => {
    beforeAll(async () => {
      await request
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Searchable Lamp', price: 25, category: 'Lighting', description: 'A warm reading light' })
        .expect(201);
    });

    it('GET /products should return the first page with its position in the catalog', async () => {
      const response = await request
        .get('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(response.body.meta.limit).toBe(50);
      expect(response.body.meta.offset).toBe(0);
      expect(response.body.meta.total).toBeGreaterThanOrEqual(response.body.data.length);
    });

    it('GET /products should honour limit and offset', async () => {
      const first = await request.get('/api/v1/products?limit=1&offset=0').set('Authorization', `Bearer ${token}`).expect(200);
      const second = await request.get('/api/v1/products?limit=1&offset=1').set('Authorization', `Bearer ${token}`).expect(200);
      expect(first.body.data.length).toBe(1);
      expect(second.body.data.length).toBe(1);
      expect(first.body.data[0].id).not.toBe(second.body.data[0].id);
      expect(second.body.meta.total).toBe(first.body.meta.total);
    });

    it('GET /products should reject a page size over 100', async () => {
      const response = await request
        .get('/api/v1/products?limit=101')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
      expect(response.body.message).toBe('limit must be an integer between 1 and 100');
    });

    it('GET /products?search= should match the name case-insensitively', async () => {
      const response = await request
        .get('/api/v1/products?search=searchable%20LAMP')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(response.body.data.map((p: Product) => p.name)).toContain('Searchable Lamp');
    });

    it('GET /products?search= should match the description too', async () => {
      const response = await request
        .get('/api/v1/products?search=reading%20light')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(response.body.data.map((p: Product) => p.name)).toContain('Searchable Lamp');
    });

    it('GET /products should combine category and search, and count only the matches', async () => {
      const response = await request
        .get('/api/v1/products?category=lighting&search=lamp')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(response.body.data.length).toBeGreaterThan(0);
      response.body.data.forEach((p: Product) => expect(p.category).toBe('Lighting'));
      expect(response.body.meta.total).toBe(response.body.data.length);
    });

    it('GET /products/categories should list every category once', async () => {
      const response = await request
        .get('/api/v1/products/categories')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(response.body.data).toContain('Lighting');
      expect(new Set(response.body.data).size).toBe(response.body.data.length);
    });

    it('GET /products/categories should require token', async () => {
      await request.get('/api/v1/products/categories').expect(401);
    });
  });

  describe('Values the database rejects', () => {
    it('POST /products should return 400 when a value is too long for its column', async () => {
      const response = await request
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'x'.repeat(300), price: 1 })
        .expect(400);
      expect(response.body.message).toBe('A value is too long');
    });

    it('PUT /products/:id should return 400 when stock is not a number', async () => {
      const list = await request.get('/api/v1/products?limit=1').set('Authorization', `Bearer ${token}`).expect(200);
      const response = await request
        .put(`/api/v1/products/${list.body.data[0].id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stock: 'lots' })
        .expect(400);
      expect(response.body.message).toBe('A value has an invalid format');
    });

    it('POST /products/bulk should save nothing when one product is rejected', async () => {
      const before = await request.get('/api/v1/products?limit=1').set('Authorization', `Bearer ${token}`).expect(200);

      const response = await request
        .post('/api/v1/products/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send([
          { name: 'Bulk Row That Fits', price: 1 },
          { name: 'Bulk Row Out Of Range', price: 1, stock: 1e12 },
        ])
        .expect(400);
      expect(response.body.message).toBe('A number is out of range');

      const after = await request.get('/api/v1/products?limit=1').set('Authorization', `Bearer ${token}`).expect(200);
      expect(after.body.meta.total).toBe(before.body.meta.total);
    });

    it('POST /products/bulk should reject an item that is not an object', async () => {
      const response = await request
        .post('/api/v1/products/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send([null])
        .expect(400);
      expect(response.body.message).toBe('products[0] must be an object');
    });
  });
});
