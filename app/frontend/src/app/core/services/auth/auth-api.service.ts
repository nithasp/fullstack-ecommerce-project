import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthUser, AuthResponse, RefreshResponse } from '../../models/auth.model';
import { API } from '../../config/api-config';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly baseUrl = `${API.baseUrl}/auth`;

  constructor(private http: HttpClient) {}

  login(username: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/login`, { username, password });
  }

  register(username: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/register`, { username, password });
  }

  refresh(refreshToken: string): Observable<RefreshResponse> {
    return this.http.post<RefreshResponse>(`${this.baseUrl}/refresh`, { refreshToken });
  }

  logout(refreshToken: string): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/logout`, { refreshToken });
  }

  fetchMe(): Observable<AuthUser> {
    return this.http.get<AuthUser>(`${this.baseUrl}/me`);
  }
}
