import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CartApiItem, AddCartItemPayload, CheckoutItem, CheckoutResponse } from '../../models/cart-api.model';
import { API } from '../../config/api-config';

@Injectable({ providedIn: 'root' })
export class CartApiService {
  private readonly baseUrl = `${API.baseUrl}/cart`;

  constructor(private http: HttpClient) {}

  getCart(): Observable<CartApiItem[]> {
    return this.http.get<CartApiItem[]>(this.baseUrl);
  }

  addItem(payload: AddCartItemPayload): Observable<CartApiItem> {
    return this.http.post<CartApiItem>(this.baseUrl, payload);
  }

  updateItem(cartItemId: number, quantity: number): Observable<CartApiItem> {
    return this.http.put<CartApiItem>(`${this.baseUrl}/${cartItemId}`, { quantity });
  }

  removeItem(cartItemId: number): Observable<CartApiItem> {
    return this.http.delete<CartApiItem>(`${this.baseUrl}/${cartItemId}`);
  }

  clearCart(): Observable<null> {
    return this.http.delete<null>(this.baseUrl);
  }

  checkout(items: CheckoutItem[]): Observable<CheckoutResponse> {
    return this.http.post<CheckoutResponse>(`${this.baseUrl}/checkout`, { items });
  }
}
