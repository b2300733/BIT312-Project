import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmployeeCheckinComponent } from './employee-qr';

describe('EmployeeCheckinComponent', () => {
  let component: EmployeeCheckinComponent;
  let fixture: ComponentFixture<EmployeeCheckinComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmployeeCheckinComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(EmployeeCheckinComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should filter activities based on search term', () => {
    component.searchTerm = 'Green Earth';
    expect(component.filteredActivities.length).toBe(1);
    expect(component.filteredActivities[0].title).toBe('Green Earth Foundation');
  });

  it('should toggle QR visibility', () => {
    const activity = component.activities[0];
    activity.showQr = false;

    component.toggleQr(activity);
    expect(activity.showQr).toBe(true);

    component.toggleQr(activity);
    expect(activity.showQr).toBe(false);
  });
});