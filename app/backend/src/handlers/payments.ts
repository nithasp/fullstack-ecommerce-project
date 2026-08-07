import express, { Application, Request, Response } from 'express';
import Stripe from 'stripe';
import type { Charges } from 'omise';
import { CartStore } from '../models/cart';
import { OrderStore } from '../models/order';
import { verifyAuthToken } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError, sendSuccess } from '../utils/response';
import { requirePositiveInt, requireString } from '../utils/validate';
import { getStripe, toAppError } from '../utils/stripe';
import { getOmise, getCapability, toOmiseAppError } from '../utils/omise';
import { config } from '../config';

const cartStore = new CartStore();
const orderStore = new OrderStore();

/** Server-side copy of the discount codes offered in the cart UI. */
const DISCOUNT_CODES: Record<string, number> = {
  '10%OFF': 0.1,
  'SAVE20': 0.2,
};

/**
 * Price the selected cart items from the database (never trusting client
 * amounts) and apply an optional discount code. Shared by every provider.
 */
async function priceCartSelection(
  userId: number,
  body: { cartItemIds?: unknown; discountCode?: unknown }
): Promise<{ totalCents: number; orderItems: { productId: number; quantity: number }[] }> {
  const cartItemIds = body.cartItemIds;
  if (!Array.isArray(cartItemIds) || cartItemIds.length === 0)
    throw new AppError('cartItemIds must be a non-empty array', 400);

  const uniqueIds = [...new Set(cartItemIds.map((id) => requirePositiveInt(id, 'cart item id')))];

  let discount = 0;
  if (body.discountCode !== undefined && body.discountCode !== null && body.discountCode !== '') {
    const code = requireString(body.discountCode, 'discountCode').toUpperCase();
    if (DISCOUNT_CODES[code] === undefined) throw new AppError('Invalid discount code.', 400);
    discount = DISCOUNT_CODES[code];
  }

  const items = await cartStore.getByIds(uniqueIds, userId);
  if (items.length !== uniqueIds.length)
    throw new AppError('Some items are no longer in your cart. Please refresh and try again.', 400);

  let totalCents = 0;
  const orderItems: { productId: number; quantity: number }[] = [];
  for (const item of items) {
    const typePrice = (item.selectedType as { price?: unknown } | null)?.price;
    const unitCents = Math.round(Number(typePrice ?? item.productPrice) * 100);
    if (!Number.isFinite(unitCents) || unitCents <= 0)
      throw new AppError(`Unable to determine a valid price for "${item.productName ?? 'a product'}".`, 400);

    totalCents += unitCents * item.quantity;
    orderItems.push({ productId: item.productId, quantity: item.quantity });
  }
  totalCents = Math.round(totalCents * (1 - discount));

  return { totalCents, orderItems };
}

/**
 * Drop the user's abandoned checkout orders and cancel their Stripe
 * PaymentIntents (best effort). Omise redirect charges cannot be cancelled
 * through the API — they expire on Omise's side on their own.
 */
async function cleanupAbandonedOrders(userId: number): Promise<void> {
  const stale = await orderStore.deleteAbandonedPaymentOrders(userId);
  const stripeRefs = stale
    .filter((s) => s.provider !== 'omise' && s.paymentRef)
    .map((s) => s.paymentRef as string);
  if (stripeRefs.length === 0 || !config.stripeSecretKey) return;

  const stripe = getStripe();
  await Promise.all(stripeRefs.map((id) => stripe.paymentIntents.cancel(id).catch(() => undefined)));
}

// ─── Stripe (cards) ───────────────────────────────────────────────────────────

/** Publishable key for the frontend to initialize Stripe.js. */
const getPaymentConfig = asyncHandler(async (_req: Request, res: Response) => {
  if (!config.stripePublishableKey)
    throw new AppError('Payments are not configured on this server. Set STRIPE_PUBLISHABLE_KEY.', 503);

  sendSuccess(res, { publishableKey: config.stripePublishableKey, currency: config.stripeCurrency }, 'Payment config fetched.');
});

/**
 * Start a card checkout: creates a pending order and a Stripe PaymentIntent,
 * and returns the client secret used by Stripe Elements.
 */
const createPaymentIntent = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  const { totalCents, orderItems } = await priceCartSelection(userId, req.body);

  const stripe = getStripe();
  await cleanupAbandonedOrders(userId);

  const order = await orderStore.createPendingPaymentOrder(
    userId, orderItems, totalCents, config.stripeCurrency, 'stripe', 'card'
  );

  let intent: Stripe.PaymentIntent;
  try {
    intent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: config.stripeCurrency,
      payment_method_types: ['card'],
      description: `Storefront order #${order.id}`,
      metadata: { orderId: String(order.id), userId: String(userId) },
    });
  } catch (err) {
    await orderStore.delete(order.id!).catch(() => undefined);
    throw toAppError(err);
  }

  await orderStore.setPaymentIntent(order.id!, intent.id);

  sendSuccess(
    res,
    {
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      orderId: order.id,
      amount: totalCents,
      currency: config.stripeCurrency,
    },
    'Payment intent created.',
    201
  );
});

/**
 * Verify a payment against Stripe and finalize the order. Idempotent fallback
 * for local/dev setups where the webhook is not configured.
 */
const confirmPayment = asyncHandler(async (req: Request, res: Response) => {
  const paymentIntentId = requireString(req.body.paymentIntentId, 'paymentIntentId');

  const order = await orderStore.findByPaymentIntentId(paymentIntentId);
  if (!order) throw new AppError('No order found for this payment.', 404);
  if (order.userId !== req.user!.userId) throw new AppError('This payment belongs to another account.', 404);

  if (order.paymentStatus === 'paid') {
    sendSuccess(res, { order, paymentStatus: 'paid' }, 'Payment already confirmed.');
    return;
  }

  let intent: Stripe.PaymentIntent;
  try {
    intent = await getStripe().paymentIntents.retrieve(paymentIntentId);
  } catch (err) {
    throw toAppError(err);
  }

  if (intent.status === 'succeeded') {
    const paidOrder = await orderStore.markPaidByPaymentIntent(paymentIntentId);
    sendSuccess(res, { order: paidOrder, paymentStatus: 'paid' }, 'Payment confirmed. Order complete.');
  } else if (intent.status === 'processing') {
    sendSuccess(res, { order, paymentStatus: 'processing' }, 'Payment is still processing.');
  } else {
    throw new AppError('Payment has not been completed. Please try again.', 402);
  }
});

/**
 * Stripe webhook — source of truth for payment outcomes. Mounted before
 * express.json() because signature verification needs the raw body.
 */
const stripeWebhook = async (req: Request, res: Response): Promise<void> => {
  const signature = req.headers['stripe-signature'];
  if (!config.stripeWebhookSecret || !signature) {
    res.status(400).json({ error: 'Stripe webhook is not configured.' });
    return;
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, signature, config.stripeWebhookSecret);
  } catch {
    res.status(400).json({ error: 'Webhook signature verification failed.' });
    return;
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await orderStore.markPaidByPaymentIntent((event.data.object as Stripe.PaymentIntent).id);
        break;
      case 'payment_intent.payment_failed':
        await orderStore.markPaymentFailed((event.data.object as Stripe.PaymentIntent).id);
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error('[stripe webhook] failed to process event:', err);
    res.status(500).json({ error: 'Webhook processing failed.' });
  }
};

// ─── Omise (Thai local payment methods) ───────────────────────────────────────

/** Omise banking source types offered by this store, with display labels. */
const OMISE_BANKING_LABELS: Record<string, string> = {
  mobile_banking_kbank: 'KBank — K PLUS',
  mobile_banking_scb: 'SCB — SCB EASY',
  mobile_banking_bay: 'Krungsri — KMA',
  mobile_banking_bbl: 'Bangkok Bank — Bualuang mBanking',
  mobile_banking_ktb: 'Krungthai — Krungthai NEXT',
  internet_banking_bay: 'Krungsri — Internet Banking',
  internet_banking_bbl: 'Bangkok Bank — Internet Banking',
};

/** Installment issuers Omise supports in Thailand, with display labels. */
const OMISE_INSTALLMENT_LABELS: Record<string, string> = {
  kbank: 'Kasikornbank (KBank)',
  bay: 'Krungsri',
  first_choice: 'Krungsri First Choice',
  bbl: 'Bangkok Bank',
  ktc: 'KTC',
  scb: 'SCB',
  ttb: 'TTB',
  uob: 'UOB',
};

type OmiseMethodId = 'truemoney' | 'rabbit_linepay' | 'shopeepay' | 'banking' | 'installment';
const OMISE_METHOD_IDS: ReadonlySet<string> = new Set(['truemoney', 'rabbit_linepay', 'shopeepay', 'banking', 'installment']);

/**
 * Which of the store's Omise methods are enabled on the connected account,
 * with the banks/terms to render. Driven by the Omise capability API, so the
 * frontend only shows what can actually charge.
 */
const getOmiseConfig = asyncHandler(async (_req: Request, res: Response) => {
  const client = getOmise();
  const capability = await getCapability(client);
  const available = new Set(capability.payment_methods.map((m) => m.name));

  const bankingBanks = Object.entries(OMISE_BANKING_LABELS)
    .filter(([sourceType]) => available.has(sourceType))
    .map(([sourceType, name]) => ({ sourceType, name }));

  const installmentBanks = capability.payment_methods
    .filter((m) => /^installment_(?!wlb_)/.test(m.name) && OMISE_INSTALLMENT_LABELS[m.name.replace('installment_', '')])
    .map((m) => {
      const bank = m.name.replace('installment_', '');
      return { bank, name: OMISE_INSTALLMENT_LABELS[bank], terms: m.installment_terms ?? [] };
    })
    .filter((b) => b.terms.length > 0);

  sendSuccess(
    res,
    {
      currency: config.omiseCurrency,
      methods: {
        truemoney: {
          available: available.has('truemoney') || available.has('truemoney_jumpapp'),
          requiresPhone: available.has('truemoney'),
        },
        rabbit_linepay: { available: available.has('rabbit_linepay') },
        shopeepay: { available: available.has('shopeepay') || available.has('shopeepay_jumpapp') },
        banking: { available: bankingBanks.length > 0, banks: bankingBanks },
        installment: { available: installmentBanks.length > 0, banks: installmentBanks },
      },
    },
    'Omise payment config fetched.'
  );
});

/**
 * Start an Omise checkout for a redirect-based payment method. Creates a
 * pending order, an Omise source + charge, and returns the authorize URI the
 * customer must be sent to (wallet/bank authorization page).
 */
const createOmiseCharge = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  const method = requireString(req.body.method, 'method') as OmiseMethodId;
  if (!OMISE_METHOD_IDS.has(method)) throw new AppError('Unsupported payment method.', 400);

  const returnOrigin = requireString(req.body.returnOrigin, 'returnOrigin');
  if (!config.allowedOrigins.includes(returnOrigin))
    throw new AppError('returnOrigin is not an allowed origin.', 400);

  const client = getOmise();
  const capability = await getCapability(client);
  const available = new Set(capability.payment_methods.map((m) => m.name));
  const notEnabled = (label: string) =>
    new AppError(`${label} is not enabled on this Omise account. Enable it in the Omise dashboard.`, 400);

  let sourceType: string;
  const sourceExtra: { phone_number?: string; installment_term?: number } = {};

  switch (method) {
    case 'truemoney': {
      if (available.has('truemoney')) {
        sourceType = 'truemoney';
        const phone = requireString(req.body.phoneNumber, 'phoneNumber');
        if (!/^0\d{9}$/.test(phone))
          throw new AppError('phoneNumber must be a 10-digit Thai mobile number, e.g. 0812345678.', 400);
        sourceExtra.phone_number = phone;
      } else if (available.has('truemoney_jumpapp')) {
        sourceType = 'truemoney_jumpapp';
      } else {
        throw notEnabled('TrueMoney');
      }
      break;
    }
    case 'rabbit_linepay': {
      if (!available.has('rabbit_linepay')) throw notEnabled('Rabbit LINE Pay');
      sourceType = 'rabbit_linepay';
      break;
    }
    case 'shopeepay': {
      if (available.has('shopeepay')) sourceType = 'shopeepay';
      else if (available.has('shopeepay_jumpapp')) sourceType = 'shopeepay_jumpapp';
      else throw notEnabled('ShopeePay');
      break;
    }
    case 'banking': {
      const bankSourceType = requireString(req.body.bankSourceType, 'bankSourceType');
      if (!OMISE_BANKING_LABELS[bankSourceType] || !available.has(bankSourceType))
        throw new AppError('This bank is not enabled for mobile/internet banking payments.', 400);
      sourceType = bankSourceType;
      break;
    }
    case 'installment': {
      const bank = requireString(req.body.installmentBank, 'installmentBank');
      if (!OMISE_INSTALLMENT_LABELS[bank]) throw new AppError('installmentBank is invalid.', 400);
      sourceType = `installment_${bank}`;
      const capMethod = capability.payment_methods.find((m) => m.name === sourceType);
      if (!capMethod) throw notEnabled('Installment payment with this bank');

      const term = requirePositiveInt(req.body.installmentTerm, 'installmentTerm');
      const terms = capMethod.installment_terms ?? [];
      if (terms.length > 0 && !terms.includes(term))
        throw new AppError(`installmentTerm must be one of: ${terms.join(', ')} months.`, 400);
      sourceExtra.installment_term = term;
      break;
    }
  }

  // totalCents is the amount in the smallest currency unit (satang for THB).
  const { totalCents, orderItems } = await priceCartSelection(userId, req.body);

  await cleanupAbandonedOrders(userId);

  const order = await orderStore.createPendingPaymentOrder(
    userId, orderItems, totalCents, config.omiseCurrency, 'omise', method
  );

  let charge: Charges.ICharge;
  try {
    const source = await client.sources.create({
      type: sourceType,
      amount: totalCents,
      currency: config.omiseCurrency,
      ...sourceExtra,
    });
    charge = await client.charges.create({
      amount: totalCents,
      currency: config.omiseCurrency,
      source: source.id,
      return_uri: `${returnOrigin}/cart/confirmation?provider=omise&orderId=${order.id}`,
      description: `Storefront order #${order.id}`,
      metadata: { orderId: String(order.id), userId: String(userId) },
    });
  } catch (err) {
    await orderStore.delete(order.id!).catch(() => undefined);
    throw toOmiseAppError(err);
  }

  await orderStore.setPaymentIntent(order.id!, charge.id);

  sendSuccess(
    res,
    {
      orderId: order.id,
      chargeId: charge.id,
      authorizeUri: charge.authorize_uri || null,
      amount: totalCents,
      currency: config.omiseCurrency,
    },
    'Omise charge created.',
    201
  );
});

/** Shared mapping from a (verified) Omise charge to our order state. */
async function applyOmiseChargeOutcome(charge: Charges.ICharge): Promise<'paid' | 'pending' | 'failed'> {
  if (charge.status === 'successful' && charge.paid) {
    await orderStore.markPaidByPaymentIntent(charge.id);
    return 'paid';
  }
  if (charge.status === 'failed' || charge.status === 'expired' || charge.status === 'reversed') {
    await orderStore.markPaymentFailed(charge.id);
    return 'failed';
  }
  return 'pending';
}

/**
 * Verify an Omise payment and finalize the order. Called by the confirmation
 * page after the customer returns from the wallet/bank authorization page;
 * also the fallback for local/dev setups where the webhook can't reach us.
 */
const confirmOmisePayment = asyncHandler(async (req: Request, res: Response) => {
  const orderId = requirePositiveInt(req.body.orderId, 'orderId');

  const order = await orderStore.show(orderId);
  if (!order || order.userId !== req.user!.userId) throw new AppError('No order found for this payment.', 404);
  if (order.paymentProvider !== 'omise' || !order.paymentIntentId)
    throw new AppError('This order is not an Omise payment.', 400);

  if (order.paymentStatus === 'paid') {
    sendSuccess(res, { order, paymentStatus: 'paid' }, 'Payment already confirmed.');
    return;
  }

  let charge: Charges.ICharge;
  try {
    charge = await getOmise().charges.retrieve(order.paymentIntentId);
  } catch (err) {
    throw toOmiseAppError(err);
  }

  const outcome = await applyOmiseChargeOutcome(charge);
  const freshOrder = (await orderStore.show(orderId)) ?? order;

  if (outcome === 'paid') {
    sendSuccess(res, { order: freshOrder, paymentStatus: 'paid' }, 'Payment confirmed. Order complete.');
  } else if (outcome === 'pending') {
    sendSuccess(res, { order: freshOrder, paymentStatus: 'pending' }, 'Payment is still pending.');
  } else {
    const reason =
      charge.failure_message ||
      (charge.status === 'expired'
        ? 'The payment expired before it was completed.'
        : 'The payment was not completed.');
    sendSuccess(res, { order: freshOrder, paymentStatus: 'failed', reason }, 'Payment failed.');
  }
});

/**
 * Omise webhook — source of truth for payment outcomes. Omise events carry no
 * signature, so the payload is never trusted: the charge is re-fetched from
 * the Omise API and only that verified object drives order state.
 */
const omiseWebhook = async (req: Request, res: Response): Promise<void> => {
  const event = req.body as { object?: string; key?: string; data?: { object?: string; id?: string } };

  const isChargeEvent =
    event?.object === 'event' &&
    typeof event.key === 'string' &&
    event.key.startsWith('charge.') &&
    event.data?.object === 'charge' &&
    typeof event.data.id === 'string';

  if (!isChargeEvent) {
    res.json({ received: true });
    return;
  }

  try {
    const charge = await getOmise().charges.retrieve(event.data!.id!);
    const outcome = await applyOmiseChargeOutcome(charge);
    if (outcome === 'paid') {
      const order = await orderStore.findByPaymentIntentId(charge.id);
      if (!order) console.error(`[omise webhook] paid charge ${charge.id} has no matching order`);
    }
    res.json({ received: true });
  } catch (err) {
    console.error('[omise webhook] failed to process event:', err);
    res.status(500).json({ error: 'Webhook processing failed.' });
  }
};

// ─── Routes ───────────────────────────────────────────────────────────────────

export const stripeWebhookRoute = (app: Application) => {
  app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhook);
};

/** Needs the JSON-parsed body — mount after express.json(). */
export const omiseWebhookRoute = (app: Application) => {
  app.post('/webhooks/omise', omiseWebhook);
};

const paymentRoutes = (app: Application) => {
  app.get('/payments/config', getPaymentConfig);
  app.post('/payments/create-intent', verifyAuthToken, createPaymentIntent);
  app.post('/payments/confirm', verifyAuthToken, confirmPayment);
  app.get('/payments/omise/config', getOmiseConfig);
  app.post('/payments/omise/create-charge', verifyAuthToken, createOmiseCharge);
  app.post('/payments/omise/confirm', verifyAuthToken, confirmOmisePayment);
};

export default paymentRoutes;
