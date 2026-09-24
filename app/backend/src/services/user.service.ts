import { withTransaction } from '../database';
import { AuthSession } from '../types/auth.types';
import { RecentPurchase } from '../types/order.types';
import { Page, Pagination } from '../types/pagination.types';
import { UserServiceDeps } from '../types/service.types';
import { NewUser, ProfileUpdate, PublicUser, UserRole } from '../types/user.types';
import { AppError } from '../utils/errors';
import { pageOf } from '../utils/paging';
import { CURRENT_PASSWORD_VERSION, hashPassword, spendVerifyTime, verifyPassword } from './password.service';

const notFound = (id: number) => new AppError(`user with id ${id} not found`, 404, 'not_found');

const toPublicUser = (user: PublicUser): PublicUser => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  username: user.username,
  role: user.role,
});

export function createUserService({ users, orders, addresses, carts, tokens }: UserServiceDeps) {
  function findUser(id: number): Promise<PublicUser | null> {
    return users.show(id);
  }

  async function requireUser(id: number): Promise<PublicUser> {
    const user = await findUser(id);
    if (!user) throw notFound(id);
    return user;
  }

  // A new password ends every session of that account, so a stolen token cannot outlive the change
  async function setPassword(id: number, newPassword: string): Promise<void> {
    const hash = await hashPassword(newPassword);
    const updated = await users.updatePassword(id, hash, CURRENT_PASSWORD_VERSION);
    if (!updated) throw notFound(id);
    await tokens.revokeAllSessions(id);
  }

  return {
    findUser,
    requireUser,
    setPassword,

    listUsers(page: Pagination): Promise<Page<PublicUser>> {
      return pageOf(
        () => users.index(page),
        () => users.count(),
      );
    },

    async getUserWithPurchases(id: number): Promise<PublicUser & { recentPurchases: RecentPurchase[] }> {
      const user = await requireUser(id);
      return { ...user, recentPurchases: await orders.recentPurchases(id) };
    },

    async createUser(input: NewUser): Promise<PublicUser> {
      if (await users.findByUsername(input.username)) {
        throw new AppError('Username already exists', 409, 'conflict');
      }
      return users.create({
        firstName: input.firstName,
        lastName: input.lastName,
        username: input.username,
        role: input.role,
        passwordHash: await hashPassword(input.password),
        passwordVersion: CURRENT_PASSWORD_VERSION,
      });
    },

    async authenticate(username: string, password: string): Promise<PublicUser | null> {
      const stored = await users.findCredentials(username);
      if (!stored) {
        await spendVerifyTime();
        return null;
      }

      const matches = await verifyPassword(password, stored.passwordHash, stored.passwordVersion);
      if (!matches) return null;

      if (stored.passwordVersion < CURRENT_PASSWORD_VERSION) {
        await users.updatePassword(stored.id, await hashPassword(password), CURRENT_PASSWORD_VERSION);
      }
      return toPublicUser(stored);
    },

    async updateProfile(id: number, changes: ProfileUpdate): Promise<PublicUser> {
      const updated = await users.updateProfile(id, changes);
      if (!updated) throw notFound(id);
      return updated;
    },

    // Changing your own password takes the current one, so a stolen access token alone cannot lock
    // the owner out of the account (OWASP ASVS)
    async changeOwnPassword(
      id: number,
      currentPassword: string,
      newPassword: string,
    ): Promise<AuthSession & { refreshToken: string }> {
      const stored = await users.findCredentialsById(id);
      if (!stored) throw notFound(id);

      const matches = await verifyPassword(currentPassword, stored.passwordHash, stored.passwordVersion);
      if (!matches) throw new AppError('Current password is incorrect', 401, 'invalid_credentials');

      await setPassword(id, newPassword);

      const user = toPublicUser(stored);
      const { accessToken, refreshToken } = await tokens.issueSession(user);
      return { user, accessToken, refreshToken };
    },

    async changeRole(actingUserId: number, id: number, role: UserRole): Promise<PublicUser> {
      if (actingUserId === id) throw new AppError('You cannot change your own role', 400);
      const updated = await users.updateRole(id, role);
      if (!updated) throw notFound(id);
      await tokens.revokeAllSessions(id);
      return updated;
    },

    async closeAccount(id: number): Promise<PublicUser> {
      const closed = await withTransaction(async (tx) => {
        const user = await users.anonymise(id, tx);
        if (!user) return null;
        await addresses.deleteByUser(id, tx);
        await carts.clearByUser(id, tx);
        return user;
      });

      if (!closed) throw notFound(id);
      await tokens.revokeAllSessions(id);
      return closed;
    },
  };
}

export type UserService = ReturnType<typeof createUserService>;
