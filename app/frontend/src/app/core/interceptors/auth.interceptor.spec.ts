import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { authInterceptor, QUIET_ERRORS } from './auth.interceptor';
import { AuthService } from '../services/auth/auth.service';
import { NotificationService } from '../services/ui/notification.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let notificationSpy: jasmine.SpyObj<NotificationService>;

  beforeEach(() => {
    notificationSpy = jasmine.createSpyObj('NotificationService', ['success', 'error', 'info', 'warning']);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: { getAccessToken: () => 'access-token' } },
        { provide: NotificationService, useValue: notificationSpy },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should attach the access token', () => {
    http.get('/api/v1/cart').subscribe();
    const req = httpMock.expectOne('/api/v1/cart');
    expect(req.request.headers.get('Authorization')).toBe('Bearer access-token');
    req.flush({});
  });

  it('should tell the user when a call fails on the server', () => {
    http.get('/api/v1/cart').subscribe({ error: () => {} });
    httpMock.expectOne('/api/v1/cart').flush(null, { status: 500, statusText: 'Server Error' });
    expect(notificationSpy.error).toHaveBeenCalledWith('A server error occurred. Please try again later.');
  });

  it('should let a quiet background call fail without telling the user', () => {
    let failed = false;
    http.post('/api/v1/page-views', { path: '/cart' }, { context: new HttpContext().set(QUIET_ERRORS, true) })
      .subscribe({ error: () => (failed = true) });
    httpMock.expectOne('/api/v1/page-views').flush(null, { status: 500, statusText: 'Server Error' });

    expect(failed).toBeTrue();
    expect(notificationSpy.error).not.toHaveBeenCalled();
  });
});
