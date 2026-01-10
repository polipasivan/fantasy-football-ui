import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PlayerService, Player } from '../services/player.service';

interface DraftData {
  [key: string]: string;
}

interface ExportEntry {
  team: string;
  round: number;
  player: string;
  timestamp: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})


export class DashboardComponent implements OnInit {
  teams: string[] = [
    'Team Alpha', 'Team Bravo', 'Team Charlie', 'Team Delta',
    'Team Echo', 'Team Foxtrot', 'Team Golf', 'Team Hotel'
  ];

  rounds: number = 15;
  roundNumbers: number[] = [];
  draftData: DraftData = {};
  editingCell: string | null = null;
  playerName: string = '';

  // Autocomplete properties
  allPlayers: Player[] = [];
  filteredPlayers: Player[] = [];
  showSuggestions: boolean = false;
  selectedSuggestionIndex: number = -1;

  constructor(private playerService: PlayerService) {}

  ngOnInit(): void {
    console.log("IM ALIVE!")
    this.roundNumbers = Array.from({ length: this.rounds }, (_, i) => i + 1);
    this.loadData();
    this.loadPlayers();
  }

  loadPlayers(): void {
    this.playerService.loadPlayers().subscribe(players => {
      this.allPlayers = players;
      console.log(`Loaded ${players.length} players from CSV`);
    });
  }

  getCellKey(team: string, round: number): string {
    console.log(`${team}_round_${round}`)
    return `${team}_round_${round}`;
  }

  getPlayer(team: string, round: number): string | undefined {
    return this.draftData[this.getCellKey(team, round)];
  }

  getPlayerPosition(team: string, round: number): string {
    const playerName = this.getPlayer(team, round);
    if (!playerName) return '';

    const player = this.allPlayers.find(p => p.name === playerName);
    if (!player) return '';

    // Extract just the position letters (QB, RB, WR, etc.) from position like "RB2"
    const positionMatch = player.position.match(/^[A-Z]+/);
    return positionMatch ? positionMatch[0] : '';
  }

  getPositionClass(team: string, round: number): string {
    const position = this.getPlayerPosition(team, round);
    return `position-${position.toLowerCase()}`;
  }

  isEditing(team: string, round: number): boolean {
    return this.editingCell === this.getCellKey(team, round);
  }

  startEditing(team: string, round: number): void {
    this.editingCell = this.getCellKey(team, round);
    this.playerName = '';
    this.showSuggestions = false;
    this.selectedSuggestionIndex = -1;
  }

  onPlayerInput(): void {
    if (!this.playerName || this.playerName.trim().length === 0) {
      this.showSuggestions = false;
      this.filteredPlayers = [];
      return;
    }

    // Get list of already drafted players
    const draftedPlayers = new Set(Object.values(this.draftData));

    // Filter players: match name AND not already drafted
    this.filteredPlayers = this.allPlayers.filter(player =>
      player.name.toLowerCase().includes(this.playerName.toLowerCase()) &&
      !draftedPlayers.has(player.name)
    ).slice(0, 10); // Limit to 10 suggestions

    this.showSuggestions = this.filteredPlayers.length > 0;
    this.selectedSuggestionIndex = -1;
  }

  selectPlayer(player: Player): void {
    this.playerName = player.name;
    this.showSuggestions = false;
  }

  onKeyDown(event: KeyboardEvent, team: string, round: number): void {
    if (!this.showSuggestions || this.filteredPlayers.length === 0) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedSuggestionIndex = Math.min(
          this.selectedSuggestionIndex + 1,
          this.filteredPlayers.length - 1
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.selectedSuggestionIndex = Math.max(this.selectedSuggestionIndex - 1, -1);
        break;
      case 'Enter':
        event.preventDefault();
        if (this.selectedSuggestionIndex >= 0) {
          this.selectPlayer(this.filteredPlayers[this.selectedSuggestionIndex]);
        } else if (this.filteredPlayers.length === 1) {
          this.selectPlayer(this.filteredPlayers[0]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        this.showSuggestions = false;
        break;
    }
  }

  addPlayer(team: string, round: number): void {
    const trimmedName = this.playerName.trim();
    if (!trimmedName) return;

    // Check if player exists in CSV
    const playerExists = this.allPlayers.some(p => p.name === trimmedName);
    if (!playerExists) {
      alert('Player not found in the player list. Please select a player from the suggestions.');
      return;
    }

    // Check if player is already drafted
    const alreadyDrafted = Object.values(this.draftData).includes(trimmedName);
    if (alreadyDrafted) {
      alert('This player has already been drafted!');
      return;
    }

    const key = this.getCellKey(team, round);
    this.draftData[key] = trimmedName;
    this.playerName = '';
    this.editingCell = null;
    this.showSuggestions = false;
    this.saveData();
  }

  removePlayer(team: string, round: number): void {
    const key = this.getCellKey(team, round);
    delete this.draftData[key];
    this.saveData();
  }

  cancelEditing(): void {
    this.editingCell = null;
    this.playerName = '';
    this.showSuggestions = false;
    this.selectedSuggestionIndex = -1;
  }

  clearPlayerName(): void {
    this.playerName = '';
    this.showSuggestions = false;
    this.filteredPlayers = [];
    this.selectedSuggestionIndex = -1;
  }

  onKeyPress(event: KeyboardEvent, team: string, round: number): void {
    // Enter key is handled in onKeyDown for dropdown navigation
    // This is just a backup for when dropdown is not showing
    if (event.key === 'Enter' && !this.showSuggestions) {
      event.preventDefault();
      this.addPlayer(team, round);
    }
  }

  exportData(): void {
    const exports: { [key: string]: ExportEntry } = {};
    
    this.teams.forEach(team => {
      for (let round = 1; round <= this.rounds; round++) {
        const key = this.getCellKey(team, round);
        if (this.draftData[key]) {
          exports[key] = {
            team,
            round,
            player: this.draftData[key],
            timestamp: new Date().toISOString()
          };
        }
      }
    });
    
    const blob = new Blob([JSON.stringify(exports, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fantasy-draft-data.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target?.result as string);
          const newData: DraftData = {};
          
          Object.values(imported).forEach((entry: any) => {
            const key = this.getCellKey(entry.team, entry.round);
            newData[key] = entry.player;
          });
          
          this.draftData = newData;
          this.saveData();
        } catch (error) {
          alert('Error importing file');
        }
      };
      reader.readAsText(file);
    }
    
    // Reset input
    input.value = '';
  }

  private saveData(): void {
    localStorage.setItem('fantasyDraft', JSON.stringify(this.draftData));
  }

  private loadData(): void {
    const stored = localStorage.getItem('fantasyDraft');
    if (stored) {
      this.draftData = JSON.parse(stored);
    }
  }
}
