import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { AuthUser, AuthSession } from '../../models/auth.model';
import { ApiResponse } from '../../models/api.model';
import { API } from '../../config/api-config';

// The refresh cookie only travels on calls that send credentials
const WITH_COOKIE = { withCredentials: true };

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly baseUrl = `${API.baseUrl}/auth`;

  constructor(private http: HttpClient) {}

  login(username: string, password: string): Observable<AuthSession> {
    return this.http
      .post<ApiResponse<AuthSession>>(`${this.baseUrl}/login`, { username, password }, WITH_COOKIE)
      .pipe(map(res => res.data));
  }

  register(username: string, password: string): Observable<AuthSession> {
    return this.http
      .post<ApiResponse<AuthSession>>(`${this.baseUrl}/register`, { username, password }, WITH_COOKIE)
      .pipe(map(res => res.data));
  }

  refresh(): Observable<AuthSession> {
    return this.http
      .post<ApiResponse<AuthSession>>(`${this.baseUrl}/refresh`, {}, WITH_COOKIE)
      .pipe(map(res => res.data));
  }

  logout(): Observable<unknown> {
    return this.http
      .post<ApiResponse<null>>(`${this.baseUrl}/logout`, {}, WITH_COOKIE)
      .pipe(map(res => res.data));
  }

  fetchMe(): Observable<AuthUser> {
    return this.http
      .get<ApiResponse<AuthUser>>(`${this.baseUrl}/me`)
      .pipe(map(res => res.data));
  }
}
