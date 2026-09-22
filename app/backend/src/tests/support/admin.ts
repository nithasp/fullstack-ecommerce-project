import { UserRepository } from '../../repositories/user.repository';
import { TestAdmin, TestRequest } from '../../types/test.types';

const users = new UserRepository();

export async function createAdmin(request: TestRequest, prefix = 'admin'): Promise<TestAdmin> {
  const username = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const password = 'adminpass12345';

  await users.create({ username, password, firstName: 'Admin', lastName: 'User', role: 'admin' });

  const res = await request.post('/api/v1/auth/login').send({ username, password }).expect(200);
  return {
    userId: res.body.data.user.id,
    username,
    password,
    token: res.body.data.accessToken,
    refreshToken: res.body.data.refreshToken,
  };
}
