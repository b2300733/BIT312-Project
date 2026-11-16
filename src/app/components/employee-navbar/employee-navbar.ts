import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideAngularModule, Search, CalendarCheck, Bell, QrCode } from 'lucide-angular';

@Component({
  selector: 'app-employee-navbar',
  imports: [RouterLink, RouterLinkActive, LucideAngularModule],
  templateUrl: './employee-navbar.html',
  styleUrl: './employee-navbar.css',
})
export class EmployeeNavbarComponent {
  readonly Search = Search;
  readonly CalendarCheck = CalendarCheck;
  readonly Bell = Bell;
  readonly QrCode = QrCode;
}
