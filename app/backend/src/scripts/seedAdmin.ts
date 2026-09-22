import dotenv from 'dotenv';
dotenv.config();

import pool from '../database';
import { UserRepository } from '../repositories/user.repository';

const MIN_PASSWORD_LENGTH = 12;

async function main(): Promise<void> {
  const { ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_FIRST_NAME, ADMIN_LAST_NAME } = process.env;

  if (!ADMIN_USERNAME?.trim() || !ADMIN_PASSWORD)
    throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be set (in .env or the environment).');
  if (ADMIN_PASSWORD.length < MIN_PASSWORD_LENGTH)
    throw new Error(`ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`);

  const username = ADMIN_USERNAME.trim();
  const users = new UserRepository();
  const existing = await users.findByUsername(username);

  if (existing) {
    if (existing.role === 'admin') {
      console.log(`[seed:admin] "${username}" (id ${existing.id}) is already an admin. Nothing to do.`);
      return;
    }
    await users.updateRole(existing.id, 'admin');
    console.log(`[seed:admin] Promoted existing user "${username}" (id ${existing.id}) to admin.`);
    return;
  }

  const created = await users.create({
    username,
    password: ADMIN_PASSWORD,
    firstName: ADMIN_FIRST_NAME?.trim() || 'Store',
    lastName: ADMIN_LAST_NAME?.trim() || 'Admin',
    role: 'admin',
  });
  console.log(`[seed:admin] Created admin "${username}" (id ${created.id}).`);
}

main()
  .catch((err: Error) => {
    console.error(`[seed:admin] ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
