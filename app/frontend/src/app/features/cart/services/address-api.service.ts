import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { AddressEntry, AddressForm } from '../models/address.model';
import { ApiResponse } from '../../../core/models/api.model';
import { API } from '../../../core/config/api-config';

@Injectable({ providedIn: 'root' })
export class AddressApiService {
  private readonly baseUrl = `${API.baseUrl}/addresses`;

  constructor(private http: HttpClient) {}

  getAddresses(): Observable<AddressEntry[]> {
    return this.http
      .get<ApiResponse<AddressEntry[]>>(this.baseUrl)
      .pipe(map(res => res.data));
  }

  getAddress(id: number): Observable<AddressEntry> {
    return this.http
      .get<ApiResponse<AddressEntry>>(`${this.baseUrl}/${id}`)
      .pipe(map(res => res.data));
  }

  createAddress(form: AddressForm): Observable<AddressEntry> {
    return this.http
      .post<ApiResponse<AddressEntry>>(this.baseUrl, form)
      .pipe(map(res => res.data));
  }

  updateAddress(id: number, form: Partial<AddressForm>): Observable<AddressEntry> {
    return this.http
      .put<ApiResponse<AddressEntry>>(`${this.baseUrl}/${id}`, form)
      .pipe(map(res => res.data));
  }

  deleteAddress(id: number): Observable<AddressEntry> {
    return this.http
      .delete<ApiResponse<AddressEntry>>(`${this.baseUrl}/${id}`)
      .pipe(map(res => res.data));
  }
}
