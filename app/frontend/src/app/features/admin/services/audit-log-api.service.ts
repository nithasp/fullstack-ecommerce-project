import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { AuditLog, AuditLogQuery } from '../models/audit-log.model';
import { ApiResponse, Page } from '../../../core/models/api.model';
import { API } from '../../../core/config/api-config';

@Injectable({ providedIn: 'root' })
export class AuditLogApiService {
  private readonly baseUrl = `${API.baseUrl}/admin/audit-logs`;

  constructor(private http: HttpClient) {}

  // Filtering happens on the server; a filter left unset stays out of the query string
  getAuditLogs(query: AuditLogQuery): Observable<Page<AuditLog>> {
    let params = new HttpParams().set('limit', query.limit).set('offset', query.offset);
    if (query.userId) params = params.set('userId', query.userId);
    if (query.username) params = params.set('username', query.username);
    if (query.actions?.length) params = params.set('action', query.actions.join(','));
    if (query.result) params = params.set('result', query.result);
    if (query.from) params = params.set('from', query.from);
    if (query.to) params = params.set('to', query.to);

    return this.http
      .get<ApiResponse<AuditLog[]>>(this.baseUrl, { params })
      .pipe(map(res => ({ items: res.data, total: res.meta?.total ?? res.data.length })));
  }
}
