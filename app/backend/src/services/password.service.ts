import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { config } from '../config';
import { logger } from '../logger';

export const CURRENT_PASSWORD_VERSION = 2;

// bcrypt reads only the first 72 bytes of its input, which would drop the pepper of a long
// password; folding both into a fixed-length HMAC first keeps the pepper in play (OWASP password storage)
const peppered = (password: string, pepper: string): string =>
  crypto.createHmac('sha256', pepper).update(password, 'utf8').digest('base64');

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(peppered(password, config.passwordPepper), config.saltRounds);
}

export async function verifyPassword(password: string, hash: string, version: number): Promise<boolean> {
  if (version >= CURRENT_PASSWORD_VERSION) {
    return bcrypt.compare(peppered(password, config.passwordPepper), hash);
  }
  if (!config.legacyPasswordPepper) {
    logger.warn('a password saved with the old scheme cannot be checked because BCRYPT_PASSWORD is not set');
    return false;
  }
  return bcrypt.compare(password + config.legacyPasswordPepper, hash);
}

const DUMMY_HASH = bcrypt.hashSync(peppered('no-such-account', config.passwordPepper), config.saltRounds);

// An unknown username costs the same as a real one, so response time does not tell an attacker
// which accounts exist (OWASP API2)
export async function spendVerifyTime(): Promise<void> {
  await bcrypt.compare('no-such-account', DUMMY_HASH);
}
