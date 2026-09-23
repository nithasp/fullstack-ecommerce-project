import bcrypt from 'bcrypt';
import { config } from '../../config';
import { CURRENT_PASSWORD_VERSION, hashPassword, verifyPassword } from '../../services/password.service';

describe('Password hashing', () => {
  it('stores a bcrypt hash, never the password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash.startsWith('$2')).toBe(true);
    expect(hash).not.toContain('correct horse');
  });

  it('accepts the right password and refuses a wrong one', async () => {
    const hash = await hashPassword('right-password-1');
    expect(await verifyPassword('right-password-1', hash, CURRENT_PASSWORD_VERSION)).toBe(true);
    expect(await verifyPassword('wrong-password-1', hash, CURRENT_PASSWORD_VERSION)).toBe(false);
  });

  it('keeps the pepper in play for a password longer than 72 bytes', async () => {
    const long = 'a'.repeat(200);
    const hash = await hashPassword(long);

    expect(await verifyPassword(long, hash, CURRENT_PASSWORD_VERSION)).toBe(true);
    expect(await verifyPassword('a'.repeat(199), hash, CURRENT_PASSWORD_VERSION)).toBe(false);
  });

  it('still checks a password saved under the old scheme', async () => {
    const legacyPepper = config.legacyPasswordPepper;
    if (!legacyPepper) {
      pending('BCRYPT_PASSWORD is not set, so there is no old scheme to check');
      return;
    }

    const legacyHash = await bcrypt.hash('old-password-1' + legacyPepper, config.saltRounds);
    expect(await verifyPassword('old-password-1', legacyHash, 1)).toBe(true);
    expect(await verifyPassword('other-password', legacyHash, 1)).toBe(false);
  });
});
