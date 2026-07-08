import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { AuthUser, AuthResponse, RefreshResponse } from '../../models/auth.model';
import { ApiResponse } from '../../models/api.model';
import { API } from '../../config/api-config';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly baseUrl = `${API.baseUrl}/auth`;

  constructor(private http: HttpClient) {}

  login(username: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${this.baseUrl}/login`, { username, password })
      .pipe(map(res => res.data));
  }

  register(username: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${this.baseUrl}/register`, { username, password })
      .pipe(map(res => res.data));
  }

  refresh(refreshToken: string): Observable<RefreshResponse> {
    return this.http
      .post<ApiResponse<RefreshResponse>>(`${this.baseUrl}/refresh`, { refreshToken })
      .pipe(map(res => res.data));
  }

  logout(refreshToken: string): Observable<unknown> {
    return this.http
      .post<ApiResponse<null>>(`${this.baseUrl}/logout`, { refreshToken })
      .pipe(map(res => res.data));
  }

  fetchMe(): Observable<AuthUser> {
    return this.http
      .get<ApiResponse<AuthUser>>(`${this.baseUrl}/me`)
      .pipe(map(res => res.data));
  }
}
