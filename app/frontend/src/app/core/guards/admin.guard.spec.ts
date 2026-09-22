import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { firstValueFrom, Observable, of } from 'rxjs';
import { adminGuard } from './admin.guard';
import { AuthService } from '../services/auth/auth.service';
import { AuthUser, UserRole } from '../models/auth.model';

describe('adminGuard', () => {
  let currentUser: AuthUser | null;

  const userWithRole = (role: UserRole): AuthUser =>
    ({ id: 1, username: 'someone', firstName: 'Some', lastName: 'One', role });

  const runGuard = (): Promise<boolean | UrlTree> =>
    firstValueFrom(TestBed.runInInjectionContext(() =>
      adminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    ) as Observable<boolean | UrlTree>);

  beforeEach(() => {
    currentUser = null;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { authInitialized$: of(true), getCurrentUser: () => currentUser } },
      ],
    });
  });

  it('should let an admin through', async () => {
    currentUser = userWithRole('admin');
    expect(await runGuard()).toBeTrue();
  });

  it('should send a customer to the products page', async () => {
    currentUser = userWithRole('customer');
    const result = await runGuard();
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/products');
  });

  it('should leave a signed-out visitor to authGuard', async () => {
    expect(await runGuard()).toBeFalse();
  });
});
