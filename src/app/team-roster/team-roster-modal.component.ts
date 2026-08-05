import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RosterBreakdown } from './roster';

@Component({
  selector: 'app-team-roster-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './team-roster-modal.component.html',
  styleUrls: ['./team-roster-modal.component.css']
})
export class TeamRosterModalComponent {
  @Input() team: string | null = null;
  @Input() teamIndex: number = 0;
  @Input() roster: RosterBreakdown | null = null;
  @Input() loading: boolean = false;
  @Output() closed = new EventEmitter<void>();

  close(): void {
    this.closed.emit();
  }

  getTeamMonogram(team: string): string {
    const words = team.trim().split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return '?';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }

  getTeamColorClass(): string {
    return `avatar-color-${this.teamIndex % 10}`;
  }
}
