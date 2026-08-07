import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { PaymentApiService } from './payment-api.service';

/**
 * Loads Stripe.js once, using the publishable key served by the backend
 * (GET /payments/config), and caches the instance for the whole session.
 */
@Injectable({ providedIn: 'root' })
export class StripeService {
  private stripePromise: Promise<Stripe | null> | null = null;

  constructor(private paymentApi: PaymentApiService) {}

  getStripe(): Promise<Stripe | null> {
    if (!this.stripePromise) {
      this.stripePromise = firstValueFrom(this.paymentApi.getConfig())
        .then(config => loadStripe(config.publishableKey))
        .catch(err => {
          // Allow a retry on the next attempt instead of caching the failure.
          this.stripePromise = null;
          throw err;
        });
    }
    return this.stripePromise;
  }
}
