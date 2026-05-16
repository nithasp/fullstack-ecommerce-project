import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { ConfirmDialogConfig } from '../../models/confirm-dialog.model';

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private _config$ = new BehaviorSubject<ConfirmDialogConfig | null>(null);
  private _result$ = new Subject<boolean>();

  readonly config$ = this._config$.asObservable();

  confirm(config: ConfirmDialogConfig): Observable<boolean> {
    this._config$.next(config);
    return new Observable<boolean>(observer => {
      const sub = this._result$.subscribe(result => {
        observer.next(result);
        observer.complete();
        sub.unsubscribe();
      });
    });
  }

  resolve(confirmed: boolean): void {
    this._config$.next(null);
    this._result$.next(confirmed);
  }
}
