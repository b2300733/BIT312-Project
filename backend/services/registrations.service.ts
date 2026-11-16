import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';

export interface Registration {
  _id?: string;
  employeeId: string;
  activityId: string;
  qrData?: string | null;
  qrGeneratedAt?: string | null;
  qrchecked?: boolean;
  checkedInAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface RegistrationWithActivity {
  _id?: string;
  employeeId: string;
  activity: {
    _id?: string;
    name: string;
    serviceType: string;
    scheduleDate: string;
    scheduleTime: string;
    location: string;
    description: string;
    cutoffDate: string;
    cutoffTime: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface EmployeeRegistration {
  _id?: string;
  employeeName: string;
  email: string;
  department: string;
  activity: string;
  registeredDate: string;
  registeredTime: string;
  qrData?: string | null;
}

export interface RegistrationTimeline {
  date: string;
  registrations: number;
}

const API_URL = '/api/registrations';

@Injectable({
  providedIn: 'root',
})
export class RegistrationsService {
  private http = inject(HttpClient);
  private registrationsSubject = new BehaviorSubject<Registration[]>([]);
  private activeEmployeeId: string | null = null;

  readonly registrations$ = this.registrationsSubject.asObservable();

  setActiveEmployeeId(employeeId: string) {
    this.activeEmployeeId = employeeId;
  }

  refreshActiveRegistrations() {
    if (!this.activeEmployeeId) {
      return;
    }

    this.listRegistrations(this.activeEmployeeId).subscribe({
      error: (err) => {
        console.error('Error refreshing registrations:', err);
      },
    });
  }

  listRegistrations(employeeId: string): Observable<Registration[]> {
    return this.http
      .get<Registration[]>(`${API_URL}?employeeId=${encodeURIComponent(employeeId)}`)
      .pipe(
        tap((registrations) => {
          this.registrationsSubject.next(registrations);
        }),
      );
  }

  listRegistrationsWithActivity(employeeId: string): Observable<RegistrationWithActivity[]> {
    return this.http.get<RegistrationWithActivity[]>(
      `${API_URL}/with-activity?employeeId=${encodeURIComponent(employeeId)}`,
    );
  }

  listRegistrationsWithEmployee(): Observable<EmployeeRegistration[]> {
    return this.http.get<EmployeeRegistration[]>(`${API_URL}/with-employee`);
  }

  getRegistrationTimeline(): Observable<RegistrationTimeline[]> {
    return this.listRegistrationsWithEmployee().pipe(
      map((registrations) => this.buildTimelineData(registrations)),
    );
  }

  private buildTimelineData(registrations: EmployeeRegistration[]): RegistrationTimeline[] {
    const counts = new Map<string, number>();

    registrations.forEach((registration) => {
      const dateKey = registration.registeredDate;
      if (!dateKey) {
        return;
      }

      counts.set(dateKey, (counts.get(dateKey) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([date, registrationsCount]) => ({ date, registrations: registrationsCount }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  createRegistration(employeeId: string, activityId: string): Observable<Registration> {
    return this.http.post<Registration>(API_URL, { employeeId, activityId }).pipe(
      tap(() => {
        this.refreshActiveRegistrations();
      }),
    );
  }

  deleteRegistration(employeeId: string, activityId: string): Observable<{ message: string }> {
    return this.http
      .delete<{
        message: string;
      }>(
        `${API_URL}?employeeId=${encodeURIComponent(employeeId)}&activityId=${encodeURIComponent(activityId)}`,
      )
      .pipe(
        tap(() => {
          this.refreshActiveRegistrations();
        }),
      );
  }
}
