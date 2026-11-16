import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmployeeDashboardPage } from './employee-dashboard';

describe('EmployeeDashboard', () => {
let component: EmployeeDashboardPage;
let fixture: ComponentFixture<EmployeeDashboardPage>;


  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmployeeDashboardPage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EmployeeDashboardPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
