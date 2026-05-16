import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { AuthApiService } from './auth-api.service';
import { AuthUser, AuthResponse, RefreshResponse } from '../../models/auth.model';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_KEY = 'currentUser';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private loggedInSubject = new BehaviorSubject<boolean>(false);
  isLoggedIn$ = this.loggedInSubject.asObservable();

  private currentUserSubject = new BehaviorSubject<AuthUser | null>(this.getCachedUser());
  currentUser$ = this.currentUserSubject.asObservable();

  /** Emits once when the initial auth check is complete. Guards wait on this. */
  private initializedSubject = new BehaviorSubject<boolean>(false);
  authInitialized$ = this.initializedSubject.asObservable();

  constructor(private authApi: AuthApiService) {}

  /**
   * Validates the current session (refreshing if needed) and settles
   * `isLoggedIn$` and `authInitialized$` before the app renders content.
   * Called from AppComponent.ngOnInit.
   */
  initializeAuth(): Observable<void> {
    if (this.hasValidToken()) {
      this.loggedInSubject.next(true);
      this.initializedSubject.next(true);
      return of(undefined);
    }

    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      return this.authApi.refresh(refreshToken).pipe(
        tap((res) => this.storeRefreshedTokens(res)),
        map(() => undefined),
        catchError(() => {
          this.clearSession();
          return of(undefined);
        }),
        tap(() => this.initializedSubject.next(true))
      );
    }

    this.loggedInSubject.next(false);
    this.initializedSubject.next(true);
    return of(undefined);
  }

  hasValidToken(): boolean {
    const token = this.getAccessToken();
    if (!token) return false;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      const header = JSON.parse(atob(parts[0]));
      if (!header.alg || !header.typ) return false;
      const payload = JSON.parse(atob(parts[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  private getCachedUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }

  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUserSubject.getValue();
  }

  get isLoggedIn(): boolean {
    return this.loggedInSubject.getValue();
  }

  fetchCurrentUser(): Observable<AuthUser> {
    return this.authApi.fetchMe().pipe(
      tap((user) => {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        this.currentUserSubject.next(user);
      })
    );
  }

  private storeSession(response: AuthResponse): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    this.loggedInSubject.next(true);
    this.currentUserSubject.next(response.user);
  }

  private storeRefreshedTokens(response: RefreshResponse): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
    this.loggedInSubject.next(true);
  }

  register(username: string, password: string): Observable<AuthResponse> {
    return this.authApi.register(username, password).pipe(tap((res) => this.storeSession(res)));
  }

  login(username: string, password: string): Observable<AuthResponse> {
    return this.authApi.login(username, password).pipe(tap((res) => this.storeSession(res)));
  }

  refreshAccessToken(): Observable<RefreshResponse> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }
    return this.authApi.refresh(refreshToken).pipe(tap((res) => this.storeRefreshedTokens(res)));
  }

  logout(): void {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      this.authApi.logout(refreshToken).subscribe({ error: () => {} });
    }
    this.clearSession();
  }

  /** Wipe local session without notifying the backend (use when token is already invalid). */
  clearSession(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.loggedInSubject.next(false);
    this.currentUserSubject.next(null);
  }
}
