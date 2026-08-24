import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { forkJoin } from 'rxjs';
import { DraftSettings, SettingsApiService, SettingsUpdate } from '../services/settings-api.service';
import { DraftApiService } from '../services/draft-api.service';

type PositionKey = 'qb' | 'rb' | 'wr' | 'te' | 'dst' | 'k' | 'bench';

interface PositionSizeField {
  key: PositionKey;
  label: string;
  count: number;
  // Bound to the text input directly, same reasoning as roundsInputValue: lets the
  // user freely type/clear digits while `count` (the last known-valid value) only
  // updates once the input parses as a valid non-negative integer.
  inputValue: string;
  error: string | null;
}

// Order here drives the Team Size section's stepper render order (positionFields
// below is built straight from Object.keys) — BENCH goes last, after K.
const POSITION_LABELS: Record<PositionKey, string> = {
  qb: 'QB', rb: 'RB', wr: 'WR', te: 'TE', dst: 'DEF', k: 'K', bench: 'BENCH'
};

// Matches DEFAULT_POSITION_COUNTS in lambda/models/settings.js — a session that's
// never customized Team Size behaves exactly as every session did before this
// feature existed (see team-roster/roster-config.ts's STANDARD_ROSTER). `bench`
// isn't a player position, but is a Team Size field edited via the exact same
// generic stepper/save mechanism as the six above.
const DEFAULT_POSITION_COUNTS: Record<PositionKey, number> = {
  qb: 1, rb: 2, wr: 2, te: 1, dst: 1, k: 1, bench: 8
};

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DragDropModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent implements OnInit, OnDestroy {
  private readonly minRounds = 1;
  private readonly defaultRounds = 15;

  rounds = this.defaultRounds;

  // Bound to the text input directly so the user can freely type/clear digits — `rounds`
  // (the last known-valid value) only updates once the input parses as a valid positive
  // integer. Keeps the +/- buttons and the Update action working off a value that's
  // always valid, even while the field itself is mid-edit and invalid.
  roundsInputValue = String(this.rounds);
  roundsError: string | null = null;

  // The last value confirmed saved on the server — from the initial getSettings load,
  // or after a successful save. The Update button only appears once `rounds` has
  // actually diverged from this baseline (and is currently valid).
  private savedRounds = this.defaultRounds;

  loadingSettings = true;
  saving = false;
  saveError: string | null = null;

  // Shown in place of the Update button right after a successful save, then fades
  // away on its own (see the CSS animation on .update-confirm).
  showSavedConfirm = false;
  private savedConfirmTimeout?: ReturnType<typeof setTimeout>;
  private readonly savedConfirmDurationMs = 2200;

  // ---------- Team Size ----------
  private readonly minPositionCount = 0;

  positionFields: PositionSizeField[] = (Object.keys(POSITION_LABELS) as PositionKey[]).map(key => ({
    key,
    label: POSITION_LABELS[key],
    count: DEFAULT_POSITION_COUNTS[key],
    inputValue: String(DEFAULT_POSITION_COUNTS[key]),
    error: null,
  }));

  private savedPositionCounts: Record<PositionKey, number> = { ...DEFAULT_POSITION_COUNTS };

  savingTeamSize = false;
  teamSizeSaveError: string | null = null;
  showTeamSizeSavedConfirm = false;
  private teamSizeSavedConfirmTimeout?: ReturnType<typeof setTimeout>;

  // ---------- Teams ----------
  teams: string[] = [];
  teamsLoading = true;

  showAddTeamForm = false;
  newTeamName = '';
  addingTeam = false;
  addTeamError = '';

  teamPendingDelete: string | null = null;
  deleteConfirmChecked = false;
  deletingTeam = false;
  deleteTeamError = '';

  // Drag-and-drop draft order (see onTeamDrop). `teams` is reordered optimistically
  // on drop, then persisted — reverted back to `preDragTeams` if the save fails.
  reorderingTeams = false;
  teamOrderError = '';
  showTeamOrderSavedConfirm = false;
  private teamOrderSavedConfirmTimeout?: ReturnType<typeof setTimeout>;

  constructor(private settingsApi: SettingsApiService, private draftApi: DraftApiService) {}

  ngOnInit(): void {
    this.settingsApi.getSettings().subscribe({
      next: (settings) => {
        this.applySavedRounds(settings.rounds);
        this.applySavedTeamSize(settings);
        this.loadingSettings = false;
      },
      error: (err) => {
        console.error('Failed to load settings', err);
        this.loadingSettings = false;
      }
    });

    this.loadTeams();
  }

  loadTeams(): void {
    this.draftApi.getDraftBoard().subscribe({
      next: (res) => {
        this.teams = (res.teams ?? []).map(team => team.teamName);
        this.teamsLoading = false;
      },
      error: (err) => {
        console.error('Failed to load teams', err);
        this.teamsLoading = false;
      }
    });
  }

  // ---------- Add team ----------

  openAddTeamForm(): void {
    this.showAddTeamForm = true;
    this.newTeamName = '';
    this.addTeamError = '';
  }

  cancelAddTeamForm(): void {
    if (this.addingTeam) return;
    this.showAddTeamForm = false;
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

    // Append to the end of the current draft order.
    this.draftApi.addTeam(name, this.teams.length).subscribe({
      next: (team) => {
        this.teams.push(team?.teamName ?? name);
        this.addingTeam = false;
        this.showAddTeamForm = false;
        this.newTeamName = '';
      },
      error: (err) => {
        this.addingTeam = false;
        this.addTeamError = err?.status === 409
          ? 'A team with that name already exists.'
          : this.writeErrorMessage(err, 'Failed to add team. Please try again.');
      }
    });
  }

  // ---------- Delete team ----------

  openDeleteConfirm(team: string): void {
    this.teamPendingDelete = team;
    this.deleteConfirmChecked = false;
    this.deleteTeamError = '';
  }

  closeDeleteConfirm(): void {
    if (this.deletingTeam) return;
    this.teamPendingDelete = null;
    this.deleteConfirmChecked = false;
    this.deleteTeamError = '';
  }

  confirmDeleteTeam(): void {
    if (!this.teamPendingDelete || !this.deleteConfirmChecked || this.deletingTeam) return;

    const team = this.teamPendingDelete;
    this.deletingTeam = true;
    this.deleteTeamError = '';

    this.draftApi.deleteTeam(team).subscribe({
      next: () => {
        this.teams = this.teams.filter(t => t !== team);
        this.deletingTeam = false;
        this.teamPendingDelete = null;
        this.deleteConfirmChecked = false;
      },
      error: (err) => {
        console.error('Failed to delete team', err);
        this.deletingTeam = false;
        this.deleteTeamError = this.writeErrorMessage(err, 'Failed to delete team. Please try again.');
      }
    });
  }

  // ---------- Draft order (drag and drop) ----------

  // Reorders `teams` locally to match the drop, then persists a fresh `draftOrder`
  // (its new index) for every currently-displayed team — not just the ones that
  // moved, so any legacy team with no draftOrder yet gets one too. Reverts the local
  // reorder if the save fails.
  onTeamDrop(event: CdkDragDrop<string[]>): void {
    if (event.previousIndex === event.currentIndex || this.reorderingTeams) return;

    const previousOrder = [...this.teams];
    moveItemInArray(this.teams, event.previousIndex, event.currentIndex);
    this.persistTeamOrder(previousOrder);
  }

  private persistTeamOrder(previousOrder: string[]): void {
    this.reorderingTeams = true;
    this.teamOrderError = '';

    const updates = this.teams.map((team, draftOrder) =>
      this.draftApi.updateTeam(team, { draftOrder })
    );

    forkJoin(updates).subscribe({
      next: () => {
        this.reorderingTeams = false;
        this.flashTeamOrderSavedConfirm();
      },
      error: (err) => {
        console.error('Failed to save draft order', err);
        this.reorderingTeams = false;
        this.teamOrderError = this.writeErrorMessage(err, 'Failed to save draft order. Please try again.');
        // Revert the optimistic reorder — the server-side order (if any updates in
        // this batch did land) may now disagree with what's shown, but the next
        // getDraftBoard load (e.g. a refresh) always reflects the true saved state.
        this.teams = previousOrder;
      }
    });
  }

  private flashTeamOrderSavedConfirm(): void {
    if (this.teamOrderSavedConfirmTimeout) {
      clearTimeout(this.teamOrderSavedConfirmTimeout);
    }
    this.showTeamOrderSavedConfirm = true;
    this.teamOrderSavedConfirmTimeout = setTimeout(() => {
      this.showTeamOrderSavedConfirm = false;
      this.teamOrderSavedConfirmTimeout = undefined;
    }, this.savedConfirmDurationMs);
  }

  // ---------- Draft Rounds ----------

  get roundsDirty(): boolean {
    return !this.roundsError && this.rounds !== this.savedRounds;
  }

  onRoundsInput(value: string): void {
    this.roundsInputValue = value;
    this.saveError = null;

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      this.roundsError = 'Enter a number of rounds.';
      return;
    }

    if (!/^\d+$/.test(trimmed)) {
      this.roundsError = 'Rounds must be a whole number.';
      return;
    }

    const parsed = Number(trimmed);
    if (parsed < this.minRounds) {
      this.roundsError = `Rounds must be at least ${this.minRounds}.`;
      return;
    }

    this.roundsError = null;
    this.rounds = parsed;
  }

  incrementRounds(): void {
    this.applyRoundsValue(this.rounds + 1);
  }

  decrementRounds(): void {
    this.applyRoundsValue(this.rounds - 1);
  }

  // Sends the currently-valid `rounds` value to the backend. Only reachable while
  // roundsDirty is true (see template), so `rounds` is always valid here. Sends only
  // `rounds` — setSettings is a partial update, so Team Size fields are untouched.
  updateRounds(): void {
    if (!this.roundsDirty || this.saving) return;

    this.saving = true;
    this.saveError = null;

    this.settingsApi.updateSettings({ rounds: this.rounds }).subscribe({
      next: (settings) => {
        this.applySavedRounds(settings.rounds);
        this.saving = false;
        this.flashSavedConfirm();
      },
      error: (err) => {
        console.error('Failed to save rounds', err);
        this.saving = false;
        this.saveError = this.writeErrorMessage(err, 'Failed to save. Please try again.');
      }
    });
  }

  private flashSavedConfirm(): void {
    if (this.savedConfirmTimeout) {
      clearTimeout(this.savedConfirmTimeout);
    }
    this.showSavedConfirm = true;
    this.savedConfirmTimeout = setTimeout(() => {
      this.showSavedConfirm = false;
      this.savedConfirmTimeout = undefined;
    }, this.savedConfirmDurationMs);
  }

  private applyRoundsValue(value: number): void {
    this.rounds = Math.max(this.minRounds, value);
    this.roundsInputValue = String(this.rounds);
    this.roundsError = null;
    this.saveError = null;
  }

  private applySavedRounds(rounds: number): void {
    this.savedRounds = rounds;
    this.rounds = rounds;
    this.roundsInputValue = String(rounds);
    this.roundsError = null;
  }

  // ---------- Team Size ----------

  get teamSizeDirty(): boolean {
    if (this.positionFields.some(f => f.error)) return false;
    return this.positionFields.some(f => f.count !== this.savedPositionCounts[f.key]);
  }

  onPositionCountInput(field: PositionSizeField, value: string): void {
    field.inputValue = value;
    this.teamSizeSaveError = null;

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      field.error = `Enter a number of ${field.label} slots.`;
      return;
    }

    if (!/^\d+$/.test(trimmed)) {
      field.error = `${field.label} slots must be a whole number.`;
      return;
    }

    const parsed = Number(trimmed);
    if (parsed < this.minPositionCount) {
      field.error = `${field.label} slots must be at least ${this.minPositionCount}.`;
      return;
    }

    field.error = null;
    field.count = parsed;
  }

  incrementPositionCount(field: PositionSizeField): void {
    this.applyPositionCount(field, field.count + 1);
  }

  decrementPositionCount(field: PositionSizeField): void {
    this.applyPositionCount(field, field.count - 1);
  }

  // Sends only the positions that actually changed — setSettings is a partial
  // update, so untouched positions (and rounds) are left exactly as they were.
  updateTeamSize(): void {
    if (!this.teamSizeDirty || this.savingTeamSize) return;

    const changes: SettingsUpdate = {};
    for (const field of this.positionFields) {
      if (field.count !== this.savedPositionCounts[field.key]) {
        changes[field.key] = field.count;
      }
    }

    this.savingTeamSize = true;
    this.teamSizeSaveError = null;

    this.settingsApi.updateSettings(changes).subscribe({
      next: (settings) => {
        this.applySavedTeamSize(settings);
        this.savingTeamSize = false;
        this.flashTeamSizeSavedConfirm();
      },
      error: (err) => {
        console.error('Failed to save team size', err);
        this.savingTeamSize = false;
        this.teamSizeSaveError = this.writeErrorMessage(err, 'Failed to save. Please try again.');
      }
    });
  }

  private flashTeamSizeSavedConfirm(): void {
    if (this.teamSizeSavedConfirmTimeout) {
      clearTimeout(this.teamSizeSavedConfirmTimeout);
    }
    this.showTeamSizeSavedConfirm = true;
    this.teamSizeSavedConfirmTimeout = setTimeout(() => {
      this.showTeamSizeSavedConfirm = false;
      this.teamSizeSavedConfirmTimeout = undefined;
    }, this.savedConfirmDurationMs);
  }

  private applyPositionCount(field: PositionSizeField, value: number): void {
    field.count = Math.max(this.minPositionCount, value);
    field.inputValue = String(field.count);
    field.error = null;
    this.teamSizeSaveError = null;
  }

  private applySavedTeamSize(settings: Partial<DraftSettings>): void {
    for (const field of this.positionFields) {
      const value = settings[field.key] ?? this.savedPositionCounts[field.key];
      this.savedPositionCounts[field.key] = value;
      field.count = value;
      field.inputValue = String(value);
      field.error = null;
    }
  }

  // A 403 from any write endpoint means the commissioner password held in
  // sessionStorage was wrong (or one is now required and none was held) — surfaced
  // distinctly from other failures so it's clear the change was rejected, not lost to
  // a network blip.
  private writeErrorMessage(err: any, fallback: string): string {
    return err?.status === 403
      ? 'Incorrect commissioner password. Your change was not saved.'
      : fallback;
  }

  ngOnDestroy(): void {
    if (this.savedConfirmTimeout) {
      clearTimeout(this.savedConfirmTimeout);
    }
    if (this.teamSizeSavedConfirmTimeout) {
      clearTimeout(this.teamSizeSavedConfirmTimeout);
    }
    if (this.teamOrderSavedConfirmTimeout) {
      clearTimeout(this.teamOrderSavedConfirmTimeout);
    }
  }
}
