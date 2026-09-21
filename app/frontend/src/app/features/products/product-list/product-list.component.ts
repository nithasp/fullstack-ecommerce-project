import { Component, OnDestroy, OnInit } from '@angular/core';
import { debounceTime, distinctUntilChanged, Subject, Subscription } from 'rxjs';
import { Product } from '../models/product.model';
import { ProductService } from '../services/product.service';
import { NotificationService } from '../../../core/services/ui/notification.service';

// Twelve matches the staggered animate-delay-1..12 classes, so each page slides in the same way
export const PRODUCT_PAGE_SIZE = 12;
export const SEARCH_DEBOUNCE_MS = 300;

@Component({
  selector: 'app-product-list',
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.scss'
})
export class ProductListComponent implements OnInit, OnDestroy {
  readonly pageSize = PRODUCT_PAGE_SIZE;

  products: Product[] = [];
  total = 0;
  categories: string[] = [];
  selectedCategory = '';
  searchTerm = '';
  isLoading = true;
  isLoadingMore = false;

  private readonly searchTerms = new Subject<string>();
  private readonly subscriptions = new Subscription();
  private pageRequest?: Subscription;

  constructor(
    private productService: ProductService,
    private notificationService: NotificationService
  ) { }

  get hasMore(): boolean {
    return this.products.length < this.total;
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.productService.getCategories().subscribe({
        next: (categories) => (this.categories = categories),
        error: () => this.notificationService.error('Failed to load categories')
      })
    );

    // Typing only reaches the server once the user pauses
    this.subscriptions.add(
      this.searchTerms
        .pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged())
        .subscribe(() => this.fetchPage(0))
    );

    this.fetchPage(0);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.pageRequest?.unsubscribe();
  }

  filterByCategory(category: string): void {
    this.selectedCategory = category;
    this.fetchPage(0);
  }

  onSearchChange(term: string): void {
    this.searchTerm = term;
    this.searchTerms.next(term.trim());
  }

  loadMore(): void {
    if (!this.hasMore || this.isLoadingMore) return;
    this.isLoadingMore = true;
    this.fetchPage(this.products.length);
  }

  // Offset 0 starts the list over for a new filter; any other offset appends the next page.
  // A request still in flight is dropped, so a slow old response can't overwrite a newer one.
  private fetchPage(offset: number): void {
    this.pageRequest?.unsubscribe();
    this.pageRequest = this.productService.getProducts({
      limit: this.pageSize,
      offset,
      category: this.selectedCategory || undefined,
      search: this.searchTerm.trim() || undefined,
    }).subscribe({
      next: (page) => {
        this.products = offset === 0 ? page.items : [...this.products, ...page.items];
        this.total = page.total;
        this.isLoading = false;
        this.isLoadingMore = false;
      },
      error: () => {
        this.notificationService.error('Failed to load products');
        this.isLoading = false;
        this.isLoadingMore = false;
      }
    });
  }
}
