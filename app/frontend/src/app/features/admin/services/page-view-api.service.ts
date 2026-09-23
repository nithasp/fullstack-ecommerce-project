import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { PageView, PageViewQuery } from '../models/page-view.model';
import { ApiResponse, Page } from '../../../core/models/api.model';
import { API } from '../../../core/config/api-config';

@Injectable({ providedIn: 'root' })
export class PageViewApiService {
  private readonly baseUrl = `${API.baseUrl}/admin/page-views`;

  constructor(private http: HttpClient) {}

  // Filtering happens on the server; a filter left unset stays out of the query string
  getPageViews(query: PageViewQuery): Observable<Page<PageView>> {
    let params = new HttpParams().set('limit', query.limit).set('offset', query.offset);
    if (query.userId) params = params.set('userId', query.userId);
    if (query.username) params = params.set('username', query.username);
    if (query.path) params = params.set('path', query.path);
    if (query.from) params = params.set('from', query.from);
    if (query.to) params = params.set('to', query.to);

    return this.http
      .get<ApiResponse<PageView[]>>(this.baseUrl, { params })
      .pipe(map(res => ({ items: res.data, total: res.meta?.total ?? res.data.length })));
  }
}
