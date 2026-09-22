import { Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { NavigationEnd, Router } from '@angular/router';
import { catchError, EMPTY, filter, mergeMap, Subscription } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { QUIET_ERRORS } from '../../interceptors/auth.interceptor';
import { API } from '../../config/api-config';

export interface PageViewReport {
  path: string;
  page?: string;
}

/**
 * Tells the backend which page of the app a signed-in user opens, so it shows up in the admin
 * Activity Log. Each route names its page in `data.page`. Reports are sent in the background:
 * one that fails is dropped without bothering the user, since it only feeds the log.
 */
@Injectable({ providedIn: 'root' })
export class PageViewService {
  private readonly baseUrl = `${API.baseUrl}/page-views`;

  constructor(
    private http: HttpClient,
    private router: Router,
    private authService: AuthService
  ) {}

  // Called once, from AppComponent
  trackPageViews(): Subscription {
    return this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      // Pages seen while signed out can't be reported: the endpoint needs a token
      filter(() => this.authService.isLoggedIn),
      mergeMap((event) =>
        this.http
          .post(this.baseUrl, this.reportFor(event.urlAfterRedirects), { context: new HttpContext().set(QUIET_ERRORS, true) })
          .pipe(catchError(() => EMPTY))
      )
    ).subscribe();
  }

  // The path without its query string or fragment, and the name the deepest matched route gives its page
  private reportFor(url: string): PageViewReport {
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) route = route.firstChild;

    const page: string | undefined = route.data['page'];
    return { path: url.split(/[?#]/)[0], ...(page ? { page } : {}) };
  }
}
