import { Component, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DRAFT_ROOMS, DraftRoom } from '../constants';
import { SessionService } from '../services/session.service';

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

  constructor(
    private sessionService: SessionService,
    private router: Router,
    private elementRef: ElementRef<HTMLElement>
  ) {}

  toggleDropdown(): void {
    this.dropdownOpen = !this.dropdownOpen;
  }

  chooseRoom(room: DraftRoom): void {
    this.selectedRoom = room;
    this.dropdownOpen = false;
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

  enterDraft(): void {
    this.sessionService.selectRoom(this.selectedRoom);
    this.router.navigateByUrl('/');
  }
}
