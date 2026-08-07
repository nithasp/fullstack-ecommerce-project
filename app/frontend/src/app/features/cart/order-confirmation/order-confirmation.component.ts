import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-order-confirmation',
  templateUrl: './order-confirmation.component.html',
  styleUrl: './order-confirmation.component.scss'
})
export class OrderConfirmationComponent {
  /** Set when arriving from the Stripe payment flow (passed via router state). */
  orderId: number | null = null;

  constructor(private router: Router) {
    const state = this.router.getCurrentNavigation()?.extras?.state ?? history.state;
    this.orderId = typeof state?.['orderId'] === 'number' ? state['orderId'] : null;
  }

  continueShopping(): void {
    this.router.navigate(['/products']);
  }
}
