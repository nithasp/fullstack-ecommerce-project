import Omise from 'omise';
import type { Capability } from 'omise';
import { config } from '../config';
import { AppError } from './response';

export type OmiseClient = ReturnType<typeof Omise>;

let omiseClient: OmiseClient | null = null;

/** Lazily create the Omise client so the server can boot without keys (Omise routes will 503). */
export function getOmise(): OmiseClient {
  if (!config.omiseSecretKey) {
    throw new AppError('Omise payments are not configured on this server. Set OMISE_SECRET_KEY.', 503);
  }
  if (!omiseClient) {
    // Pin the API version the omise-node 1.x resources are built against.
    omiseClient = Omise({ secretKey: config.omiseSecretKey, omiseVersion: '2019-05-29' });
  }
  return omiseClient;
}

/**
 * Map Omise API failures to the app's error shape. omise-node rejects with the
 * raw API error body ({ object: 'error', code, message }) on API errors.
 */
export function toOmiseAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (typeof err === 'object' && err !== null && (err as { object?: string }).object === 'error') {
    const apiError = err as { code?: string; message?: string };
    const clientFault = ['invalid_charge', 'invalid_source', 'used_source', 'bad_request'].includes(
      apiError.code ?? ''
    );
    return new AppError(apiError.message || 'Payment provider error.', clientFault ? 400 : 502);
  }
  return new AppError('Payment provider is unavailable. Please try again.', 502);
}

let capabilityCache: { fetchedAt: number; value: Capability.ICapability } | null = null;
const CAPABILITY_TTL_MS = 60_000;

/**
 * The account capability lists which payment methods (and installment terms)
 * are enabled on the Omise account. Cached briefly — it changes rarely.
 */
export async function getCapability(client: OmiseClient): Promise<Capability.ICapability> {
  if (capabilityCache && Date.now() - capabilityCache.fetchedAt < CAPABILITY_TTL_MS) {
    return capabilityCache.value;
  }
  try {
    const value = await client.capability.retrieve();
    capabilityCache = { fetchedAt: Date.now(), value };
    return value;
  } catch (err) {
    throw toOmiseAppError(err);
  }
}
