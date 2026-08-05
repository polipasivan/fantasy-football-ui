import { Component, DestroyRef, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { EMPTY, catchError, interval, switchMap } from 'rxjs';
import { PlayerService, Player } from '../services/player.service';
import { ThemeService } from '../services/theme.service';
import { SessionService } from '../services/session.service';
import { DraftApiService, DraftPlayer, DraftBoardResponse } from '../services/draft-api.service';
import { TeamRosterModalComponent } from '../team-roster/team-roster-modal.component';
import { RosterBreakdown, buildRosterBreakdown, hasOpenRosterSlot as hasOpenSlotInBreakdown } from '../team-roster/roster';

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
  imports: [CommonModule, FormsModule, RouterLink, TeamRosterModalComponent],
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
  rosterError: string | null = null;

  // Per-team roster breakdown (starters + bench), kept in sync with draftData.
  teamRosters: Record<string, RosterBreakdown> = {};

  // Team roster modal state
  selectedRosterTeam: string | null = null;

  // Loading state — the board table stays hidden behind a spinner until both loads settle.
  playersLoaded: boolean = false;
  boardLoaded: boolean = false;

  // How often other viewers' boards poll the backend for changes made by the commissioner.
  private readonly pollIntervalMs = 4000;

  // Cell keys with a player write currently in flight. A poll tick landing mid-write (or
  // before a failed write has rolled back) must not clobber that optimistic local state
  // with the stale server response — this set tells applyDraftBoard() what to leave alone.
  // (Team adds don't need the same guard: confirmAddTeam only mutates `teams` after the
  // server confirms, so there's no optimistic state for a poll to race against.)
  private pendingCellWrites = new Set<string>();

  isLoading(): boolean {
    return !this.playersLoaded || !this.boardLoaded;
  }

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
    private draftApi: DraftApiService,
    private sessionService: SessionService,
    private router: Router,
    private destroyRef: DestroyRef
  ) {}

  leaveDraft(): void {
    this.sessionService.clearSession();
    this.router.navigateByUrl('/login');
  }

  ngOnInit(): void {
    this.roundNumbers = Array.from({ length: this.rounds }, (_, i) => i + 1);
    this.loadPlayers();
    this.loadDraftBoard();
    this.startPolling();
  }

  loadPlayers(): void {
    this.playerService.loadPlayers().subscribe({
      next: (players) => {
        this.allPlayers = players;
        console.log(`Loaded ${players.length} players from CSV`);
        this.playersLoaded = true;
      },
      error: (err) => {
        console.error('Failed to load players', err);
        this.playersLoaded = true;
      }
    });
  }

  // Load all teams + drafted players for the current session from the backend.
  loadDraftBoard(): void {
    this.draftApi.getDraftBoard().subscribe({
      next: (res) => {
        this.applyDraftBoard(res);
        this.boardLoaded = true;
      },
      error: (err) => {
        console.error('Failed to load draft board', err);
        this.boardLoaded = true;
      }
    });
  }

  // Poll the backend on an interval so every open tab (commissioner and viewers alike)
  // picks up picks/removals/teams made from someone else's tab. A failed tick is logged
  // and skipped rather than killing the interval — the next tick just tries again.
  private startPolling(): void {
    interval(this.pollIntervalMs)
      .pipe(
        switchMap(() => this.draftApi.getDraftBoard().pipe(
          catchError((err) => {
            console.error('Draft board poll failed', err);
            return EMPTY;
          })
        )),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((res) => this.applyDraftBoard(res));
  }

  // Rebuild teams/draftData from a server response, without stomping on any
  // optimistic write that's still in flight (see pendingCellWrites/pendingTeamAdds).
  private applyDraftBoard(res: DraftBoardResponse): void {
    const teams: string[] = [];
    const draftData: DraftData = {};
    (res.teams ?? []).forEach(team => {
      teams.push(team.teamName);
      (team.players ?? []).forEach(player => {
        draftData[this.getCellKey(team.teamName, player.round)] = player.name;
      });
    });

    this.pendingCellWrites.forEach(key => {
      if (key in this.draftData) {
        draftData[key] = this.draftData[key];
      } else {
        delete draftData[key];
      }
    });

    this.teams = teams;
    this.draftData = draftData;
    this.refreshAllRosters();
  }

  // ---------- Team rosters (starters + bench), kept in sync with draftData ----------

  private getTeamPicks(team: string): DraftPlayer[] {
    const picks: DraftPlayer[] = [];
    for (let round = 1; round <= this.rounds; round++) {
      const name = this.getPlayer(team, round);
      if (!name) continue;
      picks.push({ round, name, position: this.getPlayerPosition(team, round) });
    }
    return picks; // already round-ordered since the loop is ascending
  }

  private refreshTeamRoster(team: string): void {
    this.teamRosters[team] = buildRosterBreakdown(this.getTeamPicks(team));
  }

  private refreshAllRosters(): void {
    this.teams.forEach(team => this.refreshTeamRoster(team));
  }

  hasOpenRosterSlot(team: string, position: string): boolean {
    return hasOpenSlotInBreakdown(this.teamRosters[team], position);
  }

  // ---------- Team roster modal ----------

  openTeamRoster(team: string): void {
    this.selectedRosterTeam = team;
  }

  closeTeamRoster(): void {
    this.selectedRosterTeam = null;
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
        const teamName = team?.teamName ?? name;
        this.teams.push(teamName);
        this.refreshTeamRoster(teamName);
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
    this.rosterError = null;
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

    // Check the team has an open roster slot for this position (or an open bench spot)
    // before drafting. Shown as an inline message under the cell, not a browser alert.
    if (!this.hasOpenRosterSlot(team, position)) {
      this.rosterError = `${team} has no open ${position} slot or bench spot.`;
      return;
    }
    this.rosterError = null;

    const key = this.getCellKey(team, round);

    // Optimistic update so the pick shows immediately.
    this.draftData[key] = trimmedName;
    this.playerName = '';
    this.editingCell = null;
    this.showSuggestions = false;
    this.refreshTeamRoster(team);
    this.pendingCellWrites.add(key);

    // Persist the pick under the correct team + round.
    this.draftApi.addPlayer(team, { round, name: trimmedName, position }).subscribe({
      next: () => {
        this.pendingCellWrites.delete(key);
      },
      error: (err) => {
        // Roll back the optimistic update if the server rejects it.
        delete this.draftData[key];
        this.refreshTeamRoster(team);
        this.pendingCellWrites.delete(key);
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
    this.refreshTeamRoster(team);
    this.pendingCellWrites.add(key);

    // Persist the removal for the specific team + round.
    this.draftApi.deletePlayer(team, round).subscribe({
      next: () => {
        this.pendingCellWrites.delete(key);
      },
      error: (err) => {
        // Roll back if the server rejects it.
        if (previous !== undefined) {
          this.draftData[key] = previous;
          this.refreshTeamRoster(team);
        }
        this.pendingCellWrites.delete(key);
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
    this.rosterError = null;
  }

  clearPlayerName(): void {
    this.playerName = '';
    this.showSuggestions = false;
    this.filteredPlayers = [];
    this.selectedSuggestionIndex = -1;
    this.rosterError = null;
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
          this.refreshAllRosters();
        } catch (error) {
          alert('Error importing file');
        }
      };
      reader.readAsText(file);
    }
    
    // Reset input
    input.value = '';
  }
}
