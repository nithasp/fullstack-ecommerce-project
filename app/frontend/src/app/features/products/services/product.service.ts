import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { Product } from '../models/product.model';
import { ApiResponse, Page } from '../../../core/models/api.model';
import { API } from '../../../core/config/api-config';

export interface ProductQuery {
  limit: number;
  offset: number;
  category?: string;
  search?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private readonly baseUrl = `${API.baseUrl}/products`;

  constructor(private http: HttpClient) {}

  // Filtering happens on the server, so a page only ever holds matching products
  getProducts(query: ProductQuery): Observable<Page<Product>> {
    let params = new HttpParams().set('limit', query.limit).set('offset', query.offset);
    if (query.category) params = params.set('category', query.category);
    if (query.search) params = params.set('search', query.search);

    return this.http
      .get<ApiResponse<Product[]>>(this.baseUrl, { params })
      .pipe(map(res => ({ items: res.data, total: res.meta?.total ?? res.data.length })));
  }

  // Every category in the catalog, not just the ones on the current page
  getCategories(): Observable<string[]> {
    return this.http
      .get<ApiResponse<string[]>>(`${this.baseUrl}/categories`)
      .pipe(map(res => res.data));
  }

  getProductById(id: string): Observable<Product> {
    return this.http
      .get<ApiResponse<Product>>(`${this.baseUrl}/${id}`)
      .pipe(map(res => res.data));
  }
}
