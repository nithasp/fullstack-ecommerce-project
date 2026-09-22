import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuditLogApiService } from './audit-log-api.service';
import { AuditLog } from '../models/audit-log.model';

describe('AuditLogApiService', () => {
  let service: AuditLogApiService;
  let httpMock: HttpTestingController;

  const API = 'http://localhost:3000/api/v1/admin/audit-logs';

  const entry: AuditLog = {
    id: 1,
    createdAt: '2026-09-22T10:42:05.000Z',
    userId: 7,
    username: 'alice',
    userRole: 'customer',
    action: 'DELETE',
    event: 'address.deleted',
    method: 'DELETE',
    path: '/api/v1/addresses/12',
    statusCode: 200,
    ipAddress: '203.0.113.5',
    userAgent: 'Mozilla/5.0',
    details: null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AuditLogApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuditLogApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should fetch one page of entries with the total, sending only the paging when no filter is set', () => {
    service.getAuditLogs({ limit: 25, offset: 0 }).subscribe(page => {
      expect(page.items).toEqual([entry]);
      expect(page.total).toBe(40);
    });

    const req = httpMock.expectOne(r => r.url === API);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().sort()).toEqual(['limit', 'offset']);
    expect(req.request.params.get('limit')).toBe('25');
    expect(req.request.params.get('offset')).toBe('0');
    req.flush({ status: 200, message: 'ok', data: [entry], meta: { limit: 25, offset: 0, total: 40 } });
  });

  it('should send every filter that is set', () => {
    service.getAuditLogs({
      limit: 25,
      offset: 50,
      userId: 7,
      username: 'ali',
      actions: ['LOGIN', 'LOGIN_FAILED'],
      result: 'failure',
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-09-02T00:00:00.000Z',
    }).subscribe();

    const req = httpMock.expectOne(r => r.url === API);
    expect(req.request.params.get('offset')).toBe('50');
    expect(req.request.params.get('userId')).toBe('7');
    expect(req.request.params.get('username')).toBe('ali');
    expect(req.request.params.get('action')).toBe('LOGIN,LOGIN_FAILED');
    expect(req.request.params.get('result')).toBe('failure');
    expect(req.request.params.get('from')).toBe('2026-09-01T00:00:00.000Z');
    expect(req.request.params.get('to')).toBe('2026-09-02T00:00:00.000Z');
    req.flush({ status: 200, message: 'ok', data: [], meta: { limit: 25, offset: 50, total: 0 } });
  });
});
