import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { PageViewService } from './page-view.service';
import { AuthService } from '../auth/auth.service';
import { QUIET_ERRORS } from '../../interceptors/auth.interceptor';

@Component({ template: '' })
class BlankComponent {}

describe('PageViewService', () => {
  let router: Router;
  let httpMock: HttpTestingController;
  let tracking: Subscription;
  let isLoggedIn: boolean;

  const API = 'http://localhost:3000/api/v1/page-views';

  beforeEach(() => {
    isLoggedIn = true;
    TestBed.configureTestingModule({
      declarations: [BlankComponent],
      providers: [
        provideRouter([
          { path: 'products/:id', component: BlankComponent, data: { page: 'Product detail' } },
          { path: 'cart', component: BlankComponent },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { get isLoggedIn() { return isLoggedIn; } } },
      ],
    });
    router = TestBed.inject(Router);
    httpMock = TestBed.inject(HttpTestingController);
    tracking = TestBed.inject(PageViewService).trackPageViews();
  });

  afterEach(() => {
    tracking.unsubscribe();
    httpMock.verify();
  });

  it('should report the page a signed-in user opens, with its name and without the query string', async () => {
    await router.navigateByUrl('/products/5?ref=home#reviews');

    const req = httpMock.expectOne(API);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ path: '/products/5', page: 'Product detail' });
    expect(req.request.context.get(QUIET_ERRORS)).toBeTrue();
    req.flush({ status: 201, message: 'Page view recorded.', data: null });
  });

  it('should send just the path for a route without a page name', async () => {
    await router.navigateByUrl('/cart');

    const req = httpMock.expectOne(API);
    expect(req.request.body).toEqual({ path: '/cart' });
    req.flush({ status: 201, message: 'Page view recorded.', data: null });
  });

  it('should not report anything while signed out', async () => {
    isLoggedIn = false;
    await router.navigateByUrl('/cart');
    httpMock.expectNone(API);
  });

  it('should keep reporting after a report fails', async () => {
    await router.navigateByUrl('/cart');
    httpMock.expectOne(API).flush(null, { status: 500, statusText: 'Server Error' });

    await router.navigateByUrl('/products/7');
    const req = httpMock.expectOne(API);
    expect(req.request.body).toEqual({ path: '/products/7', page: 'Product detail' });
    req.flush({ status: 201, message: 'Page view recorded.', data: null });
  });
});
