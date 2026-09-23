import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { PageViewsComponent, PAGE_VIEWS_PAGE_SIZE, USER_FILTER_DEBOUNCE_MS } from './page-views.component';
import { PageViewApiService } from '../services/page-view-api.service';
import { NotificationService } from '../../../core/services/ui/notification.service';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { PageView, PageViewQuery } from '../models/page-view.model';

describe('PageViewsComponent', () => {
  let component: PageViewsComponent;
  let fixture: ComponentFixture<PageViewsComponent>;
  let apiSpy: jasmine.SpyObj<PageViewApiService>;
  let notificationSpy: jasmine.SpyObj<NotificationService>;

  const view = (id: number, overrides: Partial<PageView> = {}): PageView => ({
    id,
    createdAt: '2026-09-22T10:42:05.000Z',
    userId: 7,
    username: 'alice',
    path: '/products/5',
    page: 'Product detail',
    ipAddress: '203.0.113.5',
    userAgent: 'Mozilla/5.0',
    ...overrides,
  });

  // What the page asked the API for last
  const lastQuery = (): PageViewQuery => apiSpy.getPageViews.calls.mostRecent().args[0];

  beforeEach(async () => {
    apiSpy = jasmine.createSpyObj('PageViewApiService', ['getPageViews']);
    apiSpy.getPageViews.and.returnValue(of({
      items: [view(1), view(2, { path: '/cart', page: 'Cart' })],
      total: 60,
    }));
    notificationSpy = jasmine.createSpyObj('NotificationService', ['success', 'error', 'info', 'warning']);

    await TestBed.configureTestingModule({
      imports: [FormsModule],
      declarations: [PageViewsComponent, LoadingSpinnerComponent],
      providers: [
        { provide: PageViewApiService, useValue: apiSpy },
        { provide: NotificationService, useValue: notificationSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PageViewsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load the first page', () => {
    expect(lastQuery()).toEqual(jasmine.objectContaining({ limit: PAGE_VIEWS_PAGE_SIZE, offset: 0 }));
    expect(component.total).toBe(60);
  });

  it('should render one row per page view, with its page name and path', () => {
    const rows = fixture.nativeElement.querySelectorAll('.activity-log__row');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('alice');
    expect(rows[0].textContent).toContain('Product detail');
    expect(rows[1].querySelector('.activity-log__route').textContent.trim()).toBe('/cart');
  });

  it('should read a whole number as a user id and any other text as a username', fakeAsync(() => {
    component.onTextFilterChange('user', '7');
    tick(USER_FILTER_DEBOUNCE_MS);
    expect(lastQuery()).toEqual(jasmine.objectContaining({ userId: 7, username: undefined }));

    component.onTextFilterChange('user', 'ali');
    tick(USER_FILTER_DEBOUNCE_MS);
    expect(lastQuery()).toEqual(jasmine.objectContaining({ userId: undefined, username: 'ali' }));
  }));

  it('should filter by path once typing stops', fakeAsync(() => {
    component.onTextFilterChange('path', '/products');
    tick(USER_FILTER_DEBOUNCE_MS);
    expect(lastQuery().path).toBe('/products');
  }));

  it('should turn a chosen day into a range that covers it', () => {
    component.setFilter('from', '2026-09-22');
    expect(lastQuery().from).toBe(new Date('2026-09-22T00:00:00').toISOString());

    component.setFilter('to', '2026-09-22');
    expect(lastQuery().to).toBe(new Date('2026-09-23T00:00:00').toISOString());
  });

  it('should page forward and back', () => {
    component.nextPage();
    expect(lastQuery().offset).toBe(PAGE_VIEWS_PAGE_SIZE);
    component.previousPage();
    expect(lastQuery().offset).toBe(0);
  });

  it('should clear every filter at once', () => {
    component.setFilter('from', '2026-09-22');
    expect(component.hasFilters).toBeTrue();

    component.clearFilters();
    expect(component.hasFilters).toBeFalse();
    expect(lastQuery().from).toBeUndefined();
  });

  it('should show the details of a page view when its row is clicked', () => {
    fixture.nativeElement.querySelector('.activity-log__row').click();
    fixture.detectChanges();

    const details = fixture.nativeElement.querySelector('.activity-log__details');
    expect(details.textContent).toContain('203.0.113.5');
    expect(details.textContent).toContain('Mozilla/5.0');
  });

  it('should tell the admin when the list cannot be loaded', () => {
    apiSpy.getPageViews.and.returnValue(throwError(() => new Error('boom')));
    component.refresh();
    expect(notificationSpy.error).toHaveBeenCalledWith('Failed to load page views');
    expect(component.isLoading).toBeFalse();
  });

  it('should offer a link back to the activity log', () => {
    const tabs = fixture.nativeElement.querySelectorAll('.activity-log__tab');
    expect(tabs.length).toBe(2);
    expect(tabs[0].textContent).toContain('Activity log');
  });
});
