import { ChangeDetectorRef, Component, NgZone, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Heart, LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../../backend/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, LucideAngularModule, MatCardModule, MatFormFieldModule, MatInputModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginPage {
  readonly Heart = Heart;

  email = '';
  password = '';
  error = '';

  private router = inject(Router);
  private authService = inject(AuthService);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  signIn() {
    this.error = '';
    this.authService.login(this.email, this.password).subscribe({
      next: (user) => {
        this.ngZone.run(() => {
          if (user.role === 'admin') {
            this.router.navigate(['/admin-dashboard']);
          } else {
            this.router.navigate(['/employee-dashboard']);
          }
        });
      },
      error: (err: HttpErrorResponse) => {
        this.ngZone.run(() => {
          this.error =
            err.status === 401
              ? 'Invalid credentials. Please try again.'
              : 'Unable to sign in. Please try again.';
          this.cdr.detectChanges();
        });
      },
    });
  }
}
