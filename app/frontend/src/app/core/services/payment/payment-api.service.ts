import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import {
  ConfirmPaymentResponse,
  CreatePaymentIntentPayload,
  PaymentConfig,
  PaymentIntentSession,
} from '../../models/payment-api.model';
import { ApiResponse } from '../../models/api.model';
import { API } from '../../config/api-config';

@Injectable({ providedIn: 'root' })
export class PaymentApiService {
  private readonly baseUrl = `${API.baseUrl}/payments`;

  constructor(private http: HttpClient) {}

  getConfig(): Observable<PaymentConfig> {
    return this.http
      .get<ApiResponse<PaymentConfig>>(`${this.baseUrl}/config`)
      .pipe(map(res => res.data));
  }

  createPaymentIntent(payload: CreatePaymentIntentPayload): Observable<PaymentIntentSession> {
    return this.http
      .post<ApiResponse<PaymentIntentSession>>(`${this.baseUrl}/create-intent`, payload)
      .pipe(map(res => res.data));
  }

  confirmPayment(paymentIntentId: string): Observable<ConfirmPaymentResponse> {
    return this.http
      .post<ApiResponse<ConfirmPaymentResponse>>(`${this.baseUrl}/confirm`, { paymentIntentId })
      .pipe(map(res => res.data));
  }
}
