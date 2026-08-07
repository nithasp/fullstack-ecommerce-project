import { Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Router } from '@angular/router';
import { PaymentApiService } from '../../../../../core/services/payment/payment-api.service';
import {
  CreateOmiseChargePayload,
  OmiseConfig,
  OmiseInstallmentOption,
  OmiseMethodId,
} from '../../../../../core/models/payment-api.model';

const METHOD_TITLES: Record<OmiseMethodId, string> = {
  truemoney: 'TrueMoney Wallet',
  rabbit_linepay: 'Rabbit LINE Pay',
  shopeepay: 'ShopeePay',
  banking: 'Mobile / Internet Banking',
  installment: 'Installments (ผ่อนชำระ)',
};

/**
 * Checkout dialog for Omise redirect-based payment methods. Collects the
 * method-specific details (TrueMoney phone, bank, installment plan), asks the
 * backend to create the charge, then sends the customer to the wallet/bank
 * authorization page. The confirmation page picks the flow back up on return.
 */
@Component({
  selector: 'app-omise-payment-dialog',
  templateUrl: './omise-payment-dialog.component.html',
  styleUrl: './omise-payment-dialog.component.scss'
})
export class OmisePaymentDialogComponent implements OnInit, OnDestroy {
  @Input({ required: true }) method!: OmiseMethodId;
  /** Display total in the smallest currency unit. The backend re-prices authoritatively. */
  @Input({ required: true }) amount!: number;
  @Input({ required: true }) cartItemIds!: number[];
  @Input() discountCode?: string;

  @Output() closed = new EventEmitter<void>();

  isLoadingConfig = true;
  configError = '';
  config: OmiseConfig | null = null;

  phoneNumber = '';
  bankSourceType = '';
  installmentBank = '';
  installmentTerm: number | null = null;

  isProcessing = false;
  errorMessage = '';
  closing = false;

  constructor(
    private elementRef: ElementRef<HTMLElement>,
    private paymentApi: PaymentApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    document.body.appendChild(this.elementRef.nativeElement);

    this.paymentApi.getOmiseConfig().subscribe({
      next: (config) => {
        this.config = config;
        this.isLoadingConfig = false;

        const banks = config.methods.banking.banks;
        if (banks.length > 0) this.bankSourceType = banks[0].sourceType;

        const installmentBanks = config.methods.installment.banks;
        if (installmentBanks.length > 0) this.selectInstallmentBank(installmentBanks[0].bank);
      },
      error: (err) => {
        this.isLoadingConfig = false;
        this.configError = err?.error?.message || 'Unable to load payment options. Please try again later.';
      },
    });
  }

  ngOnDestroy(): void {
    const el = this.elementRef.nativeElement;
    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

  get title(): string {
    return METHOD_TITLES[this.method];
  }

  get displayAmount(): number {
    return this.amount / 100;
  }

  get currencySymbol(): string {
    const currency = (this.config?.currency || 'thb').toLowerCase();
    if (currency === 'thb') return '฿';
    if (currency === 'usd') return '$';
    return currency.toUpperCase() + ' ';
  }

  get isMethodAvailable(): boolean {
    if (!this.config) return false;
    const methods = this.config.methods;
    switch (this.method) {
      case 'truemoney': return methods.truemoney.available;
      case 'rabbit_linepay': return methods.rabbit_linepay.available;
      case 'shopeepay': return methods.shopeepay.available;
      case 'banking': return methods.banking.available;
      case 'installment': return methods.installment.available;
    }
  }

  /** TrueMoney's phone flow needs the wallet's phone number; the jump-app flow doesn't. */
  get requiresPhone(): boolean {
    return this.method === 'truemoney' && !!this.config?.methods.truemoney.requiresPhone;
  }

  /** Wallet methods that only need a redirect, with no extra inputs. */
  get isRedirectOnly(): boolean {
    return this.method === 'rabbit_linepay' || this.method === 'shopeepay'
      || (this.method === 'truemoney' && !this.requiresPhone);
  }

  get bankingBanks() {
    return this.config?.methods.banking.banks ?? [];
  }

  get installmentBanks(): OmiseInstallmentOption[] {
    return this.config?.methods.installment.banks ?? [];
  }

  get installmentTerms(): number[] {
    return this.installmentBanks.find(b => b.bank === this.installmentBank)?.terms ?? [];
  }

  get monthlyEstimate(): number | null {
    if (this.method !== 'installment' || !this.installmentTerm) return null;
    return this.displayAmount / this.installmentTerm;
  }

  selectInstallmentBank(bank: string): void {
    this.installmentBank = bank;
    const terms = this.installmentTerms;
    this.installmentTerm = terms.length > 0 ? terms[0] : null;
  }

  private validate(): string | null {
    if (this.requiresPhone && !/^0\d{9}$/.test(this.phoneNumber.trim()))
      return 'Please enter the 10-digit Thai mobile number linked to your TrueMoney Wallet, e.g. 0812345678.';
    if (this.method === 'banking' && !this.bankSourceType)
      return 'Please choose your bank.';
    if (this.method === 'installment') {
      if (!this.installmentBank) return 'Please choose the card issuer for your installment plan.';
      if (!this.installmentTerm) return 'Please choose the number of months.';
    }
    return null;
  }

  pay(): void {
    if (this.isProcessing || this.isLoadingConfig || this.configError || !this.isMethodAvailable) return;

    const validationError = this.validate();
    if (validationError) {
      this.errorMessage = validationError;
      return;
    }

    this.isProcessing = true;
    this.errorMessage = '';

    const payload: CreateOmiseChargePayload = {
      cartItemIds: this.cartItemIds,
      discountCode: this.discountCode,
      method: this.method,
      returnOrigin: window.location.origin,
    };
    if (this.requiresPhone) payload.phoneNumber = this.phoneNumber.trim();
    if (this.method === 'banking') payload.bankSourceType = this.bankSourceType;
    if (this.method === 'installment') {
      payload.installmentBank = this.installmentBank;
      payload.installmentTerm = this.installmentTerm!;
    }

    this.paymentApi.createOmiseCharge(payload).subscribe({
      next: (session) => {
        // Stay in the processing state — we're leaving the page either way.
        if (session.authorizeUri) {
          window.location.href = session.authorizeUri;
        } else {
          this.router.navigate(['/cart/confirmation'], {
            queryParams: { provider: 'omise', orderId: session.orderId },
          });
        }
      },
      error: (err) => {
        this.isProcessing = false;
        this.errorMessage = err?.error?.message || 'Unable to start the payment. Please try again.';
      },
    });
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
