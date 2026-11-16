import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmployeeActivitiesComponent } from './employee-activities';

describe('EmployeeActivitiesComponent', () => {
  let component: EmployeeActivitiesComponent;
  let fixture: ComponentFixture<EmployeeActivitiesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmployeeActivitiesComponent] // standalone import
    }).compileComponents();

    fixture = TestBed.createComponent(EmployeeActivitiesComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should open and close details modal', () => {
    const activity = component.activities[0];
    
    component.openDetails(activity);
    expect(component.selectedActivity).toBe(activity);

    component.closeDetails();
    expect(component.selectedActivity).toBeNull();
  });
});