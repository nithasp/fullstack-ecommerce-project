import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { Product } from '../models/product.model';
import { ApiResponse } from '../../../core/models/api.model';
import { API } from '../../../core/config/api-config';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private readonly baseUrl = `${API.baseUrl}/products`;

  constructor(private http: HttpClient) {}

  getProducts(): Observable<Product[]> {
    return this.http
      .get<ApiResponse<Product[]>>(this.baseUrl)
      .pipe(map(res => res.data));
  }

  getProductById(id: string): Observable<Product> {
    return this.http
      .get<ApiResponse<Product>>(`${this.baseUrl}/${id}`)
      .pipe(map(res => res.data));
  }
}
