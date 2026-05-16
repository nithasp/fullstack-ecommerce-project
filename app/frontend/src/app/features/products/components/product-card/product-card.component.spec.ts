import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ProductCardComponent } from './product-card.component';
import { TruncatePipe } from '../../../../shared/pipes/truncate.pipe';
import { Product } from '../../models/product.model';

describe('ProductCardComponent', () => {
  let component: ProductCardComponent;
  let fixture: ComponentFixture<ProductCardComponent>;

  const mockProduct: Product = {
    id: 1,
    name: 'Test Headphones',
    category: 'Electronics',
    price: 79.99,
    image: 'https://example.com/img.jpg',
    description: 'Premium wireless headphones with noise cancellation',
    previewImg: ['https://example.com/img.jpg'],
    types: [
      {
        productId: 1001,
        color: 'Black',
        quantity: 50,
        price: 79.99,
        stock: 50,
        image: 'https://example.com/img.jpg'
      }
    ],
    reviews: [{ star: 5, comment: 'Great!' }],
    overallRating: 4.5
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      declarations: [ProductCardComponent, TruncatePipe]
    }).compileComponents();

    fixture = TestBed.createComponent(ProductCardComponent);
    component = fixture.componentInstance;
    component.product = mockProduct;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should receive product via @Input', () => {
    expect(component.product.name).toBe('Test Headphones');
    expect(component.product.price).toBe(79.99);
  });

  it('should display product name', () => {
    const name = fixture.nativeElement.querySelector('.product-card__name');
    expect(name.textContent).toContain('Test Headphones');
  });

  it('should display product price', () => {
    const price = fixture.nativeElement.querySelector('.product-card__price');
    expect(price.textContent).toContain('79.99');
  });

  it('should display product image', () => {
    const img = fixture.nativeElement.querySelector('.product-card__image');
    expect(img.src).toContain('example.com/img.jpg');
  });

  it('should display product category', () => {
    const category = fixture.nativeElement.querySelector('.product-card__category');
    expect(category.textContent).toContain('Electronics');
  });

  it('should generate 5 rating stars', () => {
    expect(component.ratingStars.length).toBe(5);
    expect(component.ratingStars).toEqual([1, 2, 3, 4, 5]);
  });

  it('should have a link to product detail page', () => {
    const link = fixture.nativeElement.querySelector('.product-card__image-link');
    expect(link.getAttribute('href')).toContain('/products/1');
  });
});
