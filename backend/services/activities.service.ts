import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Activity } from '../../src/app/models/activity.model';

const API_URL = '/api/activities';

@Injectable({
  providedIn: 'root',
})
export class ActivitiesService {
  private http = inject(HttpClient);

  private activitiesSubject = new BehaviorSubject<Activity[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);

  public activities$ = this.activitiesSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();

  getActivities(): Activity[] {
    return this.activitiesSubject.value;
  }

  fetchActivities(): Observable<Activity[]> {
    this.loadingSubject.next(true);
    return this.http.get<Activity[]>(API_URL).pipe(
      tap((activities) => {
        this.activitiesSubject.next(activities);
        this.loadingSubject.next(false);
      }),
      catchError((error) => {
        this.loadingSubject.next(false);
        return throwError(() => error);
      }),
    );
  }

  addActivity(activity: Activity): Observable<Activity> {
    this.loadingSubject.next(true);
    return this.http.post<Activity>(API_URL, activity).pipe(
      tap((newActivity) => {
        this.activitiesSubject.next([...this.activitiesSubject.value, newActivity]);
        this.loadingSubject.next(false);
      }),
      catchError((error) => {
        this.loadingSubject.next(false);
        return throwError(() => error);
      }),
    );
  }

  updateActivity(oldActivity: Activity, newActivity: Activity): Observable<Activity> {
    this.loadingSubject.next(true);
    const id = oldActivity._id || newActivity._id;
    return this.http.put<Activity>(`${API_URL}/${id}`, newActivity).pipe(
      tap((updated) => {
        const updatedList = this.activitiesSubject.value.map((a) => (a._id === id ? updated : a));
        this.activitiesSubject.next(updatedList);
        this.loadingSubject.next(false);
      }),
      catchError((error) => {
        this.loadingSubject.next(false);
        return throwError(() => error);
      }),
    );
  }

  deleteActivity(activity: Activity): Observable<void> {
    this.loadingSubject.next(true);
    const id = activity._id;
    return this.http.delete<void>(`${API_URL}/${id}`).pipe(
      tap(() => {
        this.activitiesSubject.next(this.activitiesSubject.value.filter((a) => a._id !== id));
        this.loadingSubject.next(false);
      }),
      catchError((error) => {
        this.loadingSubject.next(false);
        return throwError(() => error);
      }),
    );
  }

  getStatistics() {
    const activities = this.activitiesSubject.value;
    const totalAvailable = activities
      .filter((activity) => this.getActivityStatus(activity) === 'Open')
      .reduce((sum, activity) => sum + Math.max(activity.totalSlots - activity.registered, 0), 0);

    return {
      totalActivities: activities.length,
      totalSlots: activities.reduce((sum, a) => sum + a.totalSlots, 0),
      totalRegistered: activities.reduce((sum, a) => sum + a.registered, 0),
      totalAvailable,
    };
  }

  getActivityStatus(activity: Activity): 'Open' | 'Full' | 'Closed' {
    const now = new Date();
    const cutoffDateTime = new Date(`${activity.cutoffDate}T${activity.cutoffTime}`);

    if (now > cutoffDateTime) {
      return 'Closed';
    }

    if (activity.registered >= activity.totalSlots) {
      return 'Full';
    }

    return 'Open';
  }
}
