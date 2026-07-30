import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PlayerService, Player } from '../services/player.service';
import { ThemeService } from '../services/theme.service';
import { DraftApiService } from '../services/draft-api.service';

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
  // Teams start empty — teams are added via the "Add Team" column.
  teams: string[] = [];

  rounds: number = 15;
  season: number = 2026;
  roundNumbers: number[] = [];
  draftData: DraftData = {};
  editingCell: string | null = null;
  playerName: string = '';

  // Autocomplete properties
  allPlayers: Player[] = [];
  filteredPlayers: Player[] = [];
  showSuggestions: boolean = false;
  selectedSuggestionIndex: number = -1;

  // Add-team modal state
  showAddTeamModal: boolean = false;
  newTeamName: string = '';
  addingTeam: boolean = false;
  addTeamError: string = '';

  constructor(
    private playerService: PlayerService,
    public theme: ThemeService,
    private draftApi: DraftApiService
  ) {}

  ngOnInit(): void {
    this.roundNumbers = Array.from({ length: this.rounds }, (_, i) => i + 1);
    this.loadPlayers();
    this.loadDraftBoard();
  }

  loadPlayers(): void {
    this.playerService.loadPlayers().subscribe(players => {
      this.allPlayers = players;
      console.log(`Loaded ${players.length} players from CSV`);
    });
  }

  // Load all teams + drafted players for the current session from the backend.
  loadDraftBoard(): void {
    this.draftApi.getDraftBoard().subscribe({
      next: (res) => {
        const teams: string[] = [];
        const draftData: DraftData = {};
        (res.teams ?? []).forEach(team => {
          teams.push(team.teamName);
          (team.players ?? []).forEach(player => {
            draftData[this.getCellKey(team.teamName, player.round)] = player.name;
          });
        });
        this.teams = teams;
        this.draftData = draftData;
      },
      error: (err) => {
        console.error('Failed to load draft board', err);
      }
    });
  }

  // ---------- Add-team modal ----------

  openAddTeamModal(): void {
    this.showAddTeamModal = true;
    this.newTeamName = '';
    this.addTeamError = '';
    this.addingTeam = false;
  }

  closeAddTeamModal(): void {
    if (this.addingTeam) return;
    this.showAddTeamModal = false;
    this.newTeamName = '';
    this.addTeamError = '';
  }

  confirmAddTeam(): void {
    const name = this.newTeamName.trim();
    if (!name) {
      this.addTeamError = 'Please enter a team name.';
      return;
    }
    if (this.teams.includes(name)) {
      this.addTeamError = 'That team is already on the board.';
      return;
    }

    this.addingTeam = true;
    this.addTeamError = '';

    this.draftApi.addTeam(name).subscribe({
      next: (team) => {
        this.teams.push(team?.teamName ?? name);
        this.addingTeam = false;
        this.showAddTeamModal = false;
        this.newTeamName = '';
      },
      error: (err) => {
        this.addingTeam = false;
        this.addTeamError = err?.status === 409
          ? 'A team with that name already exists.'
          : 'Failed to add team. Please try again.';
      }
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

  getPlayerTeam(team: string, round: number): string {
    const playerName = this.getPlayer(team, round);
    if (!playerName) return '';
    const player = this.allPlayers.find(p => p.name === playerName);
    return player ? player.team : '';
  }

  getTeamMonogram(team: string): string {
    const words = team.trim().split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return '?';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }

  getTeamColorClass(teamIndex: number): string {
    return `avatar-color-${teamIndex % 10}`;
  }

  // Snake-draft overall pick number for a given team column and round
  getPickNumber(teamIndex: number, round: number): number {
    const teamCount = this.teams.length;
    const base = (round - 1) * teamCount;
    // Odd rounds go left -> right, even rounds snake right -> left
    return round % 2 === 1
      ? base + teamIndex + 1
      : base + (teamCount - teamIndex);
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
    const csvPlayer = this.allPlayers.find(p => p.name === trimmedName);
    if (!csvPlayer) {
      alert('Player not found in the player list. Please select a player from the suggestions.');
      return;
    }

    // Check if player is already drafted
    const alreadyDrafted = Object.values(this.draftData).includes(trimmedName);
    if (alreadyDrafted) {
      alert('This player has already been drafted!');
      return;
    }

    const position = csvPlayer.position.match(/^[A-Z]+/)?.[0] ?? '';
    const key = this.getCellKey(team, round);

    // Optimistic update so the pick shows immediately.
    this.draftData[key] = trimmedName;
    this.playerName = '';
    this.editingCell = null;
    this.showSuggestions = false;
    this.saveData();

    // Persist the pick under the correct team + round.
    this.draftApi.addPlayer(team, { round, name: trimmedName, position }).subscribe({
      error: (err) => {
        // Roll back the optimistic update if the server rejects it.
        delete this.draftData[key];
        this.saveData();
        alert(err?.status === 404
          ? 'That team was not found on the server.'
          : 'Failed to save the pick. Please try again.');
      }
    });
  }

  removePlayer(team: string, round: number): void {
    const key = this.getCellKey(team, round);
    const previous = this.draftData[key];

    // Optimistic removal so the cell clears immediately.
    delete this.draftData[key];
    this.saveData();

    // Persist the removal for the specific team + round.
    this.draftApi.deletePlayer(team, round).subscribe({
      error: (err) => {
        // Roll back if the server rejects it.
        if (previous !== undefined) {
          this.draftData[key] = previous;
          this.saveData();
        }
        console.error('Failed to delete player', err);
        alert('Failed to remove the player. Please try again.');
      }
    });
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
}
