import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { CommonModule } from '@angular/common';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NavbarComponent } from './navbar.component';
import { CartService } from '../../../core/services/cart/cart.service';
import { NotificationService } from '../../../core/services/ui/notification.service';
import { Product } from '../../../features/products/models/product.model';

describe('NavbarComponent', () => {
  let component: NavbarComponent;
  let fixture: ComponentFixture<NavbarComponent>;
  let cartService: CartService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, CommonModule, HttpClientTestingModule],
      declarations: [NavbarComponent],
      providers: [
        CartService,
        { provide: NotificationService, useValue: { success: () => {} } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(NavbarComponent);
    component = fixture.componentInstance;
    cartService = TestBed.inject(CartService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have title MyStore', () => {
    expect(component.title).toBe('MyStore');
  });

  it('should render brand name in navbar', () => {
    const brand = fixture.nativeElement.querySelector('.navbar__brand');
    expect(brand.textContent).toContain('MyStore');
  });

  it('should render Products link when logged in', () => {
    component.isLoggedIn = true;
    fixture.detectChanges();
    const links = fixture.nativeElement.querySelectorAll('.navbar__link');
    const productsLink = Array.from(links).find(
      (l: any) => l.textContent.includes('Products')
    );
    expect(productsLink).toBeTruthy();
  });

  it('should render Cart link with icon when logged in', () => {
    component.isLoggedIn = true;
    fixture.detectChanges();
    const cartLink = fixture.nativeElement.querySelector('.navbar__cart-link');
    expect(cartLink).toBeTruthy();
    const icon = cartLink.querySelector('.navbar__cart-icon');
    expect(icon).toBeTruthy();
  });

  it('should start with cart count 0', () => {
    expect(component.cartCount).toBe(0);
  });

  it('should not show badge when cart is empty', () => {
    component.isLoggedIn = true;
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.navbar__badge');
    expect(badge).toBeFalsy();
  });

  it('should update cart count when items added', () => {
    const product: Product = {
      id: 1,
      name: 'Test',
      category: 'Test',
      price: 10,
      image: '',
      description: '',
      previewImg: [],
      types: [],
      reviews: [],
      overallRating: 5
    };
    cartService.addToCartLocal(product, 3);
    expect(component.cartCount).toBe(3);
  });

  it('should open mobile menu on first toggle', () => {
    expect(component.mobileMenuOpen).toBeFalse();
    component.toggleMobileMenu();
    expect(component.mobileMenuOpen).toBeTrue();
  });

  it('should start closing animation when toggled while open', () => {
    component.mobileMenuOpen = true;
    component.menuClosing = false;
    component.toggleMobileMenu();
    expect(component.menuClosing).toBeTrue();
  });

  it('should set menuClosing flag when closeMobileMenu is called', () => {
    component.mobileMenuOpen = true;
    component.menuClosing = false;
    component.closeMobileMenu();
    expect(component.menuClosing).toBeTrue();
  });
});
