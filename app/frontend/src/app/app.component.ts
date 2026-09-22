import { Component, OnInit } from '@angular/core';
import { AuthService } from './core/services/auth/auth.service';
import { CartService } from './core/services/cart/cart.service';
import { PageViewService } from './core/services/activity/page-view.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  title = 'MyStore';
  authReady = false;

  constructor(
    private authService: AuthService,
    private cartService: CartService,
    private pageViewService: PageViewService,
  ) {}

  ngOnInit(): void {
    this.authService.initializeAuth().subscribe(() => {
      this.authReady = true;
    });

    this.pageViewService.trackPageViews();

    this.authService.isLoggedIn$.subscribe(isLoggedIn => {
      if (isLoggedIn) {
        this.cartService.fetchCart();
      } else {
        this.cartService.resetCart();
      }
    });
  }
}
