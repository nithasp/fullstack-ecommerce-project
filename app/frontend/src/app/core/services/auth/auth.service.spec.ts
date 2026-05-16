import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { AuthService } from './auth.service';
import { AuthApiService } from './auth-api.service';
import { AuthResponse, RefreshResponse } from '../../models/auth.model';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  const API = 'http://localhost:3000/auth';

  const mockAuthResponse: AuthResponse = {
    user: {
      id: 1,
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
    },
    accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoxfSwiZXhwIjo5OTk5OTk5OTk5fQ.abc',
    refreshToken: 'refresh_token_mock',
  };

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        AuthApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ── Register ───────────────────────────────────────────────────────────────

  describe('register', () => {
    it('should POST to /auth/register and store tokens', () => {
      service.register('testuser', 'password123').subscribe((res) => {
        expect(res.user.username).toBe('testuser');
        expect(res.accessToken).toBeDefined();
        expect(res.refreshToken).toBeDefined();
      });

      const req = httpMock.expectOne(`${API}/register`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        username: 'testuser',
        password: 'password123',
      });

      req.flush(mockAuthResponse);

      expect(localStorage.getItem('accessToken')).toBe(mockAuthResponse.accessToken);
      expect(localStorage.getItem('refreshToken')).toBe(mockAuthResponse.refreshToken);
    });

    it('should emit isLoggedIn$ = true after successful register', () => {
      let loggedIn = false;
      service.isLoggedIn$.subscribe((val) => (loggedIn = val));

      service.register('u', 'p').subscribe();
      httpMock.expectOne(`${API}/register`).flush(mockAuthResponse);

      expect(loggedIn).toBeTrue();
    });

    it('should propagate error from backend on failure', () => {
      let errorReceived = false;
      service.register('existing', 'pass').subscribe({
        error: () => (errorReceived = true),
      });

      httpMock
        .expectOne(`${API}/register`)
        .flush(
          { error: 'Username already exists' },
          { status: 409, statusText: 'Conflict' }
        );

      expect(errorReceived).toBeTrue();
    });
  });

  // ── Login ──────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('should POST to /auth/login and store tokens', () => {
      service.login('testuser', 'password123').subscribe((res) => {
        expect(res.user.username).toBe('testuser');
      });

      const req = httpMock.expectOne(`${API}/login`);
      expect(req.request.method).toBe('POST');
      req.flush(mockAuthResponse);

      expect(localStorage.getItem('accessToken')).toBe(mockAuthResponse.accessToken);
    });

    it('should emit isLoggedIn$ = true after successful login', () => {
      let loggedIn = false;
      service.isLoggedIn$.subscribe((val) => (loggedIn = val));

      service.login('u', 'p').subscribe();
      httpMock.expectOne(`${API}/login`).flush(mockAuthResponse);

      expect(loggedIn).toBeTrue();
    });

    it('should propagate error from backend on invalid credentials', () => {
      let errorReceived = false;
      service.login('bad', 'creds').subscribe({
        error: () => (errorReceived = true),
      });

      httpMock
        .expectOne(`${API}/login`)
        .flush(
          { error: 'Invalid username or password' },
          { status: 401, statusText: 'Unauthorized' }
        );

      expect(errorReceived).toBeTrue();
    });
  });

  // ── Token helpers ──────────────────────────────────────────────────────────

  describe('token helpers', () => {
    it('hasValidToken should return false when no token stored', () => {
      expect(service.hasValidToken()).toBeFalse();
    });

    it('hasValidToken should return true for a non-expired JWT', () => {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = btoa(JSON.stringify({ exp: 9999999999 }));
      const fakeJwt = `${header}.${payload}.signature`;

      localStorage.setItem('accessToken', fakeJwt);
      expect(service.hasValidToken()).toBeTrue();
    });

    it('hasValidToken should return false for an expired JWT', () => {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = btoa(JSON.stringify({ exp: 1000000000 }));
      const fakeJwt = `${header}.${payload}.signature`;

      localStorage.setItem('accessToken', fakeJwt);
      expect(service.hasValidToken()).toBeFalse();
    });

    it('getAccessToken should return stored token', () => {
      localStorage.setItem('accessToken', 'my_token');
      expect(service.getAccessToken()).toBe('my_token');
    });

    it('getRefreshToken should return stored refresh token', () => {
      localStorage.setItem('refreshToken', 'my_refresh');
      expect(service.getRefreshToken()).toBe('my_refresh');
    });
  });

  // ── Refresh ────────────────────────────────────────────────────────────────

  describe('refreshAccessToken', () => {
    it('should POST refresh token and update stored access token', () => {
      localStorage.setItem('refreshToken', 'old_refresh');

      const refreshResponse: RefreshResponse = {
        accessToken: 'new_access_token',
        refreshToken: 'old_refresh',
      };

      service.refreshAccessToken().subscribe((res) => {
        expect(res.accessToken).toBe('new_access_token');
      });

      const req = httpMock.expectOne(`${API}/refresh`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ refreshToken: 'old_refresh' });

      req.flush(refreshResponse);

      expect(localStorage.getItem('accessToken')).toBe('new_access_token');
    });

    it('should throw when no refresh token is stored', () => {
      let errorMsg = '';
      service.refreshAccessToken().subscribe({
        error: (err: Error) => (errorMsg = err.message),
      });

      expect(errorMsg).toBe('No refresh token available');
    });

    it('should propagate error when refresh token is rejected by backend', () => {
      localStorage.setItem('refreshToken', 'expired_refresh');
      localStorage.setItem('accessToken', 'old_access');

      let errorReceived = false;
      service.refreshAccessToken().subscribe({
        error: () => (errorReceived = true),
      });

      httpMock
        .expectOne(`${API}/refresh`)
        .flush(
          { error: 'Refresh token has expired' },
          { status: 401, statusText: 'Unauthorized' }
        );

      expect(errorReceived).toBeTrue();
    });
  });

  // ── Logout ─────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('should remove all auth data from localStorage', () => {
      localStorage.setItem('accessToken', 'a');
      localStorage.setItem('refreshToken', 'r');
      localStorage.setItem('currentUser', '{}');

      service.logout();

      // Flush the fire-and-forget POST to /auth/logout
      httpMock.expectOne(`${API}/logout`).flush({});

      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
      expect(localStorage.getItem('currentUser')).toBeNull();
    });

    it('should emit isLoggedIn$ = false after logout', () => {
      let loggedIn = true;
      service.isLoggedIn$.subscribe((val) => (loggedIn = val));

      // No refreshToken in localStorage → logout() clears session without HTTP call
      service.logout();

      expect(loggedIn).toBeFalse();
    });
  });

  // ── getCurrentUser ─────────────────────────────────────────────────────────

  describe('getCurrentUser', () => {
    it('should return null when no user is stored', () => {
      expect(service.getCurrentUser()).toBeNull();
    });

    it('should return the stored user after successful login', () => {
      service.login('testuser', 'pass').subscribe();
      httpMock.expectOne(`${API}/login`).flush(mockAuthResponse);

      const user = service.getCurrentUser();
      expect(user?.username).toBe('testuser');
    });
  });
});
