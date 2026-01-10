import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlayerService, Player } from '../services/player.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-players',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './players.component.html',
  styleUrl: './players.component.css'
})
export class PlayersComponent implements OnInit {
  allPlayers: Player[] = [];
  filteredPlayers: Player[] = [];
  draftedPlayers: Set<string> = new Set();

  // Filter options
  selectedTeam: string = '';
  selectedPosition: string = '';

  // Unique teams and positions from CSV
  teams: string[] = [];
  positions: string[] = [];

  constructor(private playerService: PlayerService) {}

  ngOnInit(): void {
    this.playerService.loadPlayers().subscribe(players => {
      this.allPlayers = players;
      this.filteredPlayers = players;
      this.extractUniqueValues();
      this.loadDraftedPlayers();
    });
  }

  loadDraftedPlayers(): void {
    this.draftedPlayers = this.playerService.getDraftedPlayers();
  }

  extractUniqueValues(): void {
    // Get unique teams
    const teamSet = new Set(this.allPlayers.map(p => p.team));
    this.teams = Array.from(teamSet).sort();

    // Get unique position prefixes (QB, RB, WR, etc.)
    const positionSet = new Set(
      this.allPlayers
        .map(p => p.position.match(/^[A-Z]+/)?.[0])
        .filter(p => p !== undefined)
    );
    this.positions = Array.from(positionSet as Set<string>).sort();
  }

  applyFilters(): void {
    this.filteredPlayers = this.allPlayers.filter(player => {
      const teamMatch = !this.selectedTeam || player.team === this.selectedTeam;

      const playerPosition = player.position.match(/^[A-Z]+/)?.[0] || '';
      const positionMatch = !this.selectedPosition || playerPosition === this.selectedPosition;

      return teamMatch && positionMatch;
    });
  }

  clearFilters(): void {
    this.selectedTeam = '';
    this.selectedPosition = '';
    this.filteredPlayers = this.allPlayers;
  }

  getPositionPrefix(position: string): string {
    return position.match(/^[A-Z]+/)?.[0] || '';
  }

  getPositionClass(position: string): string {
    const pos = this.getPositionPrefix(position).toLowerCase();
    return `position-${pos}`;
  }

  isDrafted(playerName: string): boolean {
    return this.draftedPlayers.has(playerName);
  }
}
