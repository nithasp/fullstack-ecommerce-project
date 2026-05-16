import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, filter, map, of, switchMap, take } from 'rxjs';
import { AuthService } from '../services/auth/auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wait for initializeAuth() to settle before evaluating access.
  // On the initial page load this unblocks as soon as AppComponent
  // finishes the auth check; on subsequent in-session navigations
  // authInitialized$ already holds true so it passes through instantly.
  return authService.authInitialized$.pipe(
    filter(initialized => initialized),
    take(1),
    switchMap(() => {
      if (authService.hasValidToken()) return of(true);

      if (authService.getRefreshToken()) {
        return authService.refreshAccessToken().pipe(
          map(() => true),
          catchError(() => {
            authService.clearSession();
            router.navigate(['/auth/login']);
            return of(false);
          })
        );
      }

      router.navigate(['/auth/login']);
      return of(false);
    })
  );
};
