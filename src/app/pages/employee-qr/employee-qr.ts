import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, interval, of } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';
import { AuthService } from '../../../../backend/services/auth.service';
import {
  RegistrationsService,
  Registration,
  RegistrationWithActivity,
} from '../../../../backend/services/registrations.service';
import {
  LucideAngularModule,
  Search,
  QrCode,
  Calendar,
  Clock,
  MapPin,
  Maximize,
  X,
  Download,
  CheckCircle,
} from 'lucide-angular';

interface CheckInActivity {
  id: string;
  activityId: string;
  title: string;
  date: string;
  time: string;
  location: string;
  qrData: string;
  showQr?: boolean;
  isCheckedIn?: boolean;
  checkInDate?: string;
  checkInTime?: string;
}

@Component({
  selector: 'app-employee-checkin',
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './employee-qr.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      @keyframes scan {
        0%,
        100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(250px);
        }
      }
      .animate-scan {
        animation: scan 2.5s ease-in-out infinite;
      }

      @keyframes scalePop {
        0% {
          transform: scale(0.5);
          opacity: 0;
        }
        70% {
          transform: scale(1.15);
          opacity: 1;
        }
        100% {
          transform: scale(1);
          opacity: 1;
        }
      }
      .animate-scale-pop {
        animation: scalePop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
      }

      @keyframes slideUpFade {
        0% {
          transform: translateY(20px);
          opacity: 0;
        }
        100% {
          transform: translateY(0);
          opacity: 1;
        }
      }
      .animate-slide-up-fade {
        animation: slideUpFade 0.5s ease-out forwards;
        animation-delay: 0.2s;
        opacity: 0;
      }
    `,
  ],
})
export class EmployeeCheckinComponent {
  readonly Search = Search;
  readonly QrCode = QrCode;
  readonly Calendar = Calendar;
  readonly Clock = Clock;
  readonly MapPin = MapPin;
  readonly Maximize = Maximize;
  readonly X = X;
  readonly Download = Download;
  readonly CheckCircle = CheckCircle;

  private readonly registrationsService = inject(RegistrationsService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);

  searchTerm = '';
  enlargedQrActivity: CheckInActivity | null = null;
  isLoading = true;
  loadError = '';

  isScanSuccessful = signal(false);

  activities: CheckInActivity[] = [];
  private employeeId: string | null = null;

  constructor() {
    this.ensureEmployeeId().subscribe((employeeId) => {
      if (!employeeId) {
        this.isLoading = false;
        this.loadError = 'Unable to load employee account.';
        this.changeDetectorRef.markForCheck();
        return;
      }

      this.employeeId = employeeId;

      interval(8000)
        .pipe(
          startWith(0),
          switchMap(() => this.loadActivities(employeeId)),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe({
          next: (nextActivities) => {
            this.activities = nextActivities;
            this.isLoading = false;
            this.loadError = '';
            this.updateEnlargedQrState();
            this.changeDetectorRef.markForCheck();
          },
          error: (err) => {
            console.error('Error loading QR activities:', err);
            this.activities = [];
            this.isLoading = false;
            this.loadError = 'Failed to load your activity QR codes.';
            this.changeDetectorRef.markForCheck();
          },
        });
    });
  }

  get filteredActivities() {
    return this.activities.filter(
      (a) =>
        a.title.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        a.location.toLowerCase().includes(this.searchTerm.toLowerCase()),
    );
  }

  toggleQr(activity: CheckInActivity) {
    activity.showQr = !activity.showQr;
  }

  enlargeQr(activity: CheckInActivity) {
    this.enlargedQrActivity = activity;
    this.isScanSuccessful.set(Boolean(activity.isCheckedIn));
  }

  closeEnlargedQr() {
    this.enlargedQrActivity = null;
    this.isScanSuccessful.set(false);
  }

  async downloadQr(activity: CheckInActivity) {
    if (!activity.qrData) {
      return;
    }

    const imageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&format=jpeg&data=${encodeURIComponent(activity.qrData)}`;

    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${activity.title.replace(/\s+/g, '-').toLowerCase()}-qr.jpg`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Error downloading the QR code:', error);
      alert('There was a problem downloading the QR code. Please try again.');
    }
  }

  private mapActivities(
    registrationsWithActivity: RegistrationWithActivity[],
    registrations: Registration[],
  ): CheckInActivity[] {
    const registrationByActivityId = new Map<string, Registration>();
    registrations.forEach((registration) => {
      registrationByActivityId.set(registration.activityId, registration);
    });

    return registrationsWithActivity.map((registration) => {
      const activityId = registration.activity._id ?? '';
      const checkInRecord = registrationByActivityId.get(activityId);
      const checkInDate = this.formatCheckInDate(checkInRecord?.checkedInAt ?? null);
      const checkInTime = this.formatCheckInTime(checkInRecord?.checkedInAt ?? null);

      return {
        id: registration._id ?? `${activityId}-${registration.activity.name}`,
        activityId,
        title: registration.activity.name,
        date: registration.activity.scheduleDate,
        time: registration.activity.scheduleTime,
        location: registration.activity.location,
        qrData: checkInRecord?.qrData ?? '',
        showQr: false,
        isCheckedIn: Boolean(checkInRecord?.qrchecked),
        checkInDate,
        checkInTime,
      };
    });
  }

  private formatCheckInDate(value: string | null | undefined): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatCheckInTime(value: string | null | undefined): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
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

  private loadActivities(employeeId: string) {
    return forkJoin({
      registrationsWithActivity:
        this.registrationsService.listRegistrationsWithActivity(employeeId),
      registrations: this.registrationsService.listRegistrations(employeeId),
    }).pipe(
      switchMap(({ registrationsWithActivity, registrations }) =>
        of(this.mapActivities(registrationsWithActivity, registrations)),
      ),
    );
  }

  private updateEnlargedQrState() {
    if (!this.enlargedQrActivity) {
      return;
    }

    const updated = this.activities.find(
      (activity) => activity.activityId === this.enlargedQrActivity?.activityId,
    );

    if (updated?.isCheckedIn) {
      this.enlargedQrActivity = updated;
      this.isScanSuccessful.set(true);
    }
  }
}
