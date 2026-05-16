import { Component } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';
import { NotificationService } from '../../../core/services/ui/notification.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  username = '';
  password = '';
  confirmPassword = '';
  isLoading = false;
  submitted = false;

  constructor(
    private authService: AuthService,
    private notification: NotificationService,
    private router: Router
  ) {}

  get passwordMismatch(): boolean {
    return this.password !== this.confirmPassword && this.confirmPassword.length > 0;
  }

  onSubmit(form: NgForm): void {
    this.submitted = true;

    if (form.invalid) {
      this.notification.error('Please fill in all required fields.');
      return;
    }

    if (this.passwordMismatch) {
      this.notification.error('Passwords do not match.');
      return;
    }

    this.isLoading = true;

    this.authService.register(this.username, this.password).subscribe({
      next: () => {
        this.notification.success('Registration successful! Welcome aboard.');
        this.router.navigate(['/products']);
      },
      error: (err: Error) => {
        this.notification.error(err.message || 'Registration failed. Please try again.');
        this.isLoading = false;
      }
    });
  }
}
