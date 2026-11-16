import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, finalize, map, shareReplay, tap } from 'rxjs/operators';

export interface User {
  _id?: string;
  email: string;
  name: string;
  department: string;
  role: 'admin' | 'employee';
}

interface UserRecord {
  _id: string;
  email: string;
  name: string;
  department: string;
  role: 'admin' | 'employee';
}

const API_URL = '/api/users';
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private _currentUser = signal<User | null>(null);
  private _sessionChecked = signal<boolean>(false);
  private _sessionRequest: Observable<User | null> | null = null;

  readonly currentUser = this._currentUser.asReadonly();

  login(email: string, password: string): Observable<User> {
    return this.http
      .post<UserRecord>(`${API_URL}/login`, { email, password }, { withCredentials: true })
      .pipe(
        tap((response) => {
          const nextUser: User = {
            _id: response._id,
            email: response.email,
            name: response.name,
            department: response.department,
            role: response.role,
          };
          this._currentUser.set(nextUser);
          this._sessionChecked.set(true);
        }),
        map((response) => ({
          _id: response._id,
          email: response.email,
          name: response.name,
          department: response.department,
          role: response.role,
        })),
      );
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${API_URL}/logout`, {}, { withCredentials: true }).pipe(
      tap(() => {
        this._currentUser.set(null);
        this._sessionChecked.set(true);
      }),
      catchError((err) => {
        console.error('Failed to logout:', err);
        this._currentUser.set(null);
        this._sessionChecked.set(true);
        return of(void 0);
      }),
    );
  }

  isAuthenticated(): boolean {
    return Boolean(this._currentUser());
  }

  ensureSession(): Observable<User | null> {
    if (this._sessionChecked()) {
      return of(this._currentUser());
    }

    if (this._sessionRequest) {
      return this._sessionRequest;
    }

    this._sessionRequest = this.http
      .get<UserRecord>(`${API_URL}/me`, { withCredentials: true })
      .pipe(
        tap((user) => {
          this._currentUser.set({
            _id: user._id,
            email: user.email,
            name: user.name,
            department: user.department,
            role: user.role,
          });
          this._sessionChecked.set(true);
        }),
        map((user) => ({
          _id: user._id,
          email: user.email,
          name: user.name,
          department: user.department,
          role: user.role,
        })),
        catchError((err: HttpErrorResponse) => {
          if (err.status !== 401) {
            console.error('Failed to load session:', err);
          }
          this._currentUser.set(null);
          this._sessionChecked.set(true);
          return of(null);
        }),
        finalize(() => {
          this._sessionRequest = null;
        }),
        shareReplay(1),
      );

    return this._sessionRequest;
  }

  fetchUserId(email: string): Observable<string | null> {
    return this.http
      .get<UserRecord>(`${API_URL}/by-email?email=${encodeURIComponent(email)}`, {
        withCredentials: true,
      })
      .pipe(
        tap((user) => {
          const current = this._currentUser();
          if (current?.email === email) {
            const nextUser = { ...current, _id: user._id };
            this._currentUser.set(nextUser);
          }
        }),
        map((user) => user?._id ?? null),
        catchError((err) => {
          console.error('Failed to resolve user id:', err);
          return of(null);
        }),
      );
  }
}
