import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CheckInRecord {
  _id?: string;
  employeeId?: string;
  employeeName: string;
  email: string;
  department?: string;
  activityId?: string;
  activityName?: string;
  qrchecked?: boolean;
  status: 'pending' | 'checked-in';
  checkedInAt: string | null;
  qrData: string | null;
}

const API_URL = '/api/registrations';

@Injectable({ providedIn: 'root' })
export class QrService {
  private http = inject(HttpClient);

  getCheckInRecords(activityId: string): Observable<CheckInRecord[]> {
    return this.http.get<CheckInRecord[]>(
      `${API_URL}/with-employee?activityId=${encodeURIComponent(activityId)}`,
    );
  }

  generateQrCodes(activityId: string): Observable<CheckInRecord[]> {
    return this.http.post<CheckInRecord[]>(`${API_URL}/generate-qr`, { activityId });
  }

  checkInByQr(qrData: string): Observable<CheckInRecord> {
    return this.http.post<CheckInRecord>(`${API_URL}/check-in`, { qrData });
  }

  async downloadQr(record: CheckInRecord): Promise<void> {
    if (!record.qrData) return;

    const fileName = this.buildFileName(record.employeeName);
    const url = this.buildQrUrl(record.qrData, 400, 'png');

    try {
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) {
        throw new Error(`QR download failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      this.triggerDownload(objectUrl, fileName);
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('Failed to download QR code:', error);
      this.triggerDownload(url, fileName);
    }
  }

  private buildFileName(employeeName: string): string {
    const normalized = employeeName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    return `qr-${normalized || 'employee'}.png`;
  }

  private triggerDownload(url: string, fileName: string): void {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    link.click();
  }

  private buildQrUrl(data: string, size: number, format = 'png'): string {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&format=${format}&data=${encodeURIComponent(data)}`;
  }
}
