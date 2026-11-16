import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { Building2, Users, UserCheck, UserX } from 'lucide-angular';
import { AdminNavbarComponent } from '../../components/admin-navbar/admin-navbar';
import { ActivitiesService } from '../../../../backend/services/activities.service';
import { HeaderComponent } from '../../components/header/header';
import { COMMON_PAGES_MODULES } from '../../module/common.pages.module';
import { Activity } from '../../models/activity.model';

@Component({
  selector: 'app-admin-dashboard',
  imports: [COMMON_PAGES_MODULES, AdminNavbarComponent, RouterOutlet, HeaderComponent],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboardPage implements OnInit {
  readonly Building2 = Building2;
  readonly Users = Users;
  readonly UserCheck = UserCheck;
  readonly UserX = UserX;

  private activitiesService = inject(ActivitiesService);

  private activities = toSignal(this.activitiesService.activities$, {
    initialValue: [] as Activity[],
  });

  readonly stats = computed(() => {
    const activities = this.activities();
    const totalSlots = activities.reduce((sum, activity) => sum + activity.totalSlots, 0);
    const totalRegistered = activities.reduce((sum, activity) => sum + activity.registered, 0);
    const totalAvailable = activities
      .filter((activity) => this.activitiesService.getActivityStatus(activity) === 'Open')
      .reduce((sum, activity) => sum + Math.max(activity.totalSlots - activity.registered, 0), 0);

    return {
      totalActivities: activities.length,
      totalSlots,
      totalRegistered,
      totalAvailable,
    };
  });

  ngOnInit() {
    if (this.activitiesService.getActivities().length === 0) {
      this.activitiesService.fetchActivities().subscribe();
    }
  }
}
