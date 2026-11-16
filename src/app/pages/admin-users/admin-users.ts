import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { UsersService } from '../../../../backend/services/users.service';

@Component({
  selector: 'app-admin-users',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatCardModule,
    MatSnackBarModule,
  ],
  templateUrl: './admin-users.html',
  styleUrl: './admin-users.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsersPage {
  private fb = inject(FormBuilder);
  private usersService = inject(UsersService);
  private snackBar = inject(MatSnackBar);

  readonly isSubmitting = signal(false);
  readonly submitErrorMessage = signal('');

  userForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    department: ['', [Validators.required]],
  });

  onSubmit() {
    const rawValue = this.userForm.getRawValue();
    const payload = {
      name: rawValue.name.trim(),
      email: rawValue.email.trim(),
      password: rawValue.password.trim(),
      department: rawValue.department.trim(),
    };

    this.userForm.patchValue(payload, { emitEvent: false });

    if (this.userForm.invalid || this.isSubmitting()) {
      this.userForm.markAllAsTouched();
      return;
    }

    this.submitErrorMessage.set('');
    this.isSubmitting.set(true);

    this.usersService.createUser(payload).subscribe({
      next: () => {
        this.snackBar.open('User registered successfully.', 'Close', {
          duration: 3000,
          horizontalPosition: 'right',
          verticalPosition: 'top',
        });
        this.userForm.reset();
        this.submitErrorMessage.set('');
        this.isSubmitting.set(false);
      },
      error: (err) => {
        const message = err?.error?.message || 'Failed to register user.';
        this.submitErrorMessage.set(message);
        this.snackBar.open(message, 'Close', {
          duration: 3000,
          horizontalPosition: 'right',
          verticalPosition: 'top',
        });
        this.isSubmitting.set(false);
      },
    });
  }
}
