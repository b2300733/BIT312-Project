import { inject } from '@angular/core';
import { map } from 'rxjs/operators';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../backend/services/auth.service';

const getRoleHome = (role: 'admin' | 'employee') =>
  role === 'admin' ? '/admin-dashboard' : '/employee-dashboard';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  return authService
    .ensureSession()
    .pipe(map((user) => (user ? true : router.createUrlTree(['/login']))));
};

export const roleGuard = (requiredRole: 'admin' | 'employee'): CanActivateFn => {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);
    return authService.ensureSession().pipe(
      map((currentUser) => {
        if (!currentUser) {
          return router.createUrlTree(['/login']);
        }

        if (currentUser.role !== requiredRole) {
          return router.createUrlTree([getRoleHome(currentUser.role)]);
        }

        return true;
      }),
    );
  };
};

export const roleChildGuard = (requiredRole: 'admin' | 'employee'): CanActivateChildFn => {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);
    return authService.ensureSession().pipe(
      map((currentUser) => {
        if (!currentUser) {
          return router.createUrlTree(['/login']);
        }

        if (currentUser.role !== requiredRole) {
          return router.createUrlTree([getRoleHome(currentUser.role)]);
        }

        return true;
      }),
    );
  };
};

export const loginGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  return authService.ensureSession().pipe(
    map((currentUser) => {
      if (!currentUser) {
        return true;
      }

      return router.createUrlTree([getRoleHome(currentUser.role)]);
    }),
  );
};
