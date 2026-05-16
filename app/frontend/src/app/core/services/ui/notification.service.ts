import { Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(private toastr: ToastrService) {}

  success(message: string, title = 'Success'): void {
    this.toastr.success(message, title);
  }

  error(message: string, title = 'Error'): void {
    this.toastr.error(message, title, { timeOut: 5000 });
  }

  warning(message: string, title = 'Warning'): void {
    this.toastr.warning(message, title, { timeOut: 4000 });
  }

  info(message: string, title = 'Information'): void {
    this.toastr.info(message, title);
  }
}
