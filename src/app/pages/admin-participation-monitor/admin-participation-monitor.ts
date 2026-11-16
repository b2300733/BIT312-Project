import {
  Component,
  OnInit,
  ViewChild,
  ViewChildren,
  QueryList,
  ElementRef,
  AfterViewInit,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { provideNativeDateAdapter } from '@angular/material/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';
import { ActivitiesService } from '../../../../backend/services/activities.service';
import { Activity } from '../../models/activity.model';
import {
  EmployeeRegistration,
  RegistrationTimeline,
  RegistrationsService,
} from '../../../../backend/services/registrations.service';
import { MatExpansionModule, MatExpansionPanel } from '@angular/material/expansion';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { MatSort, Sort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { CommonModule } from '@angular/common';

Chart.register(...registerables);

@Component({
  selector: 'app-admin-participation-monitor',
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatDatepickerModule,
    MatInputModule,
    ReactiveFormsModule,
    MatExpansionModule,
    MatSortModule,
    MatTableModule,
    MatPaginatorModule,
    CommonModule,
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './admin-participation-monitor.html',
  styleUrl: './admin-participation-monitor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminParticipationMonitorPage implements AfterViewInit, OnInit {
  readonly panelOpenState = signal(false);

  activities: Activity[] = [];
  allActivities: Activity[] = [];
  activityDataSources = new Map<string, MatTableDataSource<EmployeeRegistration>>();
  displayedColumns: string[] = ['employeeName', 'department', 'registeredDate'];
  private allEmployeeRegistrations: EmployeeRegistration[] = [];
  private _liveAnnouncer = inject(LiveAnnouncer);

  // Pagination
  pageSize = 6;
  pageIndex = 0;
  totalActivities = 0;

  @ViewChildren(MatSort) sorts!: QueryList<MatSort>;
  @ViewChildren(MatExpansionPanel) expansionPanels!: QueryList<MatExpansionPanel>;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  @ViewChild('timelineChart') timelineChartRef!: ElementRef<HTMLCanvasElement>;
  private timelineChart?: Chart;
  private activitiesService = inject(ActivitiesService);
  private registrationsService = inject(RegistrationsService);

  dateRange = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null),
  });

  private allTimelineData: RegistrationTimeline[] = [];

  ngOnInit() {
    this.activitiesService.activities$.subscribe((activities) => {
      this.setActivities(activities);
    });

    this.registrationsService.listRegistrationsWithEmployee().subscribe({
      next: (registrations) => {
        this.allEmployeeRegistrations = registrations;
        this.rebuildActivityDataSources();
      },
      error: (err) => {
        console.error('Fetch registrations error:', err);
      },
    });

    this.registrationsService.getRegistrationTimeline().subscribe({
      next: (timeline) => {
        this.allTimelineData = timeline;
        this.updateChartData();
      },
      error: (err) => {
        console.error('Fetch registration timeline error:', err);
      },
    });

    this.activitiesService.fetchActivities().subscribe({
      error: (err) => {
        console.error('Fetch activities error:', err);
      },
    });

    // Set default to last 7 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    this.dateRange.setValue({
      start: sevenDaysAgo,
      end: today,
    });

    // Listen to date range changes
    this.dateRange.valueChanges.subscribe(() => {
      this.updateChartData();
    });
  }

  ngAfterViewInit() {
    // Delay chart initialization to ensure canvas is fully rendered
    setTimeout(() => {
      this.initTimelineChart();

      this.assignSortsToDataSources();
    });
  }

  private assignSortsToDataSources() {
    const sortArray = this.sorts.toArray();
    this.activities.forEach((activity, index) => {
      const activityKey = this.getActivityKey(activity.name);
      const dataSource = this.activityDataSources.get(activityKey);
      if (dataSource && sortArray[index]) {
        dataSource.sort = sortArray[index];
      }
    });
  }

  private updatePaginatedActivities() {
    const startIndex = this.pageIndex * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.activities = this.allActivities.slice(startIndex, endIndex);
  }

  private setActivities(activities: Activity[]) {
    this.allActivities = [...activities].sort((a, b) => {
      const dateA = new Date(`${a.scheduleDate} ${a.scheduleTime}`);
      const dateB = new Date(`${b.scheduleDate} ${b.scheduleTime}`);
      return dateB.getTime() - dateA.getTime();
    });

    this.totalActivities = this.allActivities.length;
    if (this.pageIndex * this.pageSize >= this.totalActivities) {
      this.pageIndex = 0;
    }

    this.updatePaginatedActivities();

    this.rebuildActivityDataSources();
  }

  private rebuildActivityDataSources() {
    this.activityDataSources.clear();
    this.allActivities.forEach((activity) => {
      const activityKey = this.getActivityKey(activity.name);
      const registrations = this.allEmployeeRegistrations.filter(
        (reg) => reg.activity === activity.name,
      );
      this.activityDataSources.set(activityKey, new MatTableDataSource(registrations));
    });

    if (this.sorts?.length) {
      setTimeout(() => {
        this.assignSortsToDataSources();
      });
    }
  }

  onPageChange(event: PageEvent) {
    // Close all expansion panels
    this.expansionPanels?.forEach((panel) => panel.close());

    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.updatePaginatedActivities();

    // Re-assign sorts after pagination change
    setTimeout(() => {
      this.assignSortsToDataSources();
    });
  }

  private initTimelineChart() {
    if (!this.timelineChartRef?.nativeElement) {
      return;
    }

    const filteredData = this.getFilteredData();
    const labels = filteredData.map((d) => this.formatDate(d.date));
    const data = filteredData.map((d) => d.registrations);

    this.timelineChart = new Chart(this.timelineChartRef.nativeElement, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Registrations',
            data: data,
            borderColor: '#27619b',
            backgroundColor: 'rgba(38, 97, 155, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#27619b',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointHoverBackgroundColor: '#1e4a73',
            pointHoverBorderColor: '#fff',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: 'white',
            titleColor: '#000',
            bodyColor: '#000',
            borderColor: '#e5e7eb',
            borderWidth: 1,
            padding: 12,
            displayColors: false,
            titleFont: {
              size: 14,
              weight: 'bold',
            },
            bodyFont: {
              size: 13,
            },
            callbacks: {
              label: (context) => {
                return `Registrations: ${context.parsed.y}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: {
              display: false,
            },
            ticks: {
              font: {
                size: 11,
              },
            },
          },
          y: {
            beginAtZero: true,
            grid: {
              color: '#f3f4f6',
            },
            ticks: {
              font: {
                size: 11,
              },
            },
          },
        },
      },
    });
  }

  private getFilteredData() {
    const startDate = this.dateRange.value.start;
    const endDate = this.dateRange.value.end;

    if (!startDate || !endDate) {
      return this.allTimelineData;
    }

    // Normalize dates to midnight for proper comparison
    const normalizedStart = new Date(startDate);
    normalizedStart.setHours(0, 0, 0, 0);
    const normalizedEnd = new Date(endDate);
    normalizedEnd.setHours(23, 59, 59, 999);

    return this.allTimelineData.filter((item) => {
      const itemDate = new Date(item.date);
      itemDate.setHours(0, 0, 0, 0);
      return itemDate >= normalizedStart && itemDate <= normalizedEnd;
    });
  }

  private updateChartData() {
    if (!this.timelineChart) return;

    const filteredData = this.getFilteredData();
    const labels = filteredData.map((d) => this.formatDate(d.date));
    const data = filteredData.map((d) => d.registrations);

    this.timelineChart.data.labels = labels;
    this.timelineChart.data.datasets[0].data = data;
    this.timelineChart.update();
  }

  private formatDate(date: string): string {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  getSlotPercentage(registered: number, totalSlots: number): number {
    return (registered / totalSlots) * 100;
  }

  getRegistrationsForActivity(
    activityName: string,
    index: number,
  ): MatTableDataSource<EmployeeRegistration> {
    const activityKey = this.getActivityKey(activityName);
    return (
      this.activityDataSources.get(activityKey) || new MatTableDataSource<EmployeeRegistration>([])
    );
  }

  private getActivityKey(activityName: string): string {
    return activityName;
  }

  announceSortChange(sortState: Sort) {
    if (sortState.direction) {
      this._liveAnnouncer.announce(`Sorted ${sortState.direction}ending`);
    } else {
      this._liveAnnouncer.announce('Sorting cleared');
    }
  }

  getSlotsLeft(activity: Activity): number {
    return activity.totalSlots - activity.registered;
  }

  getStatus(activity: Activity): string {
    return this.activitiesService.getActivityStatus(activity);
  }

  ngOnDestroy() {
    if (this.timelineChart) {
      this.timelineChart.destroy();
    }
  }
}
