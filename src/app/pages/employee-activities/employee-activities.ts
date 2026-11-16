import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, of } from 'rxjs';
import {
  LucideAngularModule,
  MapPin,
  Calendar,
  Users,
  Clock,
  CheckCircle,
  X,
  AlertTriangle,
} from 'lucide-angular';
import { ActivitiesService } from '../../../../backend/services/activities.service';
import { AuthService } from '../../../../backend/services/auth.service';
import { RegistrationsService } from '../../../../backend/services/registrations.service';
import { Activity } from '../../models/activity.model';

@Component({
  selector: 'app-employee-activities',
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatSnackBarModule,
    LucideAngularModule,
    FormsModule,
  ],
  templateUrl: './employee-activities.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeActivitiesComponent implements OnInit {
  readonly MapPin = MapPin;
  readonly Calendar = Calendar;
  readonly Users = Users;
  readonly Clock = Clock;
  readonly CheckCircle = CheckCircle;
  readonly X = X;
  readonly AlertTriangle = AlertTriangle; // <-- Added for the conflict modal

  private readonly activitiesService = inject(ActivitiesService);
  private readonly registrationsService = inject(RegistrationsService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly snackBar = inject(MatSnackBar);

  readonly cardBaseClass =
    'flex min-h-105 cursor-pointer flex-col justify-between rounded-xl !bg-white p-6 transition-all duration-200 ease-in hover:-translate-y-1 hover:shadow-lg';

  searchTerm = '';
  selectedActivity: Activity | null = null;

  conflictWarning: { attempting: Activity; existing: Activity } | null = null;

  activities: Activity[] = [];
  private userRegistrations = new Set<string>();
  private registeringIds = new Set<string>();
  private cancellingIds = new Set<string>();

  ngOnInit() {
    this.activitiesService.activities$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((activities) => {
        this.activities = activities;
        this.changeDetectorRef.markForCheck();
      });

    this.activitiesService.fetchActivities().subscribe({
      error: (err) => {
        console.error('Error loading activities:', err);
      },
    });

    this.ensureEmployeeId().subscribe(() => {
      this.loadRegistrations();
    });
  }

  get filteredActivities() {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      return this.activities;
    }

    return this.activities.filter(
      (a) =>
        a.name.toLowerCase().includes(term) ||
        a.location.toLowerCase().includes(term) ||
        a.serviceType.toLowerCase().includes(term),
    );
  }

  openDetails(activity: Activity) {
    this.selectedActivity = activity;
  }

  closeDetails() {
    this.selectedActivity = null;
  }

  isRegistered(activity: Activity): boolean {
    return this.userRegistrations.has(this.getActivityKey(activity));
  }

  getCutoffLabel(activity: Activity): string {
    return `${activity.cutoffDate} at ${activity.cutoffTime}`;
  }

  isCutoffPassed(activity: Activity): boolean {
    if (!activity.cutoffDate || !activity.cutoffTime) {
      return false;
    }

    const cutoffDateTime = new Date(`${activity.cutoffDate}T${activity.cutoffTime}`);
    return Number.isNaN(cutoffDateTime.getTime()) ? false : cutoffDateTime < new Date();
  }

  register(activity: Activity) {
    if (this.isCutoffPassed(activity)) {
      console.warn('Registration cutoff has passed.');
      return;
    }

    const activityKey = this.getActivityKey(activity);
    if (this.registeringIds.has(activityKey)) {
      return;
    }

    const existingRegistration = this.activities.find(
      (a) =>
        this.isRegistered(a) &&
        a.scheduleDate === activity.scheduleDate &&
        this.getActivityKey(a) !== this.getActivityKey(activity),
    );

    if (existingRegistration) {
      this.selectedActivity = null;

      this.conflictWarning = {
        attempting: activity,
        existing: existingRegistration,
      };
      return;
    }

    this.registeringIds = new Set(this.registeringIds).add(activityKey);
    this.changeDetectorRef.markForCheck();

    this.ensureEmployeeId().subscribe((employeeId) => {
      if (!employeeId || !activity._id) {
        console.error('Missing employee or activity id.', {
          employeeId,
          activityId: activity._id,
        });
        this.registeringIds.delete(activityKey);
        this.changeDetectorRef.markForCheck();
        return;
      }

      this.registrationsService
        .createRegistration(employeeId, activity._id)
        .pipe(
          finalize(() => {
            this.registeringIds.delete(activityKey);
            this.changeDetectorRef.markForCheck();
          }),
        )
        .subscribe({
          next: () => {
            this.userRegistrations = new Set(this.userRegistrations).add(activityKey);
            this.changeDetectorRef.markForCheck();
            this.refreshActivities();
            this.registrationsService.refreshActiveRegistrations();
            this.showSnackbar('Registration successful. Check your email.');
          },
          error: (err) => {
            console.error('Registration failed:', err);
          },
        });
    });
  }

  cancelRegistration(activity: Activity) {
    if (this.isCutoffPassed(activity)) {
      console.warn('Cancellation cutoff has passed.');
      return;
    }

    const activityKey = this.getActivityKey(activity);
    if (this.cancellingIds.has(activityKey)) {
      return;
    }

    this.cancellingIds = new Set(this.cancellingIds).add(activityKey);
    this.changeDetectorRef.markForCheck();

    this.ensureEmployeeId().subscribe((employeeId) => {
      if (!employeeId || !activity._id) {
        console.error('Missing employee or activity id.', {
          employeeId,
          activityId: activity._id,
        });
        this.cancellingIds.delete(activityKey);
        this.changeDetectorRef.markForCheck();
        return;
      }

      this.registrationsService
        .deleteRegistration(employeeId, activity._id)
        .pipe(
          finalize(() => {
            this.cancellingIds.delete(activityKey);
            this.changeDetectorRef.markForCheck();
          }),
        )
        .subscribe({
          next: () => {
            const nextRegistrations = new Set(this.userRegistrations);
            nextRegistrations.delete(activityKey);
            this.userRegistrations = nextRegistrations;
            this.changeDetectorRef.markForCheck();
            this.refreshActivities();
            this.registrationsService.refreshActiveRegistrations();
            this.showSnackbar('Registration cancelled. Check your email.');
          },
          error: (err) => {
            console.error('Cancel registration failed:', err);
          },
        });
    });
  }

  isRegistering(activity: Activity): boolean {
    return this.registeringIds.has(this.getActivityKey(activity));
  }

  isCancelling(activity: Activity): boolean {
    return this.cancellingIds.has(this.getActivityKey(activity));
  }

  closeConflictWarning() {
    this.conflictWarning = null;
  }

  private getActivityKey(activity: Activity): string {
    return activity._id ?? activity.name;
  }

  private refreshActivities() {
    this.activitiesService.fetchActivities().subscribe({
      error: (err) => {
        console.error('Error refreshing activities:', err);
      },
    });
  }

  private loadRegistrations() {
    const employeeId = this.getEmployeeId();
    if (!employeeId) {
      return;
    }

    this.registrationsService.listRegistrations(employeeId).subscribe({
      next: (registrations) => {
        this.userRegistrations = new Set(
          registrations.map((registration) => registration.activityId),
        );
        this.changeDetectorRef.markForCheck();
      },
      error: (err) => {
        console.error('Error loading registrations:', err);
      },
    });
  }

  private getEmployeeId(): string | null {
    return this.authService.currentUser()?._id ?? null;
  }

  private showSnackbar(message: string): void {
    this.snackBar.open(message, '', {
      duration: 4000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
    });
  }

  private ensureEmployeeId() {
    const current = this.authService.currentUser();
    if (!current) {
      return of(null);
    }

    if (current._id) {
      return of(current._id);
    }

    return this.authService.fetchUserId(current.email);
  }
}
