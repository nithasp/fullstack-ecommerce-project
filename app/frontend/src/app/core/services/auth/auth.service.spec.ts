import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { AuthService } from './auth.service';
import { AuthApiService } from './auth-api.service';
import { AuthSession } from '../../models/auth.model';

function jwt(expSeconds: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ exp: expSeconds }));
  return `${header}.${payload}.signature`;
}

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  const API = 'http://localhost:3000/api/v1/auth';

  const mockSession: AuthSession = {
    user: {
      id: 1,
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      role: 'customer',
    },
    accessToken: jwt(9999999999),
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
    it('should POST to /auth/register and start a session', () => {
      service.register('testuser', 'password123').subscribe((res) => {
        expect(res.user.username).toBe('testuser');
        expect(res.accessToken).toBeDefined();
      });

      const req = httpMock.expectOne(`${API}/register`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        username: 'testuser',
        password: 'password123',
      });
      // the refresh cookie only comes back on a call that sends credentials
      expect(req.request.withCredentials).toBeTrue();

      req.flush({ status: 200, message: 'ok', data: mockSession });

      expect(service.getAccessToken()).toBe(mockSession.accessToken);
      expect(service.getCurrentUser()?.username).toBe('testuser');
    });

    it('should emit isLoggedIn$ = true after successful register', () => {
      let loggedIn = false;
      service.isLoggedIn$.subscribe((val) => (loggedIn = val));

      service.register('u', 'p').subscribe();
      httpMock.expectOne(`${API}/register`).flush({ status: 200, message: 'ok', data: mockSession });

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
          { status: 409, message: 'Username already exists', data: null, code: 'conflict' },
          { status: 409, statusText: 'Conflict' }
        );

      expect(errorReceived).toBeTrue();
    });
  });

  // ── Login ──────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('should POST to /auth/login and keep the access token in memory only', () => {
      service.login('testuser', 'password123').subscribe((res) => {
        expect(res.user.username).toBe('testuser');
      });

      const req = httpMock.expectOne(`${API}/login`);
      expect(req.request.method).toBe('POST');
      req.flush({ status: 200, message: 'ok', data: mockSession });

      expect(service.getAccessToken()).toBe(mockSession.accessToken);
      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
    });

    it('should emit isLoggedIn$ = true after successful login', () => {
      let loggedIn = false;
      service.isLoggedIn$.subscribe((val) => (loggedIn = val));

      service.login('u', 'p').subscribe();
      httpMock.expectOne(`${API}/login`).flush({ status: 200, message: 'ok', data: mockSession });

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
          { status: 401, message: 'Invalid username or password', data: null, code: 'invalid_credentials' },
          { status: 401, statusText: 'Unauthorized' }
        );

      expect(errorReceived).toBeTrue();
    });
  });

  // ── Token helpers ──────────────────────────────────────────────────────────

  describe('token helpers', () => {
    it('hasValidToken should return false before a session starts', () => {
      expect(service.hasValidToken()).toBeFalse();
    });

    it('hasValidToken should return true for a non-expired JWT', () => {
      service.login('u', 'p').subscribe();
      httpMock.expectOne(`${API}/login`).flush({ status: 200, message: 'ok', data: mockSession });

      expect(service.hasValidToken()).toBeTrue();
    });

    it('hasValidToken should return false for an expired JWT', () => {
      service.login('u', 'p').subscribe();
      httpMock
        .expectOne(`${API}/login`)
        .flush({ status: 200, message: 'ok', data: { ...mockSession, accessToken: jwt(1000000000) } });

      expect(service.hasValidToken()).toBeFalse();
    });
  });

  // ── Session start ──────────────────────────────────────────────────────────

  describe('initializeAuth', () => {
    it('should not ask the server when no session was cached', () => {
      let settled = false;
      service.initializeAuth().subscribe(() => (settled = true));

      httpMock.expectNone(`${API}/refresh`);
      expect(settled).toBeTrue();
      expect(service.isLoggedIn).toBeFalse();
    });

    it('should renew the session from the cookie when a profile was cached', () => {
      localStorage.setItem('currentUser', JSON.stringify(mockSession.user));

      service.initializeAuth().subscribe();
      const req = httpMock.expectOne(`${API}/refresh`);
      expect(req.request.withCredentials).toBeTrue();
      req.flush({ status: 200, message: 'ok', data: mockSession });

      expect(service.isLoggedIn).toBeTrue();
      expect(service.getAccessToken()).toBe(mockSession.accessToken);
    });

    it('should sign out when the cookie is gone', () => {
      localStorage.setItem('currentUser', JSON.stringify(mockSession.user));

      service.initializeAuth().subscribe();
      httpMock
        .expectOne(`${API}/refresh`)
        .flush({ status: 401, message: 'Invalid or expired refresh token', data: null, code: 'token_invalid' },
          { status: 401, statusText: 'Unauthorized' });

      expect(service.isLoggedIn).toBeFalse();
      expect(localStorage.getItem('currentUser')).toBeNull();
    });
  });

  // ── Refresh ────────────────────────────────────────────────────────────────

  describe('refreshAccessToken', () => {
    it('should POST an empty body and update the token it holds', () => {
      service.refreshAccessToken().subscribe((res) => {
        expect(res.accessToken).toBe(mockSession.accessToken);
      });

      const req = httpMock.expectOne(`${API}/refresh`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      expect(req.request.withCredentials).toBeTrue();

      req.flush({ status: 200, message: 'ok', data: mockSession });

      expect(service.getAccessToken()).toBe(mockSession.accessToken);
    });

    it('should propagate the error when the session is rejected', () => {
      let errorReceived = false;
      service.refreshAccessToken().subscribe({
        error: () => (errorReceived = true),
      });

      httpMock
        .expectOne(`${API}/refresh`)
        .flush(
          { status: 401, message: 'Invalid or expired refresh token', data: null, code: 'token_invalid' },
          { status: 401, statusText: 'Unauthorized' }
        );

      expect(errorReceived).toBeTrue();
    });
  });

  // ── Logout ─────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('should tell the server and drop everything it holds', () => {
      service.login('u', 'p').subscribe();
      httpMock.expectOne(`${API}/login`).flush({ status: 200, message: 'ok', data: mockSession });

      service.logout();

      const req = httpMock.expectOne(`${API}/logout`);
      expect(req.request.withCredentials).toBeTrue();
      req.flush({ status: 200, message: 'ok', data: null });

      expect(service.getAccessToken()).toBeNull();
      expect(localStorage.getItem('currentUser')).toBeNull();
    });

    it('should emit isLoggedIn$ = false after logout', () => {
      let loggedIn = true;
      service.isLoggedIn$.subscribe((val) => (loggedIn = val));

      service.logout();
      httpMock.expectOne(`${API}/logout`).flush({ status: 200, message: 'ok', data: null });

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
      httpMock.expectOne(`${API}/login`).flush({ status: 200, message: 'ok', data: mockSession });

      const user = service.getCurrentUser();
      expect(user?.username).toBe('testuser');
    });
  });
});
