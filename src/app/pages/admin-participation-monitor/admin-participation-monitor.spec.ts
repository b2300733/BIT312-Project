import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminParticipationMonitor } from './admin-participation-monitor';

describe('AdminParticipationMonitor', () => {
  let component: AdminParticipationMonitor;
  let fixture: ComponentFixture<AdminParticipationMonitor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminParticipationMonitor]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminParticipationMonitor);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
