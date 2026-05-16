import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ProductService } from './product.service';

describe('ProductService', () => {
  let service: ProductService;
  let httpMock: HttpTestingController;

  const mockProducts = [
    {
      id: 1,
      name: 'Product 1',
      category: 'Electronics',
      price: 99.99,
      image: 'https://example.com/img1.jpg',
      description: 'First product',
      previewImg: [],
      types: [],
      reviews: [],
      overallRating: 4.5
    },
    {
      id: 2,
      name: 'Product 2',
      category: 'Furniture',
      price: 199.99,
      image: 'https://example.com/img2.jpg',
      description: 'Second product',
      previewImg: [],
      types: [],
      reviews: [],
      overallRating: 5
    }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ProductService]
    });
    service = TestBed.inject(ProductService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch products from the backend API', () => {
    service.getProducts().subscribe(products => {
      expect(products.length).toBe(2);
      expect(products[0].name).toBe('Product 1');
      expect(products[1].name).toBe('Product 2');
      expect(products[0].id).toBe(1);
      expect(products[1].id).toBe(2);
    });

    const req = httpMock.expectOne('http://localhost:3000/products');
    expect(req.request.method).toBe('GET');
    req.flush(mockProducts);
  });

  it('should find a product by ID', () => {
    service.getProductById('2').subscribe(product => {
      expect(product).toBeTruthy();
      expect(product.name).toBe('Product 2');
      expect(product.price).toBe(199.99);
      expect(product.id).toBe(2);
    });

    const req = httpMock.expectOne('http://localhost:3000/products/2');
    expect(req.request.method).toBe('GET');
    req.flush(mockProducts[1]);
  });
});
