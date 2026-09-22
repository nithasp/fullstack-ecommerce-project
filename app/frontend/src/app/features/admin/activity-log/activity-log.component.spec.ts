import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { ActivityLogComponent, ACTIVITY_PAGE_SIZE, USER_FILTER_DEBOUNCE_MS } from './activity-log.component';
import { HumanizePipe } from '../pipes/humanize.pipe';
import { AuditLogApiService } from '../services/audit-log-api.service';
import { NotificationService } from '../../../core/services/ui/notification.service';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { AuditLog, AuditLogQuery } from '../models/audit-log.model';

describe('ActivityLogComponent', () => {
  let component: ActivityLogComponent;
  let fixture: ComponentFixture<ActivityLogComponent>;
  let apiSpy: jasmine.SpyObj<AuditLogApiService>;
  let notificationSpy: jasmine.SpyObj<NotificationService>;

  const entry = (id: number, overrides: Partial<AuditLog> = {}): AuditLog => ({
    id,
    createdAt: '2026-09-22T10:42:05.000Z',
    userId: 7,
    username: 'alice',
    userRole: 'customer',
    action: 'CREATE',
    event: 'cart.item_added',
    method: 'POST',
    path: '/api/v1/cart',
    statusCode: 201,
    ipAddress: '203.0.113.5',
    userAgent: 'Mozilla/5.0',
    details: { productId: 5, quantity: 2 },
    ...overrides,
  });

  // What the page asked the API for last
  const lastQuery = (): AuditLogQuery => apiSpy.getAuditLogs.calls.mostRecent().args[0];

  beforeEach(async () => {
    apiSpy = jasmine.createSpyObj('AuditLogApiService', ['getAuditLogs']);
    apiSpy.getAuditLogs.and.returnValue(of({
      items: [entry(1), entry(2, { action: 'DELETE', event: 'address.deleted', statusCode: 403 })],
      total: 60,
    }));
    notificationSpy = jasmine.createSpyObj('NotificationService', ['success', 'error', 'info', 'warning']);

    await TestBed.configureTestingModule({
      imports: [FormsModule],
      declarations: [ActivityLogComponent, HumanizePipe, LoadingSpinnerComponent],
      providers: [
        { provide: AuditLogApiService, useValue: apiSpy },
        { provide: NotificationService, useValue: notificationSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ActivityLogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load the first page with page views and API reads hidden', () => {
    expect(lastQuery()).toEqual(jasmine.objectContaining({ limit: ACTIVITY_PAGE_SIZE, offset: 0 }));
    expect(lastQuery().actions?.length).toBe(8);
    expect(lastQuery().actions).not.toContain('READ');
    expect(lastQuery().actions).not.toContain('PAGE_VIEW');
    expect(component.actionOptions).not.toContain('READ');
    expect(component.actionOptions).not.toContain('PAGE_VIEW');
  });

  it('should render one row per entry with who, the type, the event and the result', () => {
    const rows = fixture.nativeElement.querySelectorAll('.activity-log__row');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('#7');
    expect(rows[0].textContent).toContain('alice');
    expect(rows[0].textContent).toContain('Cart item added');
    expect(rows[1].querySelector('.activity-log__badge--delete')).toBeTruthy();
    expect(rows[1].querySelector('.activity-log__result--failed').textContent).toContain('403');
  });

  it('should let each checkbox add its own type, and ask for every type once both are ticked', () => {
    component.setShown('showPageViews', true);
    expect(lastQuery().actions).toContain('PAGE_VIEW');
    expect(lastQuery().actions).not.toContain('READ');

    component.setShown('showApiReads', true);
    expect(lastQuery().actions).toBeUndefined();
    expect(component.actionOptions).toContain('READ');
    expect(component.actionOptions).toContain('PAGE_VIEW');
  });

  it('should drop a type as the chosen one when its checkbox is cleared again', () => {
    component.setShown('showApiReads', true);
    component.setFilter('action', 'READ');
    expect(lastQuery().actions).toEqual(['READ']);

    component.setShown('showApiReads', false);
    expect(component.filters.action).toBe('');
    expect(lastQuery().actions).not.toContain('READ');
  });

  it('should keep the chosen type when the other checkbox changes', () => {
    component.setShown('showPageViews', true);
    component.setFilter('action', 'PAGE_VIEW');
    component.setShown('showApiReads', true);
    component.setShown('showApiReads', false);
    expect(component.filters.action).toBe('PAGE_VIEW');
    expect(lastQuery().actions).toEqual(['PAGE_VIEW']);
  });

  it('should name a page view by its page, with the page path as its route', () => {
    apiSpy.getAuditLogs.and.returnValue(of({
      items: [entry(3, { action: 'PAGE_VIEW', event: 'page.viewed', method: null, path: '/products/5', details: { page: 'Product detail' } })],
      total: 1,
    }));
    component.setShown('showPageViews', true);
    fixture.detectChanges();

    const row = fixture.nativeElement.querySelector('.activity-log__row');
    expect(row.querySelector('.activity-log__badge--page_view').textContent).toContain('PAGE VIEW');
    expect(row.textContent).toContain('Product detail');
    expect(row.querySelector('.activity-log__route').textContent.trim()).toBe('/products/5');
  });

  it('should send a number as a user id and other text as a username, once typing pauses', fakeAsync(() => {
    component.onUserFilterChange('42');
    tick(USER_FILTER_DEBOUNCE_MS);
    expect(lastQuery().userId).toBe(42);
    expect(lastQuery().username).toBeUndefined();

    component.onUserFilterChange('ali');
    tick(USER_FILTER_DEBOUNCE_MS);
    expect(lastQuery().username).toBe('ali');
    expect(lastQuery().userId).toBeUndefined();
  }));

  it('should turn the date range into whole local days', () => {
    component.setFilter('from', '2026-09-01');
    component.setFilter('to', '2026-09-03');
    expect(lastQuery().from).toBe(new Date(2026, 8, 1).toISOString());
    expect(lastQuery().to).toBe(new Date(2026, 8, 4).toISOString());
  });

  it('should page forward and back', () => {
    component.nextPage();
    expect(lastQuery().offset).toBe(ACTIVITY_PAGE_SIZE);
    component.previousPage();
    expect(lastQuery().offset).toBe(0);
  });

  it('should clear every filter at once', () => {
    component.setFilter('result', 'failure');
    component.setShown('showPageViews', true);
    component.setShown('showApiReads', true);
    expect(component.hasFilters).toBeTrue();

    component.clearFilters();
    expect(component.hasFilters).toBeFalse();
    expect(lastQuery().result).toBeUndefined();
  });

  it('should show the details of an entry when its row is clicked', () => {
    fixture.nativeElement.querySelector('.activity-log__row').click();
    fixture.detectChanges();

    const details = fixture.nativeElement.querySelector('.activity-log__details');
    expect(details.textContent).toContain('cart.item_added');
    expect(details.textContent).toContain('203.0.113.5');
    expect(details.textContent).toContain('productId');
  });

  it('should tell the admin when the log cannot be loaded', () => {
    apiSpy.getAuditLogs.and.returnValue(throwError(() => new Error('boom')));
    component.refresh();
    expect(notificationSpy.error).toHaveBeenCalledWith('Failed to load the activity log');
    expect(component.isLoading).toBeFalse();
  });
});
