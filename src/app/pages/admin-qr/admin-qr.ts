import { Component, ElementRef, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { MatSort, Sort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { QRCodeComponent } from 'angularx-qrcode';
import QrScanner from 'qr-scanner';
import {
  QrCode,
  Download,
  Calendar,
  MapPin,
  Users,
  UserCheck,
  X,
  View,
  ScanLine,
} from 'lucide-angular';
import { COMMON_PAGES_MODULES } from '../../module/common.pages.module';
import { Activity } from '../../models/activity.model';
import { ActivitiesService } from '../../../../backend/services/activities.service';
import { QrService, CheckInRecord } from '../../../../backend/services/qr.service';
import { finalize } from 'rxjs';

export type { CheckInRecord };

@Component({
  selector: 'app-admin-qr',
  imports: [
    CommonModule,
    FormsModule,
    COMMON_PAGES_MODULES,
    MatFormFieldModule,
    MatSelectModule,
    MatTableModule,
    MatSortModule,
    MatSnackBarModule,
    QRCodeComponent,
  ],
  templateUrl: './admin-qr.html',
  styleUrl: './admin-qr.css',
})
export class AdminQrPage implements OnInit, OnDestroy {
  readonly QrCode = QrCode;
  readonly Download = Download;
  readonly Calendar = Calendar;
  readonly MapPin = MapPin;
  readonly Users = Users;
  readonly UserCheck = UserCheck;
  readonly X = X;
  readonly View = View;
  readonly ScanLine = ScanLine;

  private qrService = inject(QrService);
  private activitiesService = inject(ActivitiesService);
  private _liveAnnouncer = inject(LiveAnnouncer);
  private snackBar = inject(MatSnackBar);

  activities: Activity[] = [];
  selectedActivity: Activity | null = null;
  dataSource = new MatTableDataSource<CheckInRecord>([]);
  displayedColumns = ['qr', 'employee', 'status', 'checkedInAt'];
  selectedQrRecord: CheckInRecord | null = null;
  showScanOverlay = false;
  scanMessage = '';
  scanStatus: 'idle' | 'scanning' | 'success' | 'error' = 'idle';
  isGenerating = false;
  private scanner: QrScanner | null = null;
  private lastDecodeErrorAt = 0;

  constructor() {
    this.dataSource.sortingDataAccessor = (row, column) => {
      switch (column) {
        case 'employee':
          return row.employeeName;
        case 'status':
          return row.status;
        case 'checkedInAt':
          return row.checkedInAt ?? '';
        default:
          return '';
      }
    };
  }

  @ViewChild(MatSort) set sort(sort: MatSort) {
    if (sort) this.dataSource.sort = sort;
  }

  @ViewChild('qrVideo') qrVideo?: ElementRef<HTMLVideoElement>;

  get isQrGenerated(): boolean {
    return this.dataSource.data.some((record) => !!record.qrData);
  }

  get checkedInCount(): number {
    return this.dataSource.data.filter((r) => r.status === 'checked-in').length;
  }

  get pendingCount(): number {
    return this.dataSource.data.filter((r) => r.status === 'pending').length;
  }

  get isCutoffPassed(): boolean {
    if (!this.selectedActivity) return false;
    const cutoffDateTime = new Date(
      `${this.selectedActivity.cutoffDate}T${this.selectedActivity.cutoffTime}`,
    );
    return !Number.isNaN(cutoffDateTime.getTime()) && cutoffDateTime < new Date();
  }

  announceSortChange(sortState: Sort): void {
    if (sortState.direction) {
      this._liveAnnouncer.announce(`Sorted ${sortState.direction}ending`);
    } else {
      this._liveAnnouncer.announce('Sorting cleared');
    }
  }

  ngOnInit(): void {
    this.activitiesService.fetchActivities().subscribe({
      next: (activities) => {
        this.activities = activities;
      },
      error: (err) => {
        console.error('Failed to load activities:', err);
      },
    });
  }

  ngOnDestroy(): void {
    this.stopScanner();
  }

  onActivityChange(): void {
    if (!this.selectedActivity) {
      this.dataSource.data = [];
      return;
    }
    const activityId = this.selectedActivity._id;
    if (!activityId) {
      this.dataSource.data = [];
      return;
    }
    this.qrService.getCheckInRecords(activityId).subscribe({
      next: (records) => {
        this.dataSource.data = records;
      },
      error: (err) => {
        console.error('Failed to load registrations:', err);
      },
    });
  }

  generateQrCodes(): void {
    if (!this.selectedActivity?._id || !this.isCutoffPassed || this.isGenerating) return;

    this.isGenerating = true;
    this.qrService
      .generateQrCodes(this.selectedActivity._id)
      .pipe(
        finalize(() => {
          this.isGenerating = false;
        }),
      )
      .subscribe({
        next: (records) => {
          this.dataSource.data = records;
          this.showSnackbar('QR codes generated and emailed to employees.');
        },
        error: (err) => {
          console.error('Failed to generate QR codes:', err);
          this.showSnackbar('Failed to generate QR codes. Please try again.');
        },
      });
  }

  openScanOverlay(): void {
    if (!this.selectedActivity?._id) return;
    this.showScanOverlay = true;
    this.scanStatus = 'scanning';
    this.scanMessage = 'Scanning for QR codes...';
    setTimeout(() => {
      this.startScanner();
    }, 0);
  }

  closeScanOverlay(): void {
    this.showScanOverlay = false;
    this.scanStatus = 'idle';
    this.stopScanner();
  }

  openQrView(record: CheckInRecord): void {
    this.selectedQrRecord = record;
  }

  closeQrView(): void {
    this.selectedQrRecord = null;
  }

  downloadQr(record: CheckInRecord): void {
    this.qrService.downloadQr(record);
  }

  formatCheckedInAt(value: string | null): string {
    if (!value) {
      return '--';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '--';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }

  private async startScanner(): Promise<void> {
    if (!this.qrVideo?.nativeElement) {
      this.scanMessage = 'Camera element not ready yet.';
      return;
    }

    this.stopScanner();
    this.scanner = new QrScanner(this.qrVideo.nativeElement, (result) => this.handleScan(result), {
      returnDetailedScanResult: true,
      onDecodeError: () => this.handleDecodeError(),
    });

    try {
      await this.scanner.start();
      this.scanStatus = 'scanning';
      this.scanMessage = 'Scanning for QR codes...';
    } catch (err) {
      console.error('Failed to start scanner:', err);
      this.scanStatus = 'error';
      this.scanMessage = 'Camera access failed. Check permissions.';
    }
  }

  private stopScanner(): void {
    if (this.scanner) {
      this.scanner.stop();
      this.scanner.destroy();
      this.scanner = null;
    }

    if (this.qrVideo?.nativeElement) {
      this.qrVideo.nativeElement.srcObject = null;
    }
  }

  private handleScan(result: string | { data: string }): void {
    const data = typeof result === 'string' ? result : result.data;
    const activityId = this.selectedActivity?._id;
    if (!activityId) return;

    const expectedPrefix = `serviceday:${activityId}:`;
    if (!data.startsWith(expectedPrefix)) {
      this.scanStatus = 'error';
      this.scanMessage = 'This QR code is for a different activity.';
      return;
    }

    const match = this.dataSource.data.find((record) => record.qrData === data);
    if (!match) {
      this.scanStatus = 'error';
      this.scanMessage = 'QR code not found in this activity list.';
      return;
    }

    this.qrService.checkInByQr(data).subscribe({
      next: (updated) => {
        const nextRows = this.dataSource.data.map((row) =>
          row.qrData === updated.qrData ? { ...row, ...updated } : row,
        );
        this.dataSource.data = nextRows;
        this.scanStatus = 'success';
        this.scanMessage = `Checked in: ${updated.employeeName}`;
      },
      error: (err) => {
        console.error('Failed to check in:', err);
        this.scanStatus = 'error';
        this.scanMessage = 'Check-in failed. Please try again.';
      },
    });
  }

  private handleDecodeError(): void {
    const now = Date.now();
    if (now - this.lastDecodeErrorAt < 1200) return;
    this.lastDecodeErrorAt = now;
    if (this.scanStatus !== 'success') {
      this.scanStatus = 'scanning';
      this.scanMessage = 'Scanning for QR codes...';
    }
  }

  private showSnackbar(message: string): void {
    this.snackBar.open(message, '', {
      duration: 4000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
    });
  }
}
