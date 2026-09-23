import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { AuthApiService } from './auth-api.service';
import { AuthUser, AuthSession } from '../../models/auth.model';

const USER_KEY = 'currentUser';

@Injectable({ providedIn: 'root' })
export class AuthService {
  /**
   * The access token is kept in memory only. The session itself lives in an HttpOnly cookie that
   * JavaScript cannot read, so a script injected into the page cannot walk off with it.
   */
  private accessToken: string | null = null;

  private loggedInSubject = new BehaviorSubject<boolean>(false);
  isLoggedIn$ = this.loggedInSubject.asObservable();

  private currentUserSubject = new BehaviorSubject<AuthUser | null>(this.getCachedUser());
  currentUser$ = this.currentUserSubject.asObservable();

  /** Emits once when the initial auth check is complete. Guards wait on this. */
  private initializedSubject = new BehaviorSubject<boolean>(false);
  authInitialized$ = this.initializedSubject.asObservable();

  constructor(private authApi: AuthApiService) {}

  /**
   * A reload wipes the access token, so the cookie is asked for a new one before the app renders.
   * The cached profile only says whether a session is worth asking about; the server decides.
   */
  initializeAuth(): Observable<void> {
    if (!this.getCachedUser()) {
      this.loggedInSubject.next(false);
      this.initializedSubject.next(true);
      return of(undefined);
    }

    return this.authApi.refresh().pipe(
      tap((session) => this.storeSession(session)),
      map(() => undefined),
      catchError(() => {
        this.clearSession();
        return of(undefined);
      }),
      tap(() => this.initializedSubject.next(true)),
    );
  }

  hasValidToken(): boolean {
    const token = this.accessToken;
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
    return this.accessToken;
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUserSubject.getValue();
  }

  get isLoggedIn(): boolean {
    return this.loggedInSubject.getValue();
  }

  fetchCurrentUser(): Observable<AuthUser> {
    return this.authApi.fetchMe().pipe(tap((user) => this.cacheUser(user)));
  }

  private cacheUser(user: AuthUser): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  private storeSession(session: AuthSession): void {
    this.accessToken = session.accessToken;
    this.cacheUser(session.user);
    this.loggedInSubject.next(true);
  }

  register(username: string, password: string): Observable<AuthSession> {
    return this.authApi.register(username, password).pipe(tap((session) => this.storeSession(session)));
  }

  login(username: string, password: string): Observable<AuthSession> {
    return this.authApi.login(username, password).pipe(tap((session) => this.storeSession(session)));
  }

  refreshAccessToken(): Observable<AuthSession> {
    return this.authApi.refresh().pipe(tap((session) => this.storeSession(session)));
  }

  logout(): void {
    this.authApi.logout().subscribe({ error: () => {} });
    this.clearSession();
  }

  /** Wipe the local session without notifying the backend (use when the session is already gone). */
  clearSession(): void {
    this.accessToken = null;
    localStorage.removeItem(USER_KEY);
    this.loggedInSubject.next(false);
    this.currentUserSubject.next(null);
  }
}
