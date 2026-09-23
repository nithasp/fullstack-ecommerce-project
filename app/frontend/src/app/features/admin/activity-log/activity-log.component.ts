import { Component, OnDestroy, OnInit } from '@angular/core';
import { debounceTime, Subject, Subscription } from 'rxjs';
import { AUDIT_ACTIONS, AuditAction, AuditLog, AuditLogQuery, AuditResult } from '../models/audit-log.model';
import { AuditLogApiService } from '../services/audit-log-api.service';
import { NotificationService } from '../../../core/services/ui/notification.service';

export const ACTIVITY_PAGE_SIZE = 25;
export const USER_FILTER_DEBOUNCE_MS = 300;

export interface ActivityFilters {
  user: string; // a user id, or part of a username
  action: AuditAction | '';
  result: AuditResult | '';
  from: string; // yyyy-MM-dd, as a date input gives it
  to: string;
  showApiReads: boolean; // admin views of account data (READ)
}

// The checkbox that lets a high-volume type into the list
export type TypeToggle = 'showApiReads';

const NO_FILTERS: ActivityFilters = {
  user: '', action: '', result: '', from: '', to: '', showApiReads: false,
};

// The moment a local day starts, as ISO 8601; `addDays` moves it forward
function localDayStart(date: string, addDays = 0): string {
  const day = new Date(`${date}T00:00:00`);
  day.setDate(day.getDate() + addDays);
  return day.toISOString();
}

@Component({
  selector: 'app-activity-log',
  templateUrl: './activity-log.component.html',
  styleUrl: './activity-log.component.scss'
})
export class ActivityLogComponent implements OnInit, OnDestroy {
  readonly pageSize = ACTIVITY_PAGE_SIZE;

  logs: AuditLog[] = [];
  total = 0;
  offset = 0;
  isLoading = true;
  filters: ActivityFilters = { ...NO_FILTERS };
  expandedId: number | null = null;

  private readonly userTerms = new Subject<string>();
  private readonly subscriptions = new Subscription();
  private pageRequest?: Subscription;

  constructor(
    private auditLogApi: AuditLogApiService,
    private notificationService: NotificationService
  ) { }

  // Reads outnumber everything else, so they stay hidden until the box is ticked, both from the
  // list and from the type filter
  get actionOptions(): AuditAction[] {
    const { showApiReads } = this.filters;
    return AUDIT_ACTIONS.filter(action => action !== 'READ' || showApiReads);
  }

  get hasFilters(): boolean {
    const { user, action, result, from, to, showApiReads } = this.filters;
    return !!(user.trim() || action || result || from || to || showApiReads);
  }

  get rangeStart(): number {
    return this.logs.length ? this.offset + 1 : 0;
  }

  get rangeEnd(): number {
    return this.offset + this.logs.length;
  }

  get hasPrevious(): boolean {
    return this.offset > 0;
  }

  get hasNext(): boolean {
    return this.offset + this.logs.length < this.total;
  }

  ngOnInit(): void {
    // Typing only reaches the server once the admin pauses
    this.subscriptions.add(
      this.userTerms.pipe(debounceTime(USER_FILTER_DEBOUNCE_MS)).subscribe(() => this.fetchPage(0))
    );

    this.fetchPage(0);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.pageRequest?.unsubscribe();
  }

  onUserFilterChange(term: string): void {
    this.filters = { ...this.filters, user: term };
    this.userTerms.next(term);
  }

  setFilter<K extends 'action' | 'result' | 'from' | 'to'>(key: K, value: ActivityFilters[K]): void {
    this.filters = { ...this.filters, [key]: value };
    this.fetchPage(0);
  }

  // Hiding a type again also clears it if it was the chosen one
  setShown(toggle: TypeToggle, show: boolean): void {
    this.filters = { ...this.filters, [toggle]: show };
    const { action } = this.filters;
    if (action && !this.actionOptions.includes(action)) this.filters = { ...this.filters, action: '' };
    this.fetchPage(0);
  }

  clearFilters(): void {
    this.filters = { ...NO_FILTERS };
    this.fetchPage(0);
  }

  refresh(): void {
    this.fetchPage(this.offset);
  }

  previousPage(): void {
    if (this.hasPrevious) this.fetchPage(Math.max(0, this.offset - this.pageSize));
  }

  nextPage(): void {
    if (this.hasNext) this.fetchPage(this.offset + this.pageSize);
  }

  toggleDetails(id: number): void {
    this.expandedId = this.expandedId === id ? null : id;
  }

  isFailure(log: AuditLog): boolean {
    return (log.statusCode ?? 0) >= 400;
  }

  // The fields an update changed arrive as a list
  detailText(value: string | number | boolean | string[]): string {
    return Array.isArray(value) ? value.join(', ') : String(value);
  }

  // A request still in flight is dropped, so a slow old response can't overwrite a newer one
  private fetchPage(offset: number): void {
    this.isLoading = true;
    this.pageRequest?.unsubscribe();
    this.pageRequest = this.auditLogApi.getAuditLogs(this.buildQuery(offset)).subscribe({
      next: (page) => {
        this.logs = page.items;
        this.total = page.total;
        this.offset = offset;
        this.expandedId = null;
        this.isLoading = false;
      },
      error: () => {
        this.notificationService.error('Failed to load the activity log');
        this.isLoading = false;
      }
    });
  }

  private buildQuery(offset: number): AuditLogQuery {
    const { user, action, result, from, to } = this.filters;
    const term = user.trim();
    // A whole number is taken as a user id; any other text is matched against usernames
    const isUserId = /^\d+$/.test(term);
    // No type chosen: every type still shown, which is all of them once both boxes are ticked
    const shown = this.actionOptions;

    return {
      limit: this.pageSize,
      offset,
      userId: isUserId ? Number(term) : undefined,
      username: term && !isUserId ? term : undefined,
      actions: action ? [action] : shown.length < AUDIT_ACTIONS.length ? shown : undefined,
      result: result || undefined,
      from: from ? localDayStart(from) : undefined,
      to: to ? localDayStart(to, 1) : undefined,
    };
  }
}
