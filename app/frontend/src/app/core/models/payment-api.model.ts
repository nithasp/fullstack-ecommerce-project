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
  paymentProvider?: string | null;
  paymentMethod?: string | null;
}

export interface ConfirmPaymentResponse {
  order: PaymentOrder;
  paymentStatus: 'paid' | 'processing';
}

// ─── Omise (Thai local payment methods) ──────────────────────────────────────

export type OmiseMethodId = 'truemoney' | 'rabbit_linepay' | 'shopeepay' | 'banking' | 'installment';

export interface OmiseBankingOption {
  /** Omise source type, e.g. 'mobile_banking_scb'. */
  sourceType: string;
  name: string;
}

export interface OmiseInstallmentOption {
  /** Issuer code, e.g. 'kbank'. */
  bank: string;
  name: string;
  /** Available terms in months. */
  terms: number[];
}

/** Which Omise methods are enabled on the connected account. */
export interface OmiseMethodsAvailability {
  truemoney: { available: boolean; requiresPhone: boolean };
  rabbit_linepay: { available: boolean };
  shopeepay: { available: boolean };
  banking: { available: boolean; banks: OmiseBankingOption[] };
  installment: { available: boolean; banks: OmiseInstallmentOption[] };
}

export interface OmiseConfig {
  currency: string;
  methods: OmiseMethodsAvailability;
}

export interface CreateOmiseChargePayload {
  cartItemIds: number[];
  discountCode?: string;
  method: OmiseMethodId;
  /** TrueMoney Wallet account phone number (phone flow only). */
  phoneNumber?: string;
  /** Banking: chosen source type from OmiseConfig. */
  bankSourceType?: string;
  /** Installments: issuer code + term in months. */
  installmentBank?: string;
  installmentTerm?: number;
  /** window.location.origin — the backend builds the return URL from it. */
  returnOrigin: string;
}

/** Returned by the backend when an Omise checkout starts. */
export interface OmiseChargeSession {
  orderId: number;
  chargeId: string;
  /** Wallet/bank authorization page to redirect the customer to. */
  authorizeUri: string | null;
  amount: number;
  currency: string;
}

export interface OmiseConfirmResponse {
  order: PaymentOrder;
  paymentStatus: 'paid' | 'pending' | 'failed';
  reason?: string;
}
