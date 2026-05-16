import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { combineLatest, Subscription } from 'rxjs';
import { CartItem } from '../../products/models/product.model';
import { CartService } from '../../../core/services/cart/cart.service';
import { CartApiService } from '../../../core/services/cart/cart-api.service';
import { NotificationService } from '../../../core/services/ui/notification.service';
import { AddressApiService } from '../services/address-api.service';
import { AddressEntry } from '../models/address.model';
import { PaymentMethod, ShopGroup } from '../models/cart.model';

@Component({
  selector: 'app-cart-page',
  templateUrl: './cart-page.component.html',
  styleUrl: './cart-page.component.scss'
})
export class CartPageComponent implements OnInit, OnDestroy {
  cartItems: CartItem[] = [];
  shopGroups: ShopGroup[] = [];

  isLoadingCart = true;
  isCheckingOut = false;
  selectedKeys = new Set<string>();

  addresses: AddressEntry[] = [];
  selectedAddressId: number | null = null;
  isLoadingAddresses = false;
  isAddressDialogOpen = false;

  selectedPayment = 'visa';
  paymentMethods: PaymentMethod[] = [
    { id: 'visa',       name: 'Visa',          description: 'Credit / Debit Card',  badge: 'VISA', color: '#1a1f71' },
    { id: 'mastercard', name: 'Mastercard',     description: 'Credit / Debit Card',  badge: 'MC',   color: '#eb001b' },
    { id: 'qrcode',     name: 'QR Code',        description: 'Scan to Pay',          badge: 'QR',   color: '#6366f1' },
    { id: 'bank',       name: 'Bank Transfer',  description: 'Direct Bank Transfer', badge: 'BANK', color: '#059669' },
  ];

  discountCode = '';
  appliedDiscount = 0;
  discountLabel = '';
  discountSuccess = '';
  discountError = '';

  private readonly MOCK_CODES: Record<string, number> = {
    '10%OFF': 0.1,
    'SAVE20': 0.2,
  };

  private cartSub!: Subscription;
  private _initializedKeys = new Set<string>();

  constructor(
    public cartService: CartService,
    private cartApi: CartApiService,
    private addressApi: AddressApiService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.fetchAddresses();

    this.cartSub = combineLatest([
      this.cartService.cart$,
      this.cartService.isCartLoading$,
    ]).subscribe(([items, loading]) => {
      this.isLoadingCart = loading;
      this.cartItems = items;
      items.forEach(item => {
        const key = this.getItemKey(item);
        if (!this.selectedKeys.has(key) && !this._initializedKeys.has(key)) {
          this.selectedKeys.add(key);
        }
        this._initializedKeys.add(key);
      });
      this.cleanUpRemovedKeys();
      this.rebuildShopGroups();
    });
  }

  private fetchAddresses(): void {
    this.isLoadingAddresses = true;
    this.addressApi.getAddresses().subscribe({
      next: (list) => {
        this.addresses = list;
        this.isLoadingAddresses = false;
        if (!this.selectedAddressId && list.length > 0) {
          const def = list.find(a => a.isDefault) ?? list[0];
          this.selectedAddressId = def.id;
        }
      },
      error: () => {
        this.isLoadingAddresses = false;
      },
    });
  }

  onAddressesChange(updated: AddressEntry[]): void {
    this.addresses = updated;
  }

  private cleanUpRemovedKeys(): void {
    const currentKeys = new Set(this.cartItems.map(i => this.getItemKey(i)));
    for (const key of this.selectedKeys) {
      if (!currentKeys.has(key)) this.selectedKeys.delete(key);
    }
    for (const key of this._initializedKeys) {
      if (!currentKeys.has(key)) this._initializedKeys.delete(key);
    }
  }

  ngOnDestroy(): void {
    this.cartSub.unsubscribe();
  }

  getItemKey(item: CartItem): string {
    return `${item.product.id}_${item.selectedType?._id ?? 'default'}`;
  }

  isItemLoading(item: CartItem): boolean {
    return this.cartService.isItemLoading(item.product.id, item.selectedType?._id);
  }

  private rebuildShopGroups(): void {
    const groupMap = new Map<string, ShopGroup>();
    for (const item of this.cartItems) {
      const id = item.shopId || item.product.shopId || 'unknown';
      const shopName = item.shopName || item.product.shopName || 'Unknown Shop';
      if (!groupMap.has(id)) {
        groupMap.set(id, { shopId: id, shopName, items: [] });
      }
      groupMap.get(id)!.items.push(item);
    }
    this.shopGroups = Array.from(groupMap.values());
  }

  isItemSelected(item: CartItem): boolean {
    return this.selectedKeys.has(this.getItemKey(item));
  }

  toggleItem(item: CartItem): void {
    const key = this.getItemKey(item);
    if (this.selectedKeys.has(key)) {
      this.selectedKeys.delete(key);
    } else {
      this.selectedKeys.add(key);
    }
  }

  isShopAllSelected(group: ShopGroup): boolean {
    return group.items.every(item => this.selectedKeys.has(this.getItemKey(item)));
  }

  isShopIndeterminate(group: ShopGroup): boolean {
    const count = group.items.filter(item => this.selectedKeys.has(this.getItemKey(item))).length;
    return count > 0 && count < group.items.length;
  }

  toggleShop(group: ShopGroup): void {
    const allSelected = this.isShopAllSelected(group);
    for (const item of group.items) {
      const key = this.getItemKey(item);
      if (allSelected) {
        this.selectedKeys.delete(key);
      } else {
        this.selectedKeys.add(key);
      }
    }
  }

  get selectedItems(): CartItem[] {
    return this.cartItems.filter(item => this.selectedKeys.has(this.getItemKey(item)));
  }

  get selectedTotal(): number {
    return this.selectedItems.reduce((total, item) => total + this.getItemSubtotal(item), 0);
  }

  get selectedCount(): number {
    return this.selectedItems.reduce((count, item) => count + item.quantity, 0);
  }

  get cartTotal(): number { return this.selectedTotal; }
  get cartCount(): number { return this.selectedCount; }
  get discountAmount(): number { return this.cartTotal * this.appliedDiscount; }
  get cartTotalAfterDiscount(): number { return this.cartTotal - this.discountAmount; }

  get selectedAddress(): AddressEntry | undefined {
    return this.addresses.find(a => a.id === this.selectedAddressId);
  }

  getItemPrice(item: CartItem): number {
    return item.selectedType?.price ?? item.product.price;
  }

  getItemSubtotal(item: CartItem): number {
    return this.getItemPrice(item) * item.quantity;
  }

  getItemStock(item: CartItem): number {
    return item.selectedType?.stock ?? item.product.stock ?? 99;
  }

  updateQuantity(item: CartItem, quantity: number): void {
    const maxStock = this.getItemStock(item);
    if (quantity > maxStock) {
      this.notificationService.warning(
        `Only ${maxStock} ${maxStock === 1 ? 'item' : 'items'} available in stock. Quantity cannot exceed the available stock.`,
        'Stock Limit Reached'
      );
      return;
    }
    this.cartService.updateQuantity(item.product.id, quantity, item.selectedType?._id);
  }

  removeItem(item: CartItem): void {
    if (this.isItemLoading(item)) return;
    this.cartService.removeFromCart(item.product.id, item.selectedType?._id);
    this.notificationService.info(`${item.product.name} removed from cart`);
  }

  applyDiscount(): void {
    const code = this.discountCode.trim().toUpperCase();
    if (!code) {
      this.discountError = 'Please enter a discount code.';
      this.discountSuccess = '';
      return;
    }
    const discount = this.MOCK_CODES[code];
    if (discount !== undefined) {
      this.appliedDiscount = discount;
      this.discountLabel = code;
      this.discountSuccess = `"${code}" applied — ${discount * 100}% off your order!`;
      this.discountError = '';
    } else {
      this.discountError = 'Invalid code. Try "10%OFF" or "SAVE20".';
      this.discountSuccess = '';
      this.appliedDiscount = 0;
      this.discountLabel = '';
    }
  }

  useHintCode(code: string): void {
    this.discountCode = code;
  }

  removeDiscount(): void {
    this.appliedDiscount = 0;
    this.discountLabel = '';
    this.discountCode = '';
    this.discountSuccess = '';
    this.discountError = '';
  }

  onProceedToCheckout(): void {
    if (this.selectedCount === 0) {
      this.notificationService.error('Please select at least one item to checkout.');
      return;
    }
    if (!this.selectedAddress) {
      this.notificationService.error('Please select a shipping address to continue.');
      this.isAddressDialogOpen = true;
      return;
    }
    if (this.isCheckingOut) return;

    const checkoutItems = this.selectedItems
      .filter(item => item.cartItemId !== undefined)
      .map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
      }));

    if (checkoutItems.length === 0) {
      this.notificationService.error('Unable to process order. Please refresh and try again.');
      return;
    }

    this.isCheckingOut = true;
    this.cartApi.checkout(checkoutItems).subscribe({
      next: () => {
        this.cartService.clearLocalCart();
        this.isCheckingOut = false;
        this.notificationService.success('Order placed successfully!', 'Thank You');
        this.router.navigate(['/cart/confirmation']);
      },
      error: (err) => {
        this.isCheckingOut = false;
        const message = err?.error?.error || 'Checkout failed. Please try again.';
        this.notificationService.error(message);
      },
    });
  }
}
