import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { ToastrModule } from 'ngx-toastr';
import { of, throwError } from 'rxjs';
import { ProductListComponent, PRODUCT_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from './product-list.component';
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
  let notificationSpy: jasmine.SpyObj<NotificationService>;

  const mockProducts: Product[] = [
    {
      id: 1,
      name: 'Headphones',
      category: 'Electronics',
      price: '79.99',
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
      price: '249.99',
      image: 'https://example.com/img2.jpg',
      description: 'Ergonomic chair',
      previewImg: [],
      types: [],
      reviews: [],
      overallRating: 5,
      stock: 20
    }
  ];

  const lamp: Product = { ...mockProducts[1], id: 3, name: 'Desk Lamp', category: 'Lighting' };

  beforeEach(async () => {
    productServiceSpy = jasmine.createSpyObj('ProductService', ['getProducts', 'getCategories']);
    productServiceSpy.getProducts.and.returnValue(of({ items: mockProducts, total: 2 }));
    productServiceSpy.getCategories.and.returnValue(of(['Electronics', 'Furniture']));

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
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load the first page on init', () => {
    expect(productServiceSpy.getProducts).toHaveBeenCalledWith({
      limit: PRODUCT_PAGE_SIZE, offset: 0, category: undefined, search: undefined
    });
    expect(component.products.length).toBe(2);
    expect(component.total).toBe(2);
    expect(component.isLoading).toBeFalse();
  });

  it('should load every category from the server', () => {
    expect(productServiceSpy.getCategories).toHaveBeenCalled();
    expect(component.categories).toEqual(['Electronics', 'Furniture']);
  });

  it('should ask the server for a category and show only what it returns', () => {
    productServiceSpy.getProducts.and.returnValue(of({ items: [mockProducts[0]], total: 1 }));

    component.filterByCategory('Electronics');

    expect(productServiceSpy.getProducts).toHaveBeenCalledWith(
      jasmine.objectContaining({ category: 'Electronics', offset: 0 })
    );
    expect(component.products.length).toBe(1);
    expect(component.products[0].name).toBe('Headphones');
  });

  it('should drop the category filter when All is chosen', () => {
    component.filterByCategory('Electronics');
    component.filterByCategory('');
    expect(productServiceSpy.getProducts.calls.mostRecent().args[0].category).toBeUndefined();
  });

  it('should search on the server once the user pauses typing', fakeAsync(() => {
    productServiceSpy.getProducts.calls.reset();

    component.onSearchChange('cha');
    component.onSearchChange('chair');
    tick(SEARCH_DEBOUNCE_MS - 1);
    expect(productServiceSpy.getProducts).not.toHaveBeenCalled();

    tick(1);
    expect(productServiceSpy.getProducts).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({ search: 'chair', offset: 0 })
    );
  }));

  it('should send the category and the search together', fakeAsync(() => {
    component.filterByCategory('Electronics');
    component.onSearchChange('head');
    tick(SEARCH_DEBOUNCE_MS);
    expect(productServiceSpy.getProducts.calls.mostRecent().args[0]).toEqual(
      jasmine.objectContaining({ category: 'Electronics', search: 'head' })
    );
  }));

  it('should append the next page when Load more is clicked', () => {
    productServiceSpy.getProducts.and.returnValue(of({ items: mockProducts, total: 3 }));
    component.filterByCategory('');
    fixture.detectChanges();

    productServiceSpy.getProducts.and.returnValue(of({ items: [lamp], total: 3 }));
    fixture.nativeElement.querySelector('.product-list__more-btn').click();
    fixture.detectChanges();

    expect(productServiceSpy.getProducts.calls.mostRecent().args[0].offset).toBe(2);
    expect(component.products.map(p => p.name)).toEqual(['Headphones', 'Office Chair', 'Desk Lamp']);
    expect(fixture.nativeElement.querySelector('.product-list__more-btn')).toBeNull();
  });

  it('should not show Load more when every product is on screen', () => {
    expect(component.hasMore).toBeFalse();
    expect(fixture.nativeElement.querySelector('.product-list__more-btn')).toBeNull();
  });

  it('should render product cards', () => {
    const cards = fixture.nativeElement.querySelectorAll('app-product-card');
    expect(cards.length).toBe(2);
  });

  it('should render category filter buttons', () => {
    const buttons = fixture.nativeElement.querySelectorAll('.product-list__category-btn');
    expect(buttons.length).toBe(3); // All + Electronics + Furniture
  });

  it('should show an error when products fail to load', () => {
    productServiceSpy.getProducts.and.returnValue(throwError(() => new Error('offline')));
    component.filterByCategory('Furniture');
    expect(notificationSpy.error).toHaveBeenCalledWith('Failed to load products');
  });
});
