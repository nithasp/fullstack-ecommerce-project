import { Component, ElementRef, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { distinctUntilChanged, skip } from 'rxjs/operators';
import { CartService } from '../../../core/services/cart/cart.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { AuthUser } from '../../../core/models/auth.model';
import { NotificationService } from '../../../core/services/ui/notification.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent implements OnInit, OnDestroy {
  title = 'MyStore';
  cartCount = 0;
  mobileMenuOpen = false;
  menuClosing = false;
  isLoggedIn = false;
  userMenuOpen = false;
  currentUser: AuthUser | null = null;
  private cartSub!: Subscription;
  private authSub!: Subscription;
  private userSub!: Subscription;

  constructor(
    private cartService: CartService,
    private authService: AuthService,
    private notification: NotificationService,
    private router: Router,
    private elRef: ElementRef
  ) {}

  ngOnInit(): void {
    // Seed state synchronously from the service so the template renders
    // correctly on the very first paint — no waiting for an observable tick.
    this.isLoggedIn = this.authService.isLoggedIn;
    this.currentUser = this.authService.getCurrentUser();

    this.cartSub = this.cartService.cart$.subscribe(() => {
      this.cartCount = this.cartService.getCartCount();
    });

    // skip(1) ignores the BehaviorSubject's replay of the current value (which
    // we already seeded above). After that, only genuine state changes fire:
    // false → true means the user just logged in; true → false means logout.
    this.authSub = this.authService.isLoggedIn$.pipe(
      distinctUntilChanged(),
      skip(1)
    ).subscribe(loggedIn => {
      this.isLoggedIn = loggedIn;
      if (!loggedIn) {
        this.userMenuOpen = false;
      } else {
        // User just logged in — fetch fresh profile from the server.
        this.authService.fetchCurrentUser().subscribe({ error: () => {} });
      }
    });

    this.userSub = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  ngOnDestroy(): void {
    this.cartSub.unsubscribe();
    this.authSub.unsubscribe();
    this.userSub.unsubscribe();
  }

  get displayName(): string {
    return this.currentUser?.username ?? 'User';
  }

  toggleUserMenu(): void {
    this.userMenuOpen = !this.userMenuOpen;
  }

  closeUserMenu(): void {
    this.userMenuOpen = false;
  }

  logout(): void {
    this.authService.logout();
    this.notification.success('You have been logged out.');
    this.closeMobileMenu();
    this.closeUserMenu();
    this.router.navigate(['/auth/login']);
  }

  toggleMobileMenu(): void {
    if (this.mobileMenuOpen) {
      this.closeMobileMenu();
    } else {
      this.menuClosing = false;
      this.mobileMenuOpen = true;
    }
  }

  closeMobileMenu(): void {
    if (!this.mobileMenuOpen || this.menuClosing) return;
    this.menuClosing = true;
    this.closeUserMenu();
  }

  onMenuAnimationDone(event: AnimationEvent): void {
    if (this.menuClosing && event.target === event.currentTarget) {
      this.mobileMenuOpen = false;
      this.menuClosing = false;
    }
  }

  /** Close menus when the user clicks outside the navbar. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(event.target)) {
      if (this.mobileMenuOpen) this.closeMobileMenu();
      if (this.userMenuOpen) this.closeUserMenu();
    }
  }

  /** Close menus on Escape key press. */
  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.mobileMenuOpen) this.closeMobileMenu();
    if (this.userMenuOpen) this.closeUserMenu();
  }
}
