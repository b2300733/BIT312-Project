import { ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Heart, CalendarCheck, Search, Bell } from 'lucide-angular';
import { EmployeeNavbarComponent } from '../../components/employee-navbar/employee-navbar';
import { HeaderComponent } from '../../components/header/header';
import { COMMON_PAGES_MODULES } from '../../module/common.pages.module';
import { ActivitiesService } from '../../../../backend/services/activities.service';
import { RegistrationsService } from '../../../../backend/services/registrations.service';
import { AuthService } from '../../../../backend/services/auth.service';
import { Activity } from '../../models/activity.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';

@Component({
  selector: 'app-employee-dashboard',
  imports: [EmployeeNavbarComponent, RouterOutlet, HeaderComponent, COMMON_PAGES_MODULES],
  templateUrl: './employee-dashboard.html',
  styleUrl: './employee-dashboard.css',
})
export class EmployeeDashboardPage {
  readonly Heart = Heart;
  readonly CalendarCheck = CalendarCheck;
  readonly Search = Search;

  private readonly activitiesService = inject(ActivitiesService);
  private readonly registrationsService = inject(RegistrationsService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);

  totalActivities = 0;
  registeredCount = 0;
  availableCount = 0;

  constructor() {
    this.activitiesService.activities$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((activities) => {
        this.totalActivities = activities.length;
        this.recalculateAvailable(activities);
        this.changeDetectorRef.markForCheck();
      });

    this.activitiesService.fetchActivities().subscribe({
      error: (err) => {
        console.error('Error loading activities:', err);
      },
    });

    this.ensureEmployeeId().subscribe((employeeId) => {
      if (!employeeId) {
        return;
      }

      this.registrationsService.setActiveEmployeeId(employeeId);
      this.registrationsService.listRegistrations(employeeId).subscribe({
        error: (err) => {
          console.error('Error loading registrations:', err);
        },
      });
    });

    this.registrationsService.registrations$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((registrations) => {
        this.registeredCount = registrations.length;
        this.registeredActivityIds = new Set(
          registrations.map((registration) => registration.activityId),
        );
        this.activitiesService.fetchActivities().subscribe({
          next: (activities) => {
            this.recalculateAvailable(activities);
            this.changeDetectorRef.markForCheck();
          },
          error: (err) => {
            console.error('Error refreshing activities after registration change:', err);
          },
        });
      });
  }

  private registeredActivityIds = new Set<string>();

  private recalculateAvailable(activities: Activity[]) {
    this.availableCount = activities.filter((activity) => {
      if (this.isCutoffPassed(activity)) {
        return false;
      }

      if (activity.registered >= activity.totalSlots) {
        return false;
      }

      const key = activity._id ?? activity.name;
      return !this.registeredActivityIds.has(key);
    }).length;
  }

  private isCutoffPassed(activity: Activity): boolean {
    if (!activity.cutoffDate || !activity.cutoffTime) {
      return false;
    }

    const cutoffDateTime = new Date(`${activity.cutoffDate}T${activity.cutoffTime}`);
    return Number.isNaN(cutoffDateTime.getTime()) ? false : cutoffDateTime < new Date();
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
