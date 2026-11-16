import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  LucideAngularModule,
  Heart,
  Bell,
  LogOut,
  CheckCheck,
  Megaphone,
  Check,
} from 'lucide-angular';
import { AuthService } from '../../../../backend/services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './header.html',
})
export class HeaderComponent {
  readonly Heart = Heart;
  readonly Bell = Bell;
  readonly LogOut = LogOut;
  readonly CheckCheck = CheckCheck;
  readonly Megaphone = Megaphone;
  readonly Check = Check;

  unreadCount = 0;
  notifications: Notification[] = [];
  isDropdownOpen = false;

  constructor(
    private router: Router,
    public authService: AuthService,
  ) {}

  signOut() {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: () => {
        this.router.navigate(['/login']);
      },
    });
  }
}
