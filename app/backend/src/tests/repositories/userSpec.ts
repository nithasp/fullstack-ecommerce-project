import { User } from '../../types/user.types';
import { UserStore } from '../../models/user';

const store = new UserStore();

describe('User Model', () => {
  const testUser: User = {
    firstName: 'John',
    lastName: 'Doe',
    username: 'johndoe_' + Date.now(),
    password: 'password123',
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

  it('should have an authenticate method', () => {
    expect(store.authenticate).toBeDefined();
  });

  it('create method should add a user', async () => {
    const result = await store.create(testUser);
    expect(result.firstName).toBe(testUser.firstName);
    expect(result.lastName).toBe(testUser.lastName);
    expect(result.username).toBe(testUser.username);
  });

  it('index method should return a list of users', async () => {
    const result = await store.index();
    expect(result.length).toBeGreaterThan(0);
  });

  it('show method should return the correct user', async () => {
    const users = await store.index();
    const result = await store.show(users[0].id as number);
    expect(result.username).toBe(users[0].username);
  });

  it('authenticate method should return the user when credentials are correct', async () => {
    const result = await store.authenticate(testUser.username, testUser.password);
    expect(result).not.toBeNull();
    if (result) {
      expect(result.username).toBe(testUser.username);
    }
  });

  it('authenticate method should return null when credentials are incorrect', async () => {
    const result = await store.authenticate(testUser.username, 'wrongpassword');
    expect(result).toBeNull();
  });

  it('update method should update user information', async () => {
    const users = await store.index();
    const userId = users[0].id as number;
    const result = await store.update(userId, { firstName: 'Jane' });
    expect(result.firstName).toBe('Jane');
  });

  it('delete method should remove the user', async () => {
    const users = await store.index();
    const lastUser = users[users.length - 1];
    const result = await store.delete(lastUser.id as number);
    expect(result.id).toBe(lastUser.id);
    const remaining = await store.index();
    const found = remaining.find((u) => u.id === lastUser.id);
    expect(found).toBeUndefined();
  });
});
