import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';
import { CartItem, Product, ProductType, Review } from '../../../features/products/models/product.model';
import { CartApiService } from './cart-api.service';
import { CartApiItem } from '../../models/cart-api.model';
import { QuantityUpdate } from '../../models/cart.model';

@Injectable({ providedIn: 'root' })
export class CartService {
  private cartItems: CartItem[] = [];
  private cartSubject = new BehaviorSubject<CartItem[]>([]);
  cart$ = this.cartSubject.asObservable();

  private cartLoadingSubject = new BehaviorSubject<boolean>(false);
  isCartLoading$ = this.cartLoadingSubject.asObservable();

  private loadingKeys = new Set<string>();
  private loadingSubject = new BehaviorSubject<Set<string>>(new Set());
  loading$ = this.loadingSubject.asObservable();

  private quantityUpdate$ = new Subject<QuantityUpdate>();

  constructor(private cartApi: CartApiService) {
    this.quantityUpdate$
      .pipe(
        debounceTime(400),
        switchMap(({ cartItemId, quantity, itemKey }) => {
          this.setLoading(itemKey, true);
          return this.cartApi.updateItem(cartItemId, quantity);
        })
      )
      .subscribe({
        next: (updated) => {
          const item = this.cartItems.find(i => i.cartItemId === updated.id);
          if (item) {
            item.quantity = updated.quantity;
            this.cartSubject.next([...this.cartItems]);
          }
          this.clearLoadingByCartItemId(updated.id);
        },
        error: () => {
          this.loadingKeys.clear();
          this.loadingSubject.next(new Set());
        },
      });
  }

  private setLoading(key: string, loading: boolean): void {
    if (loading) {
      this.loadingKeys.add(key);
    } else {
      this.loadingKeys.delete(key);
    }
    this.loadingSubject.next(new Set(this.loadingKeys));
  }

  private clearLoadingByCartItemId(cartItemId: number): void {
    const item = this.cartItems.find(i => i.cartItemId === cartItemId);
    if (item) {
      this.setLoading(this.makeKey(item.product.id, item.selectedType?._id), false);
    }
  }

  isItemLoading(productId: number, typeId?: string): boolean {
    return this.loadingKeys.has(this.makeKey(productId, typeId));
  }

  private makeKey(productId: number, typeId?: string): string {
    return `${productId}_${typeId ?? 'default'}`;
  }

  fetchCart(): void {
    this.cartLoadingSubject.next(true);
    this.cartApi.getCart().subscribe({
      next: (apiItems) => {
        this.cartItems = apiItems.map(api => this.apiItemToCartItem(api));
        this.cartSubject.next([...this.cartItems]);
        this.cartLoadingSubject.next(false);
      },
      error: () => {
        this.cartLoadingSubject.next(false);
      },
    });
  }

  resetCart(): void {
    this.cartItems = [];
    this.cartSubject.next([]);
    this.loadingKeys.clear();
    this.loadingSubject.next(new Set());
    this.cartLoadingSubject.next(false);
  }

  private apiItemToCartItem(api: CartApiItem): CartItem {
    const product: Product = {
      id: api.productId,
      name: api.productName ?? '',
      category: api.productCategory ?? '',
      price: api.productPrice ?? 0,
      image: api.productImage ?? '',
      description: api.productDescription ?? '',
      previewImg: api.productPreviewImg ?? [],
      types: api.productTypes ?? [],
      reviews: (api.productReviews ?? []) as Review[],
      overallRating: api.productOverallRating ?? 0,
      stock: api.productStock,
      isActive: api.productIsActive,
      shopId: api.productShopId ?? undefined,
      shopName: api.productShopName ?? undefined,
    };

    return {
      cartItemId: api.id,
      product,
      quantity: api.quantity,
      selectedType: api.selectedType ?? undefined,
      shopId: api.shopId ?? product.shopId ?? '',
      shopName: api.shopName ?? product.shopName ?? '',
    };
  }

  /** Update local cart immediately for instant UI feedback (before debounce fires). */
  addToCartLocal(product: Product, quantity: number, selectedType?: ProductType): void {
    const existingIndex = this.cartItems.findIndex(
      item => item.product.id === product.id &&
              item.selectedType?._id === selectedType?._id
    );
    if (existingIndex > -1) {
      this.cartItems[existingIndex].quantity += quantity;
    } else {
      this.cartItems.push({
        product,
        quantity,
        selectedType,
        shopId: product.shopId ?? '',
        shopName: product.shopName ?? '',
      });
    }
    this.cartSubject.next([...this.cartItems]);
  }

  /** Sync current local quantity to the backend (PUT if exists, POST if new). */
  syncToBackend(product: Product, selectedType?: ProductType): void {
    const key = this.makeKey(product.id, selectedType?._id);
    const item = this.cartItems.find(
      i => i.product.id === product.id &&
           i.selectedType?._id === selectedType?._id
    );
    if (!item) return;

    this.setLoading(key, true);

    if (item.cartItemId) {
      this.cartApi.updateItem(item.cartItemId, item.quantity).subscribe({
        next: (updated) => {
          item.quantity = updated.quantity;
          this.cartSubject.next([...this.cartItems]);
          this.setLoading(key, false);
        },
        error: () => this.setLoading(key, false),
      });
    } else {
      this.cartApi.addItem({
        productId: product.id,
        quantity: item.quantity,
        typeId: selectedType?._id ?? null,
        selectedType: selectedType ?? null,
        shopId: product.shopId ?? null,
        shopName: product.shopName ?? null,
      }).subscribe({
        next: (apiItem) => {
          item.cartItemId = apiItem.id;
          item.quantity = apiItem.quantity;
          this.cartSubject.next([...this.cartItems]);
          this.setLoading(key, false);
        },
        error: () => {
          this.cartItems = this.cartItems.filter(
            i => !(i.product.id === product.id &&
                   i.selectedType?._id === selectedType?._id)
          );
          this.cartSubject.next([...this.cartItems]);
          this.setLoading(key, false);
        },
      });
    }
  }

  addToCart(product: Product, quantity: number, selectedType?: ProductType): void {
    const key = this.makeKey(product.id, selectedType?._id);
    const existingIndex = this.cartItems.findIndex(
      item => item.product.id === product.id &&
              item.selectedType?._id === selectedType?._id
    );

    if (existingIndex > -1) {
      this.cartItems[existingIndex].quantity += quantity;
    } else {
      this.cartItems.push({
        product,
        quantity,
        selectedType,
        shopId: product.shopId ?? '',
        shopName: product.shopName ?? '',
      });
    }
    this.cartSubject.next([...this.cartItems]);

    this.setLoading(key, true);
    this.cartApi.addItem({
      productId: product.id,
      quantity,
      typeId: selectedType?._id ?? null,
      selectedType: selectedType ?? null,
      shopId: product.shopId ?? null,
      shopName: product.shopName ?? null,
    }).subscribe({
      next: (apiItem) => {
        const item = this.cartItems.find(
          i => i.product.id === product.id &&
               i.selectedType?._id === selectedType?._id
        );
        if (item) {
          item.cartItemId = apiItem.id;
          item.quantity = apiItem.quantity;
          this.cartSubject.next([...this.cartItems]);
        }
        this.setLoading(key, false);
      },
      error: () => {
        if (existingIndex > -1) {
          this.cartItems[existingIndex].quantity -= quantity;
        } else {
          this.cartItems = this.cartItems.filter(
            i => !(i.product.id === product.id &&
                   i.selectedType?._id === selectedType?._id)
          );
        }
        this.cartSubject.next([...this.cartItems]);
        this.setLoading(key, false);
      },
    });
  }

  removeFromCart(productId: number, typeId?: string): void {
    const key = this.makeKey(productId, typeId);
    const item = this.cartItems.find(
      i => i.product.id === productId && i.selectedType?._id === typeId
    );
    if (!item) return;

    this.setLoading(key, true);

    if (item.cartItemId) {
      this.cartApi.removeItem(item.cartItemId).subscribe({
        next: () => {
          this.cartItems = this.cartItems.filter(
            i => !(i.product.id === productId && i.selectedType?._id === typeId)
          );
          this.cartSubject.next([...this.cartItems]);
          this.setLoading(key, false);
        },
        error: () => this.setLoading(key, false),
      });
    } else {
      this.cartItems = this.cartItems.filter(
        i => !(i.product.id === productId && i.selectedType?._id === typeId)
      );
      this.cartSubject.next([...this.cartItems]);
      this.setLoading(key, false);
    }
  }

  /** Local update immediately; API call debounced 400ms. */
  updateQuantity(productId: number, quantity: number, typeId?: string): void {
    const key = this.makeKey(productId, typeId);
    const item = this.cartItems.find(
      i => i.product.id === productId && i.selectedType?._id === typeId
    );
    if (!item) return;

    item.quantity = Math.max(1, quantity);
    this.cartSubject.next([...this.cartItems]);

    if (item.cartItemId) {
      this.quantityUpdate$.next({ cartItemId: item.cartItemId, quantity: item.quantity, itemKey: key });
    }
  }

  clearCart(): void {
    this.cartApi.clearCart().subscribe({
      next: () => {
        this.cartItems = [];
        this.cartSubject.next([]);
      },
    });
  }

  clearLocalCart(): void {
    this.cartItems = [];
    this.cartSubject.next([]);
  }

  getTotal(): number {
    return this.cartItems.reduce((total, item) => {
      const price = item.selectedType?.price ?? item.product.price;
      return total + (price * item.quantity);
    }, 0);
  }

  getCartCount(): number {
    return this.cartItems.reduce((count, item) => count + item.quantity, 0);
  }

  getItems(): CartItem[] {
    return [...this.cartItems];
  }
}
