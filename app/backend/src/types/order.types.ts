export interface Order {
  id?: number;
  userId: number;
  status: string;
  paymentStatus?: string;
  totalCents?: number | null;
  currency?: string | null;
  /** 'stripe' | 'omise' for orders created through the payment flow. */
  paymentProvider?: string | null;
  /** Provider-specific method, e.g. 'card', 'truemoney', 'installment'. */
  paymentMethod?: string | null;
  /** Stripe PaymentIntent id or Omise charge id. */
  paymentIntentId?: string | null;
}

/** Reference to a provider payment left behind by an abandoned checkout order. */
export interface AbandonedPaymentRef {
  provider: string | null;
  paymentRef: string | null;
}

export interface OrderProduct {
  id?: number;
  orderId: number;
  productId: number;
  quantity: number;
}

export interface RecentPurchase {
  productId: number;
  name: string;
  price: number;
  category: string | null;
  image: string | null;
  description: string | null;
  quantity: number;
  orderId: number;
}
