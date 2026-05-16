import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ToastrModule } from 'ngx-toastr';
import { of } from 'rxjs';
import { ProductDetailComponent } from './product-detail.component';
import { ProductService } from '../services/product.service';
import { CartService } from '../../../core/services/cart/cart.service';
import { NotificationService } from '../../../core/services/ui/notification.service';
import { Product } from '../models/product.model';

describe('ProductDetailComponent', () => {
  let component: ProductDetailComponent;
  let fixture: ComponentFixture<ProductDetailComponent>;
  let productServiceSpy: jasmine.SpyObj<ProductService>;
  let cartService: CartService;
  let notificationSpy: jasmine.SpyObj<NotificationService>;

  const mockProduct: Product = {
    id: 1,
    name: 'Test Headphones',
    category: 'Electronics',
    price: 79.99,
    image: 'https://example.com/main.jpg',
    description: 'Premium wireless headphones',
    previewImg: ['https://example.com/main.jpg', 'https://example.com/side.jpg'],
    types: [
      { _id: 't1', productId: 1001, color: 'Black', quantity: 50, price: 79.99, stock: 50, image: 'https://example.com/black.jpg' },
      { _id: 't2', productId: 1002, color: 'Silver', quantity: 35, price: 84.99, stock: 35, image: 'https://example.com/silver.jpg' }
    ],
    reviews: [
      { star: 5, comment: 'Great product!', userName: 'John' },
      { star: 4, comment: 'Good value', userName: 'Jane' }
    ],
    overallRating: 4.5,
    stock: 85
  };

  beforeEach(async () => {
    productServiceSpy = jasmine.createSpyObj('ProductService', ['getProductById']);
    productServiceSpy.getProductById.and.returnValue(of(mockProduct));
    notificationSpy = jasmine.createSpyObj('NotificationService', ['success', 'error', 'info', 'warning']);

    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        ToastrModule.forRoot()
      ],
      declarations: [ProductDetailComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: ProductService, useValue: productServiceSpy },
        { provide: NotificationService, useValue: notificationSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'prod1' } } } },
        CartService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProductDetailComponent);
    component = fixture.componentInstance;
    cartService = TestBed.inject(CartService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load product on init', () => {
    expect(productServiceSpy.getProductById).toHaveBeenCalledWith('prod1');
    expect(component.product).toBeTruthy();
    expect(component.product?.name).toBe('Test Headphones');
    expect(component.loading).toBeFalse();
  });

  it('should set selectedImage to product image', () => {
    expect(component.selectedImage).toBe('https://example.com/main.jpg');
  });

  it('should not auto-select type when multiple types exist', () => {
    // With 2 types the component leaves selectedType undefined until user picks one
    expect(component.selectedType).toBeUndefined();
  });

  it('should change selected image', () => {
    component.selectImage('https://example.com/side.jpg');
    expect(component.selectedImage).toBe('https://example.com/side.jpg');
  });

  it('should change selected type and update image', () => {
    component.selectType(mockProduct.types[1]);
    expect(component.selectedType?.color).toBe('Silver');
    expect(component.selectedImage).toBe('https://example.com/silver.jpg');
  });

  it('should update currentPrice based on selectedType', () => {
    // No type selected → falls back to product price
    expect(component.currentPrice).toBe(79.99);
    component.selectType(mockProduct.types[1]);
    expect(component.currentPrice).toBe(84.99);
  });

  it('should update selectedQuantity via onQuantityChange', () => {
    component.onQuantityChange(5);
    expect(component.selectedQuantity).toBe(5);
  });

  it('should add product to cart', fakeAsync(() => {
    spyOn(cartService, 'addToCartLocal');
    component.selectedQuantity = 2;
    component.addToCart();
    expect(cartService.addToCartLocal).toHaveBeenCalledWith(
      component.product!, 2, component.selectedType
    );
    // Success notification fires after the 400ms debounce
    tick(400);
    expect(notificationSpy.success).toHaveBeenCalled();
  }));

  it('should display product name', () => {
    const name = fixture.nativeElement.querySelector('.product-detail__name');
    expect(name.textContent).toContain('Test Headphones');
  });

  it('should display product description', () => {
    const desc = fixture.nativeElement.querySelector('.product-detail__description');
    expect(desc.textContent).toContain('Premium wireless headphones');
  });

  it('should display product price', () => {
    const price = fixture.nativeElement.querySelector('.product-detail__price');
    expect(price.textContent).toContain('79.99');
  });

  it('should display product image', () => {
    const img = fixture.nativeElement.querySelector('.product-detail__main-image');
    expect(img.src).toContain('example.com/main.jpg');
  });

  it('should display reviews', () => {
    const reviews = fixture.nativeElement.querySelectorAll('.product-detail__review');
    expect(reviews.length).toBe(2);
  });

  it('should display color type options', () => {
    const typeButtons = fixture.nativeElement.querySelectorAll('.product-detail__type-btn');
    expect(typeButtons.length).toBe(2);
  });
});
