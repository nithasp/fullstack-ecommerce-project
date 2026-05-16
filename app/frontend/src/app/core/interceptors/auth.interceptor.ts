import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  BehaviorSubject,
  catchError,
  filter,
  map,
  switchMap,
  take,
  throwError,
} from 'rxjs';

import { AuthService } from '../services/auth/auth.service';
import { NotificationService } from '../services/ui/notification.service';
import { ApiResponse } from '../models/api.model';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

function isApiEnvelope(body: unknown): body is ApiResponse<unknown> {
  return (
    body !== null &&
    typeof body === 'object' &&
    'status' in body &&
    'message' in body &&
    'data' in body
  );
}

function addToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

function isAuthEndpoint(url: string): boolean {
  return url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/refresh');
}

function extractMessage(error: HttpErrorResponse): string {
  return error.error?.message || error.message || 'An unexpected error occurred.';
}

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const notification = inject(NotificationService);

  const token = isAuthEndpoint(req.url) ? null : authService.getAccessToken();
  const authReq = token ? addToken(req, token) : req;

  return next(authReq).pipe(
    map((event: HttpEvent<unknown>) => {
      if (event instanceof HttpResponse && isApiEnvelope(event.body)) {
        return event.clone({ body: event.body.data });
      }
      return event;
    }),
    catchError((error: HttpErrorResponse) =>
      handleError(error, authReq, next, authService, router, notification)
    )
  );
};

function handleError(
  error: HttpErrorResponse,
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService,
  router: Router,
  notification: NotificationService
) {
  if (error.status === 0) {
    notification.error('Cannot reach the server. Please check your connection.');
    return throwError(() => new Error('Cannot reach the server.'));
  }

  if (error.status === 401) {
    if (isAuthEndpoint(req.url)) {
      return throwError(() => new Error(extractMessage(error)));
    }
    if (error.error?.code === 'token_expired') {
      return handle401Refresh(req, next, authService, router, notification);
    }
    authService.clearSession();
    notification.error('Your session is invalid. Please log in again.');
    router.navigate(['/auth/login']);
    return throwError(() => new Error(extractMessage(error)));
  }

  if (error.status === 403) {
    notification.error('You do not have permission to perform this action.');
    return throwError(() => new Error(extractMessage(error)));
  }

  if (error.status === 429) {
    notification.error('Too many requests. Please wait a moment and try again.');
    return throwError(() => new Error(extractMessage(error)));
  }

  if (error.status >= 500) {
    notification.error('A server error occurred. Please try again later.');
    return throwError(() => new Error(extractMessage(error)));
  }

  return throwError(() => new Error(extractMessage(error)));
}

function handle401Refresh(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService,
  router: Router,
  notification: NotificationService
) {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    return authService.refreshAccessToken().pipe(
      switchMap((tokens) => {
        isRefreshing = false;
        refreshTokenSubject.next(tokens.accessToken);
        return next(addToken(req, tokens.accessToken));
      }),
      catchError((err) => {
        isRefreshing = false;
        refreshTokenSubject.next(null);
        authService.clearSession();
        notification.error('Your session has expired. Please log in again.');
        router.navigate(['/auth/login']);
        return throwError(() => err);
      })
    );
  }

  return refreshTokenSubject.pipe(
    filter((token): token is string => token !== null),
    take(1),
    switchMap((token) => next(addToken(req, token)))
  );
}
