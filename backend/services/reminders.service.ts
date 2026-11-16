import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ReminderPayload {
  activity: string;
  type: string;
  scheduledFor?: string;
}

export interface ReminderResponse {
  _id: string;
  activity: string;
  type: string;
  scheduledFor: string;
  status: 'sent' | 'pending';
  createdAt: string;
  updatedAt: string;
}

export interface BroadcastPayload {
  title: string;
  message: string;
}

export interface SendResponse {
  sent: number;
  reminder?: ReminderResponse;
}

export interface DeleteResponse {
  message: string;
}

const API_URL = '/api/reminders';

@Injectable({
  providedIn: 'root',
})
export class RemindersService {
  private http = inject(HttpClient);

  listReminders(): Observable<ReminderResponse[]> {
    return this.http.get<ReminderResponse[]>(API_URL);
  }

  createReminder(payload: ReminderPayload): Observable<ReminderResponse> {
    return this.http.post<ReminderResponse>(API_URL, payload);
  }

  sendBroadcast(payload: BroadcastPayload): Observable<SendResponse> {
    return this.http.post<SendResponse>(`${API_URL}/broadcast`, payload);
  }

  sendReminderNow(id: string): Observable<SendResponse> {
    return this.http.post<SendResponse>(`${API_URL}/${id}/send`, {});
  }

  updateReminderStatus(id: string, status: 'sent' | 'pending'): Observable<ReminderResponse> {
    return this.http.put<ReminderResponse>(`${API_URL}/${id}`, { status });
  }

  deleteReminder(id: string): Observable<DeleteResponse> {
    return this.http.delete<DeleteResponse>(`${API_URL}/${id}`);
  }
}
