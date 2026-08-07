import Stripe from 'stripe';
import { config } from '../config';
import { AppError } from './response';

let stripeClient: Stripe | null = null;

/** Lazily create the Stripe client so the server can boot without keys (payment routes will 503). */
export function getStripe(): Stripe {
  if (!config.stripeSecretKey) {
    throw new AppError('Payments are not configured on this server. Set STRIPE_SECRET_KEY.', 503);
  }
  if (!stripeClient) {
    stripeClient = new Stripe(config.stripeSecretKey);
  }
  return stripeClient;
}

/** Map Stripe SDK errors to the app's error shape without leaking internals. */
export function toAppError(err: unknown): AppError {
  if (err instanceof Stripe.errors.StripeError) {
    const status = err.type === 'StripeInvalidRequestError' ? 400 : 502;
    return new AppError(err.message || 'Payment provider error.', status);
  }
  return err instanceof AppError ? err : new AppError('Payment provider is unavailable. Please try again.', 502);
}
