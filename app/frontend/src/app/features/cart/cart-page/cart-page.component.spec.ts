import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ToastrModule } from 'ngx-toastr';
import { CartPageComponent } from './cart-page.component';
import { CartService } from '../../../core/services/cart/cart.service';
import { NotificationService } from '../../../core/services/ui/notification.service';
import { InputFieldComponent } from '../../../shared/components/form/input-field/input-field.component';
import { Product, CartItem } from '../../products/models/product.model';

describe('CartPageComponent', () => {
  let component: CartPageComponent;
  let fixture: ComponentFixture<CartPageComponent>;
  let cartService: CartService;
  let notificationSpy: jasmine.SpyObj<NotificationService>;

  const mockProduct: Product = {
    id: 1,
    name: 'Test Product',
    category: 'Electronics',
    price: 79.99,
    image: 'https://example.com/img.jpg',
    description: 'A test product',
    previewImg: [],
    types: [
      { _id: 't1', productId: 1001, color: 'Black', quantity: 50, price: 79.99, stock: 50, image: '' }
    ],
    reviews: [],
    overallRating: 4.5,
    stock: 50,
    shopId: 'shop1',
    shopName: 'Test Shop'
  };

  const mockProduct2: Product = {
    ...mockProduct,
    id: 2,
    name: 'Test Product 2',
    price: 49.99,
    shopId: 'shop2',
    shopName: 'Another Shop'
  };

  beforeEach(async () => {
    notificationSpy = jasmine.createSpyObj('NotificationService', ['success', 'error', 'info', 'warning']);

    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, HttpClientTestingModule, ToastrModule.forRoot()],
      declarations: [CartPageComponent, InputFieldComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        CartService,
        { provide: NotificationService, useValue: notificationSpy }
      ]
    }).compileComponents();

    cartService = TestBed.inject(CartService);
    fixture = TestBed.createComponent(CartPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show empty cart message when no items', () => {
    const empty = fixture.nativeElement.querySelector('.cart-page__empty');
    expect(empty).toBeTruthy();
  });

  it('should display cart items when cart has products', () => {
    cartService.addToCartLocal(mockProduct, 2, mockProduct.types[0]);
    fixture.detectChanges();
    const items = fixture.nativeElement.querySelectorAll('.cart-item');
    expect(items.length).toBe(1);
  });

  it('should calculate item price correctly', () => {
    const item: CartItem = { product: mockProduct, quantity: 1, selectedType: mockProduct.types[0], shopId: 'shop1', shopName: 'Test Shop' };
    expect(component.getItemPrice(item)).toBe(79.99);
  });

  it('should calculate item subtotal correctly', () => {
    const item: CartItem = { product: mockProduct, quantity: 3, selectedType: mockProduct.types[0], shopId: 'shop1', shopName: 'Test Shop' };
    expect(component.getItemSubtotal(item)).toBeCloseTo(239.97, 2);
  });

  it('should group items by shop', () => {
    cartService.addToCartLocal(mockProduct, 1, mockProduct.types[0]);
    cartService.addToCartLocal(mockProduct2, 1);
    fixture.detectChanges();

    const groups = component.shopGroups;
    expect(groups.length).toBe(2);
    expect(groups[0].shopName).toBe('Test Shop');
    expect(groups[1].shopName).toBe('Another Shop');
  });

  it('should select all items by default', () => {
    cartService.addToCartLocal(mockProduct, 2, mockProduct.types[0]);
    fixture.detectChanges();
    expect(component.selectedCount).toBe(2);
    expect(component.selectedTotal).toBeCloseTo(159.98, 2);
  });

  it('should toggle item selection', () => {
    cartService.addToCartLocal(mockProduct, 2, mockProduct.types[0]);
    fixture.detectChanges();

    const item = component.cartItems[0];
    component.toggleItem(item);
    expect(component.isItemSelected(item)).toBeFalse();
    expect(component.selectedCount).toBe(0);
  });

  it('should toggle all items in a shop', () => {
    cartService.addToCartLocal(mockProduct, 1, mockProduct.types[0]);
    fixture.detectChanges();

    const group = component.shopGroups[0];
    component.toggleShop(group);
    expect(component.isShopAllSelected(group)).toBeFalse();

    component.toggleShop(group);
    expect(component.isShopAllSelected(group)).toBeTrue();
  });

  it('should remove item from cart', () => {
    cartService.addToCartLocal(mockProduct, 1, mockProduct.types[0]);
    fixture.detectChanges();
    const item: CartItem = { product: mockProduct, quantity: 1, selectedType: mockProduct.types[0], shopId: 'shop1', shopName: 'Test Shop' };
    component.removeItem(item);
    expect(component.cartItems.length).toBe(0);
    expect(notificationSpy.info).toHaveBeenCalled();
  });

  it('should prevent checkout with no selected items', () => {
    cartService.addToCartLocal(mockProduct, 1, mockProduct.types[0]);
    fixture.detectChanges();

    const item = component.cartItems[0];
    component.toggleItem(item);
    component.onProceedToCheckout();
    expect(notificationSpy.error).toHaveBeenCalledWith('Please select at least one item to checkout.');
  });
});
