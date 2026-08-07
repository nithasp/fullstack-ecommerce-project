import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import type { Stripe, StripeElements, StripePaymentElement } from '@stripe/stripe-js';
import { StripeService } from '../../../../../core/services/payment/stripe.service';
import { PaymentApiService } from '../../../../../core/services/payment/payment-api.service';

@Component({
  selector: 'app-payment-dialog',
  templateUrl: './payment-dialog.component.html',
  styleUrl: './payment-dialog.component.scss'
})
export class PaymentDialogComponent implements OnInit, AfterViewInit, OnDestroy {
  /** PaymentIntent client secret created by the backend. */
  @Input({ required: true }) clientSecret!: string;
  /** Total to charge, in the smallest currency unit (cents). */
  @Input({ required: true }) amount!: number;
  @Input({ required: true }) orderId!: number;

  /** Emits the order id once Stripe reports the payment as successful. */
  @Output() paid = new EventEmitter<number>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('paymentElementHost') paymentElementHost!: ElementRef<HTMLDivElement>;

  isLoadingForm = true;
  loadError = '';
  isProcessing = false;
  errorMessage = '';
  closing = false;

  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;
  private paymentElement: StripePaymentElement | null = null;

  constructor(
    private elementRef: ElementRef<HTMLElement>,
    private stripeService: StripeService,
    private paymentApi: PaymentApiService
  ) {}

  ngOnInit(): void {
    document.body.appendChild(this.elementRef.nativeElement);
  }

  ngAfterViewInit(): void {
    void this.mountPaymentElement();
  }

  ngOnDestroy(): void {
    this.paymentElement?.destroy();
    const el = this.elementRef.nativeElement;
    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

  get displayAmount(): number {
    return this.amount / 100;
  }

  private async mountPaymentElement(): Promise<void> {
    try {
      this.stripe = await this.stripeService.getStripe();
    } catch {
      this.stripe = null;
    }

    if (!this.stripe) {
      this.isLoadingForm = false;
      this.loadError = 'Unable to load the secure payment form. Please try again later.';
      return;
    }

    this.elements = this.stripe.elements({
      clientSecret: this.clientSecret,
      appearance: {
        theme: 'stripe',
        variables: {
          colorPrimary: '#2563eb',
          colorText: '#1f2937',
          colorDanger: '#ef4444',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          borderRadius: '8px',
        },
      },
    });

    this.paymentElement = this.elements.create('payment', { layout: 'tabs' });
    this.paymentElement.on('ready', () => {
      this.isLoadingForm = false;
    });
    this.paymentElement.on('loaderror', (event) => {
      this.isLoadingForm = false;
      this.loadError = event.error?.message || 'Failed to load the payment form. Please try again.';
    });
    this.paymentElement.mount(this.paymentElementHost.nativeElement);
  }

  async pay(): Promise<void> {
    if (!this.stripe || !this.elements || this.isProcessing) return;

    this.isProcessing = true;
    this.errorMessage = '';

    const { error, paymentIntent } = await this.stripe.confirmPayment({
      elements: this.elements,
      confirmParams: {
        return_url: `${window.location.origin}/cart/confirmation`,
      },
      redirect: 'if_required',
    });

    if (error) {
      this.errorMessage = error.message || 'Payment failed. Please check your card details and try again.';
      this.isProcessing = false;
      return;
    }

    if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) {
      // Finalize the order server-side. If this call fails, the Stripe
      // webhook still completes the order, so treat the payment as done.
      this.paymentApi.confirmPayment(paymentIntent.id).subscribe({
        next: () => {
          this.isProcessing = false;
          this.paid.emit(this.orderId);
        },
        error: () => {
          this.isProcessing = false;
          this.paid.emit(this.orderId);
        },
      });
      return;
    }

    this.errorMessage = 'Payment was not completed. Please try again.';
    this.isProcessing = false;
  }

  close(): void {
    if (this.isProcessing || this.closing) return;
    this.closing = true;
  }

  onOverlayAnimationDone(event: AnimationEvent): void {
    if (this.closing && event.target === event.currentTarget) {
      this.closed.emit();
    }
  }
}
