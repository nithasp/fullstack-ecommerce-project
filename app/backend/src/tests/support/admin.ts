import { UserStore } from '../../models/user';
import { TestAdmin, TestRequest } from '../../types/test.types';

const userStore = new UserStore();

/**
 * Creates an admin account directly through the model (the same path `npm run seed:admin` uses —
 * the public API deliberately offers no way to self-register as admin) and logs it in.
 */
export async function createAdmin(request: TestRequest, prefix = 'admin'): Promise<TestAdmin> {
  const username = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const password = 'adminpass12345';

  await userStore.create({ username, password, firstName: 'Admin', lastName: 'User', role: 'admin' });

  const res = await request.post('/auth/login').send({ username, password }).expect(200);
  return {
    userId: res.body.data.user.id,
    username,
    password,
    token: res.body.data.accessToken,
    refreshToken: res.body.data.refreshToken,
  };
}
