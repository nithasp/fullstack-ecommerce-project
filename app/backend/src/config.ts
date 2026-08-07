import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production' || process.env.ENV === 'production';

if (!process.env.TOKEN_SECRET) {
  if (isProduction) {
    throw new Error('[config] TOKEN_SECRET must be set as an environment variable in production.');
  }
  console.warn('[config] TOKEN_SECRET is not set — using insecure default. Set it in .env for production.');
}

export const config = {
  tokenSecret: process.env.TOKEN_SECRET || 'default-secret-for-dev',
  accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || '15m',
  refreshTokenExpiryMs: 7 * 24 * 60 * 60 * 1000,
  allowedOrigins: (process.env.ALLOWED_ORIGIN || 'http://localhost:4200')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  port: parseInt(process.env.PORT || '3000', 10),
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  stripeCurrency: (process.env.STRIPE_CURRENCY || 'usd').toLowerCase(),
  omiseSecretKey: process.env.OMISE_SECRET_KEY || '',
  omisePublicKey: process.env.OMISE_PUBLIC_KEY || '',
  // Omise accounts settle in their registration country's currency (THB for Thailand).
  omiseCurrency: (process.env.OMISE_CURRENCY || 'thb').toLowerCase(),
};
