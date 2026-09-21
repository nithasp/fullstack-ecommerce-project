import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ProductService } from './product.service';

describe('ProductService', () => {
  let service: ProductService;
  let httpMock: HttpTestingController;

  const API = 'http://localhost:3000/api/v1/products';

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

  it('should fetch one page of products with the total from the backend API', () => {
    service.getProducts({ limit: 12, offset: 0 }).subscribe(page => {
      expect(page.items.length).toBe(2);
      expect(page.items[0].name).toBe('Product 1');
      expect(page.items[1].id).toBe(2);
      expect(page.total).toBe(30);
    });

    const req = httpMock.expectOne(r => r.url === API);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('limit')).toBe('12');
    expect(req.request.params.get('offset')).toBe('0');
    expect(req.request.params.has('category')).toBeFalse();
    expect(req.request.params.has('search')).toBeFalse();
    req.flush({ status: 200, message: 'ok', data: mockProducts, meta: { limit: 12, offset: 0, total: 30 } });
  });

  it('should send the category and search filters to the server', () => {
    service.getProducts({ limit: 12, offset: 24, category: 'Electronics', search: 'head' }).subscribe();

    const req = httpMock.expectOne(r => r.url === API);
    expect(req.request.params.get('offset')).toBe('24');
    expect(req.request.params.get('category')).toBe('Electronics');
    expect(req.request.params.get('search')).toBe('head');
    req.flush({ status: 200, message: 'ok', data: [], meta: { limit: 12, offset: 24, total: 0 } });
  });

  it('should fetch every category', () => {
    service.getCategories().subscribe(categories => {
      expect(categories).toEqual(['Electronics', 'Furniture']);
    });

    const req = httpMock.expectOne(`${API}/categories`);
    expect(req.request.method).toBe('GET');
    req.flush({ status: 200, message: 'ok', data: ['Electronics', 'Furniture'] });
  });

  it('should find a product by ID', () => {
    service.getProductById('2').subscribe(product => {
      expect(product).toBeTruthy();
      expect(product.name).toBe('Product 2');
      expect(product.price).toBe(199.99);
      expect(product.id).toBe(2);
    });

    const req = httpMock.expectOne(`${API}/2`);
    expect(req.request.method).toBe('GET');
    req.flush({ status: 200, message: 'ok', data: mockProducts[1] });
  });
});
