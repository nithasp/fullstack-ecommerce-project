import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { ToastrModule } from 'ngx-toastr';
import { of } from 'rxjs';
import { ProductListComponent } from './product-list.component';
import { ProductCardComponent } from '../components/product-card/product-card.component';
import { TruncatePipe } from '../../../shared/pipes/truncate.pipe';
import { ProductService } from '../services/product.service';
import { CartService } from '../../../core/services/cart/cart.service';
import { NotificationService } from '../../../core/services/ui/notification.service';
import { Product } from '../models/product.model';

describe('ProductListComponent', () => {
  let component: ProductListComponent;
  let fixture: ComponentFixture<ProductListComponent>;
  let productServiceSpy: jasmine.SpyObj<ProductService>;
  let cartService: CartService;
  let notificationSpy: jasmine.SpyObj<NotificationService>;

  const mockProducts: Product[] = [
    {
      id: 1,
      name: 'Headphones',
      category: 'Electronics',
      price: 79.99,
      image: 'https://example.com/img1.jpg',
      description: 'Wireless headphones',
      previewImg: [],
      types: [{ _id: 't1', productId: 1, color: 'Black', quantity: 10, price: 79.99, stock: 10, image: '' }],
      reviews: [],
      overallRating: 4.5,
      stock: 10
    },
    {
      id: 2,
      name: 'Office Chair',
      category: 'Furniture',
      price: 249.99,
      image: 'https://example.com/img2.jpg',
      description: 'Ergonomic chair',
      previewImg: [],
      types: [],
      reviews: [],
      overallRating: 5,
      stock: 20
    }
  ];

  beforeEach(async () => {
    productServiceSpy = jasmine.createSpyObj('ProductService', ['getProducts']);
    productServiceSpy.getProducts.and.returnValue(of(mockProducts));

    notificationSpy = jasmine.createSpyObj('NotificationService', ['success', 'error', 'info', 'warning']);

    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        FormsModule,
        RouterTestingModule,
        ToastrModule.forRoot()
      ],
      declarations: [ProductListComponent, ProductCardComponent, TruncatePipe],
      providers: [
        { provide: ProductService, useValue: productServiceSpy },
        { provide: NotificationService, useValue: notificationSpy },
        CartService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProductListComponent);
    component = fixture.componentInstance;
    cartService = TestBed.inject(CartService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load products on init', () => {
    expect(productServiceSpy.getProducts).toHaveBeenCalled();
    expect(component.products.length).toBe(2);
    expect(component.isLoading).toBeFalse();
  });

  it('should extract unique categories', () => {
    expect(component.categories).toContain('Electronics');
    expect(component.categories).toContain('Furniture');
    expect(component.categories.length).toBe(2);
  });

  it('should filter by category', () => {
    component.filterByCategory('Electronics');
    expect(component.filteredProducts.length).toBe(1);
    expect(component.filteredProducts[0].name).toBe('Headphones');
  });

  it('should show all products when category is cleared', () => {
    component.filterByCategory('Electronics');
    component.filterByCategory('');
    expect(component.filteredProducts.length).toBe(2);
  });

  it('should filter by search term', () => {
    component.onSearchChange('chair');
    expect(component.filteredProducts.length).toBe(1);
    expect(component.filteredProducts[0].name).toBe('Office Chair');
  });

  it('should combine category and search filters', () => {
    component.filterByCategory('Electronics');
    component.onSearchChange('head');
    expect(component.filteredProducts.length).toBe(1);
  });

  it('should render product cards', () => {
    const cards = fixture.nativeElement.querySelectorAll('app-product-card');
    expect(cards.length).toBe(2);
  });

  it('should render category filter buttons', () => {
    const buttons = fixture.nativeElement.querySelectorAll('.product-list__category-btn');
    expect(buttons.length).toBe(3); // All + Electronics + Furniture
  });
});
