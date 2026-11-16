import { AfterViewInit, Component, ViewChild, inject, OnInit } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { MatSort, Sort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import {
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';
import { Plus, Pencil, Trash2, Calendar, MapPin, Clock } from 'lucide-angular';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivitiesService } from '../../../../backend/services/activities.service';
import { Activity } from '../../models/activity.model';
import { COMMON_PAGES_MODULES } from '../../module/common.pages.module';

@Component({
  selector: 'app-admin-activities',
  imports: [MatTableModule, MatSortModule, MatPaginatorModule, COMMON_PAGES_MODULES],
  templateUrl: './admin-activities.html',
  styleUrl: './admin-activities.css',
})
export class AdminActivitiesPage implements AfterViewInit, OnInit {
  readonly Plus = Plus;
  readonly Pencil = Pencil;
  readonly Trash2 = Trash2;
  readonly Calendar = Calendar;
  readonly MapPin = MapPin;
  readonly Clock = Clock;

  readonly dialog = inject(MatDialog);
  private activitiesService = inject(ActivitiesService);
  private snackBar = inject(MatSnackBar);

  private showSnackbar(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'right',
      verticalPosition: 'top',
    });
  }

  openDelete(element: Activity) {
    if (this.isCutoffPassed(element)) {
      this.showSnackbar('Cutoff has passed. Activity cannot be deleted.');
      return;
    }

    const dialogRef = this.dialog.open(DeleteActivitiesDialog, {
      data: element,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.activitiesService.deleteActivity(element).subscribe({
          next: () => {
            this.showSnackbar(`"${element.name}" has been deleted.`);
          },
          error: (err) => {
            this.showSnackbar('Error deleting activity. Please try again.');
            console.error('Delete error:', err);
          },
        });
      }
    });
  }

  openAddEdit(element?: Activity) {
    if (element && this.isCutoffPassed(element)) {
      this.showSnackbar('Cutoff has passed. Activity cannot be edited.');
      return;
    }

    const dialogRef = this.dialog.open(AddEditActivitiesDialog, {
      data: element,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        if (element) {
          this.activitiesService.updateActivity(element, result).subscribe({
            next: () => {
              this.showSnackbar(`"${result.name}" has been updated successfully.`);
            },
            error: (err) => {
              this.showSnackbar('Error updating activity. Please try again.');
              console.error('Update error:', err);
            },
          });
        } else {
          this.activitiesService.addActivity(result).subscribe({
            next: () => {
              this.showSnackbar(`"${result.name}" has been added successfully.`);
            },
            error: (err) => {
              this.showSnackbar('Error adding activity. Please try again.');
              console.error('Add error:', err);
            },
          });
        }
      }
    });
  }

  private _liveAnnouncer = inject(LiveAnnouncer);

  displayedColumns: string[] = [
    'name',
    'scheduleDate',
    'location',
    'slots',
    'cutoffDate',
    'status',
    'action',
  ];
  dataSource = new MatTableDataSource<Activity>([]);

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  ngOnInit() {
    this.activitiesService.activities$.subscribe((activities) => {
      this.dataSource.data = activities;
    });

    this.activitiesService.fetchActivities().subscribe({
      next: (activities) => {
        console.log('Activities loaded successfully:', activities.length);
      },
      error: (err) => {
        this.showSnackbar('Error loading activities. Please refresh the page.');
        console.error('Fetch error:', err);
      },
    });
  }

  ngAfterViewInit() {
    this.dataSource.sortingDataAccessor = (item: Activity, column: string) => {
      switch (column) {
        case 'slots':
          return item.registered;
        case 'status':
          return this.activitiesService.getActivityStatus(item);
        default:
          return (item as any)[column] ?? '';
      }
    };
    this.dataSource.sort = this.sort;
    this.dataSource.paginator = this.paginator;
  }

  announceSortChange(sortState: Sort) {
    if (sortState.direction) {
      this._liveAnnouncer.announce(`Sorted ${sortState.direction}ending`);
    } else {
      this._liveAnnouncer.announce('Sorting cleared');
    }
  }

  getSlotPercentage(registered: number, totalSlots: number): number {
    return (registered / totalSlots) * 100;
  }

  getStatus(activity: Activity): string {
    return this.activitiesService.getActivityStatus(activity);
  }

  isCutoffPassed(activity: Activity): boolean {
    if (!activity?.cutoffDate || !activity?.cutoffTime) {
      return false;
    }

    const cutoffDateTime = new Date(`${activity.cutoffDate}T${activity.cutoffTime}`);
    return Number.isNaN(cutoffDateTime.getTime()) ? false : cutoffDateTime < new Date();
  }
}

@Component({
  selector: 'app-delete-activities',
  imports: [MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose],
  templateUrl: './delete-activities.html',
})
export class DeleteActivitiesDialog {
  readonly element = inject<Activity>(MAT_DIALOG_DATA);
}

@Component({
  selector: 'app-add-edit-activities',
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  templateUrl: './add-edit-activities.html',
})
export class AddEditActivitiesDialog {
  readonly fb = inject(FormBuilder);
  readonly data = inject<Activity | undefined>(MAT_DIALOG_DATA, { optional: true });
  readonly dialogRef = inject(MatDialogRef<AddEditActivitiesDialog>);

  activityForm: FormGroup;
  isEditMode: boolean;

  constructor() {
    this.isEditMode = !!this.data;

    this.activityForm = this.fb.group(
      {
        name: [this.data?.name || '', [Validators.required, this.noWhitespaceValidator()]],
        serviceType: [this.data?.serviceType || '', Validators.required],
        scheduleDate: [this.data?.scheduleDate || '', Validators.required],
        scheduleTime: [this.data?.scheduleTime || '', Validators.required],
        location: [this.data?.location || '', [Validators.required, this.noWhitespaceValidator()]],
        registered: [this.data?.registered || 0],
        totalSlots: [this.data?.totalSlots || 0, [Validators.required, Validators.min(1)]],
        cutoffDate: [this.data?.cutoffDate || '', Validators.required],
        cutoffTime: [this.data?.cutoffTime || '', Validators.required],
        description: [
          this.data?.description || '',
          [Validators.required, this.noWhitespaceValidator()],
        ],
      },
      { validators: [this.cutoffBeforeScheduleValidator, this.slotFloorValidator] },
    );
  }

  noWhitespaceValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (typeof value !== 'string') {
        return null;
      }

      return value.trim().length === 0 ? { whitespace: true } : null;
    };
  }

  cutoffBeforeScheduleValidator(form: FormGroup) {
    const scheduleDate = form.get('scheduleDate')?.value;
    const scheduleTime = form.get('scheduleTime')?.value;
    const cutoffDate = form.get('cutoffDate')?.value;
    const cutoffTime = form.get('cutoffTime')?.value;

    if (!scheduleDate || !scheduleTime || !cutoffDate || !cutoffTime) {
      return null;
    }

    const scheduleDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
    const cutoffDateTime = new Date(`${cutoffDate}T${cutoffTime}`);

    if (cutoffDateTime >= scheduleDateTime) {
      return { cutoffAfterSchedule: true };
    }

    return null;
  }

  slotFloorValidator(form: FormGroup) {
    const registered = Number(form.get('registered')?.value ?? 0);
    const totalSlots = Number(form.get('totalSlots')?.value ?? 0);

    if (Number.isFinite(registered) && Number.isFinite(totalSlots) && totalSlots < registered) {
      return { slotBelowRegistered: true };
    }

    return null;
  }

  onSubmit() {
    if (this.activityForm.valid) {
      const value = this.activityForm.value;
      this.dialogRef.close({
        ...value,
        name: value.name.trim(),
        serviceType: value.serviceType.trim(),
        location: value.location.trim(),
        cutoffDate: value.cutoffDate.trim(),
        cutoffTime: value.cutoffTime.trim(),
        description: value.description.trim(),
      });
    }
  }
}
