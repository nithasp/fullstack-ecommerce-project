import express, { Application, Request, Response } from 'express';
import Stripe from 'stripe';
import { CartStore } from '../models/cart';
import { OrderStore } from '../models/order';
import { verifyAuthToken } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError, sendSuccess } from '../utils/response';
import { requirePositiveInt, requireString } from '../utils/validate';
import { getStripe, toAppError } from '../utils/stripe';
import { config } from '../config';

const cartStore = new CartStore();
const orderStore = new OrderStore();

/** Server-side copy of the discount codes offered in the cart UI. */
const DISCOUNT_CODES: Record<string, number> = {
  '10%OFF': 0.1,
  'SAVE20': 0.2,
};

/** Publishable key for the frontend to initialize Stripe.js. */
const getPaymentConfig = asyncHandler(async (_req: Request, res: Response) => {
  if (!config.stripePublishableKey)
    throw new AppError('Payments are not configured on this server. Set STRIPE_PUBLISHABLE_KEY.', 503);

  sendSuccess(res, { publishableKey: config.stripePublishableKey, currency: config.stripeCurrency }, 'Payment config fetched.');
});

/**
 * Start a card checkout: prices the selected cart items from the database
 * (never trusting client amounts), creates a pending order and a Stripe
 * PaymentIntent, and returns the client secret used by Stripe Elements.
 */
const createPaymentIntent = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  const cartItemIds: unknown = req.body.cartItemIds;
  if (!Array.isArray(cartItemIds) || cartItemIds.length === 0)
    throw new AppError('cartItemIds must be a non-empty array', 400);

  const uniqueIds = [...new Set(cartItemIds.map((id) => requirePositiveInt(id, 'cart item id')))];

  let discount = 0;
  if (req.body.discountCode !== undefined && req.body.discountCode !== null && req.body.discountCode !== '') {
    const code = requireString(req.body.discountCode, 'discountCode').toUpperCase();
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

  const stripe = getStripe();

  // Drop this user's abandoned checkout orders and cancel their PaymentIntents (best effort).
  const staleIntentIds = await orderStore.deleteAbandonedPaymentOrders(userId);
  await Promise.all(staleIntentIds.map((id) => stripe.paymentIntents.cancel(id).catch(() => undefined)));

  const order = await orderStore.createPendingPaymentOrder(userId, orderItems, totalCents, config.stripeCurrency);

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

export const stripeWebhookRoute = (app: Application) => {
  app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhook);
};

const paymentRoutes = (app: Application) => {
  app.get('/payments/config', getPaymentConfig);
  app.post('/payments/create-intent', verifyAuthToken, createPaymentIntent);
  app.post('/payments/confirm', verifyAuthToken, confirmPayment);
};

export default paymentRoutes;
