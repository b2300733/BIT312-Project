export interface Activity {
  _id?: string;
  name: string;
  serviceType: string;
  scheduleDate: string;
  scheduleTime: string;
  location: string;
  registered: number;
  totalSlots: number;
  cutoffDate: string;
  cutoffTime: string;
  description: string;
  createdAt?: string;
  updatedAt?: string;
}
