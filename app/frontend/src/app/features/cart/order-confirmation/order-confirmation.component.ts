import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PaymentApiService } from '../../../core/services/payment/payment-api.service';
import { CartService } from '../../../core/services/cart/cart.service';

type ConfirmationState = 'success' | 'verifying' | 'pending' | 'failed';

@Component({
  selector: 'app-order-confirmation',
  templateUrl: './order-confirmation.component.html',
  styleUrl: './order-confirmation.component.scss'
})
export class OrderConfirmationComponent implements OnInit, OnDestroy {
  /** Set when arriving from the Stripe payment flow (passed via router state). */
  orderId: number | null = null;

  /** 'success' by default; Omise redirect returns start in 'verifying'. */
  state: ConfirmationState = 'success';
  failureReason = '';

  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private pollAttempts = 0;
  private readonly MAX_POLL_ATTEMPTS = 10;
  private readonly POLL_INTERVAL_MS = 3000;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private paymentApi: PaymentApiService,
    private cartService: CartService
  ) {
    const state = this.router.getCurrentNavigation()?.extras?.state ?? history.state;
    this.orderId = typeof state?.['orderId'] === 'number' ? state['orderId'] : null;
  }

  ngOnInit(): void {
    // Returning from an Omise wallet/bank authorization page:
    // /cart/confirmation?provider=omise&orderId=N — verify before celebrating.
    const params = this.route.snapshot.queryParamMap;
    const orderIdParam = Number(params.get('orderId'));
    if (params.get('provider') === 'omise' && Number.isInteger(orderIdParam) && orderIdParam > 0) {
      this.orderId = orderIdParam;
      this.state = 'verifying';
      this.verifyOmisePayment();
    }
  }

  ngOnDestroy(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);
  }

  private verifyOmisePayment(): void {
    if (!this.orderId) return;

    this.paymentApi.confirmOmisePayment(this.orderId).subscribe({
      next: (res) => {
        if (res.paymentStatus === 'paid') {
          this.state = 'success';
          // The backend removed the purchased items from the cart — re-sync it.
          this.cartService.fetchCart();
        } else if (res.paymentStatus === 'pending') {
          this.pollAttempts++;
          if (this.pollAttempts >= this.MAX_POLL_ATTEMPTS) {
            this.state = 'pending';
          } else {
            this.pollTimer = setTimeout(() => this.verifyOmisePayment(), this.POLL_INTERVAL_MS);
          }
        } else {
          this.failureReason = res.reason || 'The payment was not completed.';
          this.state = 'failed';
        }
      },
      error: (err) => {
        this.failureReason = err?.error?.message || 'We could not verify the payment. Please try again.';
        this.state = 'failed';
      },
    });
  }

  checkAgain(): void {
    this.pollAttempts = 0;
    this.state = 'verifying';
    this.verifyOmisePayment();
  }

  backToCart(): void {
    this.router.navigate(['/cart']);
  }

  continueShopping(): void {
    this.router.navigate(['/products']);
  }
}
