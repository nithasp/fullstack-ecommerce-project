export interface PaymentConfig {
  publishableKey: string;
  currency: string;
}

export interface CreatePaymentIntentPayload {
  cartItemIds: number[];
  discountCode?: string;
}

/** Returned by the backend when a card checkout starts. */
export interface PaymentIntentSession {
  clientSecret: string;
  paymentIntentId: string;
  orderId: number;
  /** Total in the smallest currency unit (e.g. cents). Priced server-side. */
  amount: number;
  currency: string;
}

export interface PaymentOrder {
  id: number;
  userId: number;
  status: string;
  paymentStatus?: string;
  totalCents?: number | null;
  currency?: string | null;
}

export interface ConfirmPaymentResponse {
  order: PaymentOrder;
  paymentStatus: 'paid' | 'processing';
}
