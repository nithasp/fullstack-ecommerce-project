import dotenv from 'dotenv';
dotenv.config();

const env = process.env.ENV ?? process.env.NODE_ENV ?? 'development';
const isProduction = env === 'production';
const isTest = env === 'test';

if (!process.env.TOKEN_SECRET) {
  if (isProduction) {
    throw new Error('[config] TOKEN_SECRET must be set as an environment variable in production.');
  }
  console.warn('[config] TOKEN_SECRET is not set — using insecure default. Set it in .env for production.');
}

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

/** Single source of truth for environment variables — no other module reads process.env. */
export const config = {
  env,
  isProduction,
  isTest,

  port: toInt(process.env.PORT, 3000),
  allowedOrigins: (process.env.ALLOWED_ORIGIN || 'http://localhost:4200')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  db: {
    /** When set (e.g. on hosted platforms), takes precedence over the discrete settings below. */
    url: process.env.DATABASE_URL,
    host: process.env.POSTGRES_HOST,
    port: toInt(process.env.POSTGRES_PORT, 5432),
    database: isTest ? process.env.POSTGRES_TEST_DB : process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  },

  bcrypt: {
    pepper: process.env.BCRYPT_PASSWORD ?? '',
    saltRounds: toInt(process.env.SALT_ROUNDS, 10),
  },

  jwt: {
    secret: process.env.TOKEN_SECRET || 'default-secret-for-dev',
    accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || '15m',
    refreshTokenExpiryMs: toInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS, 7) * 24 * 60 * 60 * 1000,
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    currency: (process.env.STRIPE_CURRENCY || 'usd').toLowerCase(),
  },

  omise: {
    secretKey: process.env.OMISE_SECRET_KEY || '',
    publicKey: process.env.OMISE_PUBLIC_KEY || '',
    // Omise accounts settle in their registration country's currency (THB for Thailand).
    currency: (process.env.OMISE_CURRENCY || 'thb').toLowerCase(),
  },
};
