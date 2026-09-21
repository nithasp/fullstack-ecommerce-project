import { NewUser } from '../../types/user.types';
import { UserRepository } from '../../repositories/user.repository';

const repository = new UserRepository();

describe('User Repository', () => {
  const testUser: NewUser = {
    firstName: 'John',
    lastName: 'Doe',
    username: 'johndoe_' + Date.now(),
    password: 'password123',
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

  it('should have an authenticate method', () => {
    expect(repository.authenticate).toBeDefined();
  });

  it('create method should add a user', async () => {
    const result = await repository.create(testUser);
    expect(result.firstName).toBe(testUser.firstName);
    expect(result.lastName).toBe(testUser.lastName);
    expect(result.username).toBe(testUser.username);
  });

  it('create method should not return a password field at all', async () => {
    const result = await repository.create({ ...testUser, username: 'nopassword_' + Date.now() });
    expect(Object.keys(result)).not.toContain('password');
  });

  it('index method should return a list of users', async () => {
    const result = await repository.index();
    expect(result.length).toBeGreaterThan(0);
  });

  it('show method should return the correct user', async () => {
    const users = await repository.index();
    const result = await repository.show(users[0].id);
    expect(result?.username).toBe(users[0].username);
  });

  it('show method should return null for a missing user', async () => {
    expect(await repository.show(999999)).toBeNull();
  });

  it('authenticate method should return the user when credentials are correct', async () => {
    const result = await repository.authenticate(testUser.username, testUser.password);
    expect(result).not.toBeNull();
    if (result) {
      expect(result.username).toBe(testUser.username);
      expect(Object.keys(result)).not.toContain('password');
    }
  });

  it('authenticate method should return null when credentials are incorrect', async () => {
    const result = await repository.authenticate(testUser.username, 'wrongpassword');
    expect(result).toBeNull();
  });

  it('update method should update user information', async () => {
    const users = await repository.index();
    const userId = users[0].id;
    const result = await repository.update(userId, { firstName: 'Jane' });
    expect(result?.firstName).toBe('Jane');
  });

  it('update method with no fields should return the user unchanged', async () => {
    const users = await repository.index();
    const result = await repository.update(users[0].id, {});
    expect(result?.username).toBe(users[0].username);
  });

  it('update method should hash a new password so only the new one signs in', async () => {
    const created = await repository.create({ ...testUser, username: 'rehash_' + Date.now() });
    await repository.update(created.id, { password: 'brand-new-password' });
    expect(await repository.authenticate(created.username, testUser.password)).toBeNull();
    expect(await repository.authenticate(created.username, 'brand-new-password')).not.toBeNull();
  });

  it('delete method should remove the user', async () => {
    const users = await repository.index();
    const lastUser = users[users.length - 1];
    const result = await repository.delete(lastUser.id);
    expect(result?.id).toBe(lastUser.id);
    const remaining = await repository.index();
    const found = remaining.find((u) => u.id === lastUser.id);
    expect(found).toBeUndefined();
  });
});
