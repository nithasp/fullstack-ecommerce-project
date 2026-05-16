import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { Product, ProductType } from '../models/product.model';
import { ProductService } from '../services/product.service';
import { CartService } from '../../../core/services/cart/cart.service';
import { NotificationService } from '../../../core/services/ui/notification.service';

@Component({
  selector: 'app-product-detail',
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.scss'
})
export class ProductDetailComponent implements OnInit, OnDestroy {
  product: Product | undefined;
  selectedQuantity = 1;
  selectedType: ProductType | undefined;
  selectedImage = '';
  loading = true;

  // Tracks accumulated qty before the debounce fires
  private pendingQty = 0;

  private clickSubject = new Subject<void>();
  private sub!: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductService,
    public cartService: CartService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.productService.getProductById(id).subscribe({
        next: (product) => {
          this.product = product;
          if (product) {
            this.selectedImage = product.image;
            this.selectedType = product.types.length === 1 ? product.types[0] : undefined;
          }
          this.loading = false;
        },
        error: () => {
          this.notificationService.error('Failed to load product details');
          this.loading = false;
        }
      });
    }

    this.sub = this.clickSubject.pipe(debounceTime(400)).subscribe(() => {
      if (!this.product) return;

      const addedQty = this.pendingQty;
      this.pendingQty = 0;

      // Sync accumulated local quantity to the backend
      this.cartService.syncToBackend(this.product, this.selectedType);

      this.notificationService.success(
        `${addedQty}x ${this.product.name} added to cart!`,
        'Added to Cart'
      );
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  selectImage(img: string): void {
    this.selectedImage = img;
  }

  selectType(type: ProductType): void {
    this.selectedType = type;
    this.selectedImage = type.image;
    if (this.selectedQuantity > type.stock) {
      this.selectedQuantity = 1;
    }
  }

  onQuantityChange(qty: number): void {
    this.selectedQuantity = qty;
  }

  addToCart(): void {
    if (!this.product) return;

    const existingItem = this.cartService.getItems().find(
      item => item.product.id === this.product!.id &&
              item.selectedType?._id === this.selectedType?._id
    );
    const currentCartQty = existingItem?.quantity ?? 0;
    const totalAfterAdd = currentCartQty + this.selectedQuantity;

    if (totalAfterAdd > this.currentStock) {
      const remaining = this.currentStock - currentCartQty;
      if (remaining <= 0) {
        this.notificationService.warning(
          `You already have the maximum available stock (${this.currentStock}) in your cart.`,
          'Stock Limit Reached'
        );
      } else {
        this.notificationService.warning(
          `Cannot add ${this.selectedQuantity}. Only ${remaining} more ${remaining === 1 ? 'item' : 'items'} can be added (stock: ${this.currentStock}).`,
          'Stock Limit Reached'
        );
      }
      return;
    }

    this.pendingQty += this.selectedQuantity;

    // Immediately reflect in local cart
    this.cartService.addToCartLocal(this.product, this.selectedQuantity, this.selectedType);

    // Reset the 400ms debounce window on every click
    this.clickSubject.next();
  }

  goBack(): void {
    this.router.navigate(['/products']);
  }

  get isAdding(): boolean {
    return this.cartService.isItemLoading(this.product?.id ?? 0, this.selectedType?._id);
  }

  get currentPrice(): number {
    return this.selectedType?.price ?? this.product?.price ?? 0;
  }

  get currentStock(): number {
    return this.selectedType?.stock ?? this.product?.stock ?? 0;
  }

  get isQuantityAtLimit(): boolean {
    return this.currentStock > 0 && this.selectedQuantity >= this.currentStock;
  }

  get ratingStars(): number[] {
    return Array(5).fill(0).map((_, i) => i + 1);
  }
}
