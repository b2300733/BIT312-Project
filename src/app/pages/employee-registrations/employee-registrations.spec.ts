import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmployeeRegistrationsComponent } from './employee-registrations';

describe('EmployeeRegistrationsComponent', () => {
  let component: EmployeeRegistrationsComponent;
  let fixture: ComponentFixture<EmployeeRegistrationsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmployeeRegistrationsComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(EmployeeRegistrationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should remove a registration when cancelRegistration is called', () => {
    const initialLength = component.registrations.length;
    expect(initialLength).toBeGreaterThan(0);

    const idToCancel = component.registrations[0].id;
    component.cancelRegistration(idToCancel);

    expect(component.registrations.length).toBe(initialLength - 1);
    expect(component.registrations.find(r => r.id === idToCancel)).toBeUndefined();
  });
});