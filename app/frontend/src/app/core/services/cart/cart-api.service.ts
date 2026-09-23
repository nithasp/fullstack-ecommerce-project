import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { CartApiItem, AddCartItemPayload, CheckoutResponse } from '../../models/cart-api.model';
import { ApiResponse } from '../../models/api.model';
import { API } from '../../config/api-config';

@Injectable({ providedIn: 'root' })
export class CartApiService {
  private readonly baseUrl = `${API.baseUrl}/cart`;

  constructor(private http: HttpClient) {}

  getCart(): Observable<CartApiItem[]> {
    return this.http
      .get<ApiResponse<CartApiItem[]>>(this.baseUrl)
      .pipe(map(res => res.data));
  }

  addItem(payload: AddCartItemPayload): Observable<CartApiItem> {
    return this.http
      .post<ApiResponse<CartApiItem>>(this.baseUrl, payload)
      .pipe(map(res => res.data));
  }

  updateItem(cartItemId: number, quantity: number): Observable<CartApiItem> {
    return this.http
      .patch<ApiResponse<CartApiItem>>(`${this.baseUrl}/${cartItemId}`, { quantity })
      .pipe(map(res => res.data));
  }

  removeItem(cartItemId: number): Observable<CartApiItem> {
    return this.http
      .delete<ApiResponse<CartApiItem>>(`${this.baseUrl}/${cartItemId}`)
      .pipe(map(res => res.data));
  }

  clearCart(): Observable<null> {
    return this.http
      .delete<ApiResponse<null>>(this.baseUrl)
      .pipe(map(res => res.data));
  }

  // The server charges for the cart rows themselves, at the price and stock it holds for them
  checkout(cartItemIds: number[]): Observable<CheckoutResponse> {
    return this.http
      .post<ApiResponse<CheckoutResponse>>(`${this.baseUrl}/checkout`, { cartItemIds })
      .pipe(map(res => res.data));
  }
}
