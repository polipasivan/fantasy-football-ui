import { Component, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DRAFT_ROOMS, DraftRoom } from '../constants';
import { SessionService } from '../services/session.service';
import { SettingsApiService } from '../services/settings-api.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  rooms: DraftRoom[] = DRAFT_ROOMS;
  selectedRoom: DraftRoom = this.rooms[0];
  commissionerPassword: string = '';
  dropdownOpen: boolean = false;

  verifying = false;
  passwordError: string | null = null;

  constructor(
    private sessionService: SessionService,
    private settingsApi: SettingsApiService,
    private router: Router,
    private elementRef: ElementRef<HTMLElement>
  ) {}

  toggleDropdown(): void {
    this.dropdownOpen = !this.dropdownOpen;
  }

  chooseRoom(room: DraftRoom): void {
    this.selectedRoom = room;
    this.dropdownOpen = false;
    // A password error from a previous attempt was checked against the old room —
    // it no longer applies once the target room changes.
    this.passwordError = null;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.dropdownOpen && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.dropdownOpen = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.dropdownOpen = false;
  }

  // Clears any error left over from a previous failed attempt as soon as the user
  // starts fixing the field.
  onPasswordInput(): void {
    this.passwordError = null;
  }

  enterDraft(): void {
    if (this.verifying) return;

    const password = this.commissionerPassword.trim();

    // Cleared password -> allowed in as a regular user, no verification needed.
    if (!password) {
      this.sessionService.selectRoom(this.selectedRoom);
      this.sessionService.clearCommissionerPassword();
      this.router.navigateByUrl('/');
      return;
    }

    // Verify up front against the room being entered — not necessarily the one
    // already selected in storage, so this deliberately doesn't touch session state
    // (selectRoom/setCommissionerPassword) until verification actually succeeds.
    this.verifying = true;
    this.passwordError = null;

    this.settingsApi.verifyCommissioner(this.selectedRoom.sessionId, password).subscribe({
      next: () => {
        this.verifying = false;
        this.sessionService.selectRoom(this.selectedRoom);
        this.sessionService.setCommissionerPassword(password);
        this.router.navigateByUrl('/');
      },
      error: (err) => {
        this.verifying = false;
        this.passwordError = err?.status === 403
          ? 'Invalid admin password.'
          : 'Failed to verify password. Please try again.';
      }
    });
  }
}
