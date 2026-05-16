import { Component } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';
import { NotificationService } from '../../../core/services/ui/notification.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  username = '';
  password = '';
  isLoading = false;
  submitted = false;

  constructor(
    private authService: AuthService,
    private notification: NotificationService,
    private router: Router
  ) {}

  onSubmit(form: NgForm): void {
    this.submitted = true;

    if (form.invalid) {
      this.notification.error('Please fill in all required fields.');
      return;
    }

    this.isLoading = true;

    this.authService.login(this.username, this.password).subscribe({
      next: () => {
        this.notification.success('Login successful! Welcome back.');
        this.router.navigate(['/products']);
      },
      error: (err: Error) => {
        this.notification.error(err.message || 'Login failed. Please try again.');
        this.isLoading = false;
      }
    });
  }
}
