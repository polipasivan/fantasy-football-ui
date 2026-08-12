import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { SettingsComponent } from './settings.component';

describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;
  let httpMock: HttpTestingController;

  const DEFAULT_POSITION_COUNTS = { qb: 1, rb: 2, wr: 2, te: 1, dst: 1, k: 1 };

  function settingsResponse(overrides: Partial<typeof DEFAULT_POSITION_COUNTS & { rounds: number }> = {}) {
    return { sessionId: '1234', rounds: 15, ...DEFAULT_POSITION_COUNTS, ...overrides };
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // Triggers ngOnInit and resolves the getSettings + getDraftBoard calls it fires.
  function loadWithSettings(overrides: Partial<typeof DEFAULT_POSITION_COUNTS & { rounds: number }> = {}, teams: string[] = []): void {
    fixture.detectChanges();
    httpMock.expectOne(req => req.url.includes('getSettings')).flush(settingsResponse(overrides));
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({
      sessionId: '1234',
      teams: teams.map(teamName => ({ sessionId: '1234', teamName, players: [] })),
      count: teams.length
    });
  }

  function loadWithRounds(rounds: number, teams: string[] = []): void {
    loadWithSettings({ rounds }, teams);
  }

  it('should create', () => {
    loadWithRounds(15);
    expect(component).toBeTruthy();
  });

  it('loads the saved rounds count from getSettings', () => {
    loadWithRounds(15);
    expect(component.rounds).toBe(15);
    expect(component.roundsInputValue).toBe('15');
    expect(component.roundsError).toBeNull();
    expect(component.loadingSettings).toBeFalse();
  });

  it('falls back to the default rounds if getSettings fails', () => {
    fixture.detectChanges();
    httpMock.expectOne(req => req.url.includes('getSettings'))
      .flush({ message: 'error' }, { status: 500, statusText: 'Server Error' });
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({ sessionId: '1234', teams: [], count: 0 });

    expect(component.rounds).toBe(15);
    expect(component.loadingSettings).toBeFalse();
  });

  it('does not show the Update button until the value actually changes', () => {
    loadWithRounds(15);
    expect(component.roundsDirty).toBeFalse();
  });

  it('increments and decrements rounds, marking the value dirty', () => {
    loadWithRounds(15);

    component.incrementRounds();
    expect(component.rounds).toBe(16);
    expect(component.roundsDirty).toBeTrue();

    component.decrementRounds();
    component.decrementRounds();
    expect(component.rounds).toBe(14);
    expect(component.roundsDirty).toBeTrue();
  });

  it('will not decrement below 1', () => {
    loadWithRounds(1);
    component.decrementRounds();
    expect(component.rounds).toBe(1);
  });

  it('rejects empty input', () => {
    loadWithRounds(15);
    component.onRoundsInput('');
    expect(component.roundsError).toBe('Enter a number of rounds.');
    expect(component.rounds).toBe(15); // last valid value untouched
    expect(component.roundsDirty).toBeFalse();
  });

  it('rejects non-numeric input', () => {
    loadWithRounds(15);
    component.onRoundsInput('abc');
    expect(component.roundsError).toBe('Rounds must be a whole number.');
    expect(component.rounds).toBe(15);
  });

  it('rejects negative numbers', () => {
    loadWithRounds(15);
    component.onRoundsInput('-5');
    expect(component.roundsError).toBeTruthy();
    expect(component.rounds).toBe(15);
  });

  it('rejects decimals', () => {
    loadWithRounds(15);
    component.onRoundsInput('12.5');
    expect(component.roundsError).toBeTruthy();
    expect(component.rounds).toBe(15);
  });

  it('rejects zero', () => {
    loadWithRounds(15);
    component.onRoundsInput('0');
    expect(component.roundsError).toBe('Rounds must be at least 1.');
    expect(component.rounds).toBe(15);
  });

  it('accepts a valid positive integer, clears the error, and marks it dirty', () => {
    loadWithRounds(15);
    component.onRoundsInput('20');
    expect(component.roundsError).toBeNull();
    expect(component.rounds).toBe(20);
    expect(component.roundsDirty).toBeTrue();
  });

  it('sends only rounds to setSettings on Update, then clears the dirty state', () => {
    loadWithRounds(15);
    component.incrementRounds();
    expect(component.roundsDirty).toBeTrue();

    component.updateRounds();
    expect(component.saving).toBeTrue();

    const req = httpMock.expectOne(r => r.url.includes('setSettings'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ sessionId: '', rounds: 16 });
    req.flush(settingsResponse({ rounds: 16 }));

    expect(component.saving).toBeFalse();
    expect(component.rounds).toBe(16);
    expect(component.roundsDirty).toBeFalse();
  });

  it('shows an error and keeps the pending value if the save fails', () => {
    loadWithRounds(15);
    component.incrementRounds();
    component.updateRounds();

    httpMock.expectOne(r => r.url.includes('setSettings'))
      .flush({ message: 'error' }, { status: 500, statusText: 'Server Error' });

    expect(component.saving).toBeFalse();
    expect(component.saveError).toBeTruthy();
    expect(component.rounds).toBe(16);
    expect(component.roundsDirty).toBeTrue();
  });

  it('does not call setSettings when clicked while the value is not dirty', () => {
    loadWithRounds(15);
    component.updateRounds();
    expect(component.saving).toBeFalse();
    httpMock.expectNone(r => r.url.includes('setSettings'));
  });

  it('shows the saved confirmation after a successful update, then fades it away on its own', fakeAsync(() => {
    loadWithRounds(15);
    component.incrementRounds();
    component.updateRounds();

    httpMock.expectOne(r => r.url.includes('setSettings')).flush(settingsResponse({ rounds: 16 }));
    expect(component.showSavedConfirm).toBeTrue();

    tick(2199);
    expect(component.showSavedConfirm).toBeTrue();

    tick(1);
    expect(component.showSavedConfirm).toBeFalse();
  }));

  it('does not show a saved confirmation just from the initial load', () => {
    loadWithRounds(15);
    expect(component.showSavedConfirm).toBeFalse();
  });

  it('clears the pending confirm timeout on destroy', fakeAsync(() => {
    loadWithRounds(15);
    component.incrementRounds();
    component.updateRounds();
    httpMock.expectOne(r => r.url.includes('setSettings')).flush(settingsResponse({ rounds: 16 }));

    fixture.destroy();
    // If the timeout weren't cleared, this tick would fire the callback against a
    // destroyed component instance — asserting the flag directly proves it didn't.
    tick(2200);
    expect(component.showSavedConfirm).toBeTrue();
  }));

  // ---------- Team Size ----------

  it('loads default position counts from getSettings', () => {
    loadWithRounds(15);
    const counts = Object.fromEntries(component.positionFields.map(f => [f.key, f.count]));
    expect(counts).toEqual(DEFAULT_POSITION_COUNTS);
    expect(component.teamSizeDirty).toBeFalse();
  });

  it('loads customized position counts from getSettings', () => {
    loadWithSettings({ wr: 3, rb: 3 });
    const wr = component.positionFields.find(f => f.key === 'wr')!;
    const rb = component.positionFields.find(f => f.key === 'rb')!;
    const qb = component.positionFields.find(f => f.key === 'qb')!;
    expect(wr.count).toBe(3);
    expect(rb.count).toBe(3);
    expect(qb.count).toBe(1); // untouched, still default
    expect(component.teamSizeDirty).toBeFalse();
  });

  it('increments and decrements a position count, marking it dirty', () => {
    loadWithRounds(15);
    const wr = component.positionFields.find(f => f.key === 'wr')!;

    component.incrementPositionCount(wr);
    expect(wr.count).toBe(3);
    expect(component.teamSizeDirty).toBeTrue();

    component.decrementPositionCount(wr);
    component.decrementPositionCount(wr);
    expect(wr.count).toBe(1);
    expect(component.teamSizeDirty).toBeTrue();
  });

  it('will not decrement a position count below 0', () => {
    loadWithRounds(15);
    const qb = component.positionFields.find(f => f.key === 'qb')!; // default 1

    component.decrementPositionCount(qb);
    expect(qb.count).toBe(0);
    component.decrementPositionCount(qb);
    expect(qb.count).toBe(0);
  });

  it('accepts zero as a valid position count (unlike rounds)', () => {
    loadWithRounds(15);
    const k = component.positionFields.find(f => f.key === 'k')!;

    component.onPositionCountInput(k, '0');
    expect(k.error).toBeNull();
    expect(k.count).toBe(0);
    expect(component.teamSizeDirty).toBeTrue();
  });

  it('rejects empty input for a position count', () => {
    loadWithRounds(15);
    const rb = component.positionFields.find(f => f.key === 'rb')!;

    component.onPositionCountInput(rb, '');
    expect(rb.error).toBe('Enter a number of RB slots.');
    expect(rb.count).toBe(2); // last valid value untouched
  });

  it('rejects non-numeric input for a position count', () => {
    loadWithRounds(15);
    const te = component.positionFields.find(f => f.key === 'te')!;

    component.onPositionCountInput(te, 'abc');
    expect(te.error).toBe('TE slots must be a whole number.');
    expect(te.count).toBe(1);
  });

  it('rejects negative numbers for a position count', () => {
    loadWithRounds(15);
    const dst = component.positionFields.find(f => f.key === 'dst')!;

    component.onPositionCountInput(dst, '-1');
    expect(dst.error).toBeTruthy();
    expect(dst.count).toBe(1);
  });

  it('a field with a validation error does not count as dirty', () => {
    loadWithRounds(15);
    const wr = component.positionFields.find(f => f.key === 'wr')!;

    component.onPositionCountInput(wr, 'abc');
    expect(component.teamSizeDirty).toBeFalse();
  });

  it('sends only the positions that changed to setSettings on Update', () => {
    loadWithRounds(15);
    const wr = component.positionFields.find(f => f.key === 'wr')!;
    const rb = component.positionFields.find(f => f.key === 'rb')!;
    component.incrementPositionCount(wr); // 2 -> 3
    component.incrementPositionCount(rb); // 2 -> 3

    component.updateTeamSize();
    expect(component.savingTeamSize).toBeTrue();

    const req = httpMock.expectOne(r => r.url.includes('setSettings'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ sessionId: '', wr: 3, rb: 3 });
    req.flush(settingsResponse({ wr: 3, rb: 3 }));

    expect(component.savingTeamSize).toBeFalse();
    expect(component.teamSizeDirty).toBeFalse();
  });

  it('does not call setSettings for team size when nothing changed', () => {
    loadWithRounds(15);
    component.updateTeamSize();
    expect(component.savingTeamSize).toBeFalse();
    httpMock.expectNone(r => r.url.includes('setSettings'));
  });

  it('shows an error and keeps the pending values if the team size save fails', () => {
    loadWithRounds(15);
    const wr = component.positionFields.find(f => f.key === 'wr')!;
    component.incrementPositionCount(wr);
    component.updateTeamSize();

    httpMock.expectOne(r => r.url.includes('setSettings'))
      .flush({ message: 'error' }, { status: 500, statusText: 'Server Error' });

    expect(component.savingTeamSize).toBeFalse();
    expect(component.teamSizeSaveError).toBeTruthy();
    expect(wr.count).toBe(3);
    expect(component.teamSizeDirty).toBeTrue();
  });

  it('shows a specific message on a 403 from the team size save', () => {
    loadWithRounds(15);
    const wr = component.positionFields.find(f => f.key === 'wr')!;
    component.incrementPositionCount(wr);
    component.updateTeamSize();

    httpMock.expectOne(r => r.url.includes('setSettings'))
      .flush({ message: 'Incorrect commissioner password.' }, { status: 403, statusText: 'Forbidden' });

    expect(component.teamSizeSaveError).toBe('Incorrect commissioner password. Your change was not saved.');
  });

  it('shows the team size saved confirmation after a successful update, then fades it away', fakeAsync(() => {
    loadWithRounds(15);
    const wr = component.positionFields.find(f => f.key === 'wr')!;
    component.incrementPositionCount(wr);
    component.updateTeamSize();

    httpMock.expectOne(r => r.url.includes('setSettings')).flush(settingsResponse({ wr: 3 }));
    expect(component.showTeamSizeSavedConfirm).toBeTrue();

    tick(2199);
    expect(component.showTeamSizeSavedConfirm).toBeTrue();

    tick(1);
    expect(component.showTeamSizeSavedConfirm).toBeFalse();
  }));

  it('clears the pending team size confirm timeout on destroy', fakeAsync(() => {
    loadWithRounds(15);
    const wr = component.positionFields.find(f => f.key === 'wr')!;
    component.incrementPositionCount(wr);
    component.updateTeamSize();
    httpMock.expectOne(r => r.url.includes('setSettings')).flush(settingsResponse({ wr: 3 }));

    fixture.destroy();
    tick(2200);
    expect(component.showTeamSizeSavedConfirm).toBeTrue();
  }));

  // ---------- Teams ----------

  it('loads team names from getDraftBoard', () => {
    loadWithRounds(15, ['Team A', 'Team B']);
    expect(component.teams).toEqual(['Team A', 'Team B']);
    expect(component.teamsLoading).toBeFalse();
  });

  it('stops the teams-loading state even if getDraftBoard fails', () => {
    fixture.detectChanges();
    httpMock.expectOne(req => req.url.includes('getSettings')).flush(settingsResponse());
    httpMock.expectOne(req => req.url.includes('getDraftBoard'))
      .flush({ message: 'error' }, { status: 500, statusText: 'Server Error' });

    expect(component.teams).toEqual([]);
    expect(component.teamsLoading).toBeFalse();
  });

  it('opens and cancels the add-team form', () => {
    loadWithRounds(15);
    component.openAddTeamForm();
    expect(component.showAddTeamForm).toBeTrue();

    component.cancelAddTeamForm();
    expect(component.showAddTeamForm).toBeFalse();
  });

  it('rejects an empty team name without calling addTeam', () => {
    loadWithRounds(15);
    component.newTeamName = '   ';
    component.confirmAddTeam();

    expect(component.addTeamError).toBe('Please enter a team name.');
    httpMock.expectNone(req => req.url.includes('addTeam'));
  });

  it('rejects a duplicate team name without calling addTeam', () => {
    loadWithRounds(15, ['Team A']);
    component.newTeamName = 'Team A';
    component.confirmAddTeam();

    expect(component.addTeamError).toBe('That team is already on the board.');
    httpMock.expectNone(req => req.url.includes('addTeam'));
  });

  it('adds a team and appends it to the list on success', () => {
    loadWithRounds(15);
    component.openAddTeamForm();
    component.newTeamName = 'New Team';
    component.confirmAddTeam();

    expect(component.addingTeam).toBeTrue();

    const req = httpMock.expectOne(r => r.url.includes('addTeam'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body.teamName).toBe('New Team');
    req.flush({ sessionId: '1234', teamName: 'New Team', players: [], active: true });

    expect(component.teams).toEqual(['New Team']);
    expect(component.addingTeam).toBeFalse();
    expect(component.showAddTeamForm).toBeFalse();
  });

  it('sends draftOrder as the current team count, appending the new team to the end of the draft order', () => {
    loadWithRounds(15, ['Team A', 'Team B']);
    component.newTeamName = 'New Team';
    component.confirmAddTeam();

    const req = httpMock.expectOne(r => r.url.includes('addTeam'));
    expect(req.request.body).toEqual({ sessionId: '', teamName: 'New Team', draftOrder: 2 });
    req.flush({ sessionId: '1234', teamName: 'New Team', players: [], active: true, draftOrder: 2 });
  });

  it('shows a specific message when addTeam 409s', () => {
    loadWithRounds(15);
    component.newTeamName = 'New Team';
    component.confirmAddTeam();

    httpMock.expectOne(r => r.url.includes('addTeam'))
      .flush({ message: 'conflict' }, { status: 409, statusText: 'Conflict' });

    expect(component.addTeamError).toBe('A team with that name already exists.');
    expect(component.teams).toEqual([]);
  });

  it('shows a generic error when addTeam fails for another reason', () => {
    loadWithRounds(15);
    component.newTeamName = 'New Team';
    component.confirmAddTeam();

    httpMock.expectOne(r => r.url.includes('addTeam'))
      .flush({ message: 'error' }, { status: 500, statusText: 'Server Error' });

    expect(component.addTeamError).toBe('Failed to add team. Please try again.');
  });

  it('opens the delete-confirm modal with the checkbox unchecked', () => {
    loadWithRounds(15, ['Team A']);
    component.openDeleteConfirm('Team A');

    expect(component.teamPendingDelete).toBe('Team A');
    expect(component.deleteConfirmChecked).toBeFalse();
  });

  it('does not call deleteTeam until the confirm checkbox is checked', () => {
    loadWithRounds(15, ['Team A']);
    component.openDeleteConfirm('Team A');
    component.confirmDeleteTeam();

    expect(component.deletingTeam).toBeFalse();
    httpMock.expectNone(r => r.url.includes('deleteTeam'));
  });

  it('deletes a team and removes it from the list once the checkbox is checked', () => {
    loadWithRounds(15, ['Team A', 'Team B']);
    component.openDeleteConfirm('Team A');
    component.deleteConfirmChecked = true;
    component.confirmDeleteTeam();

    expect(component.deletingTeam).toBeTrue();

    const req = httpMock.expectOne(r => r.url.includes('deleteTeam'));
    expect(req.request.method).toBe('DELETE');
    req.flush({ sessionId: '1234', teamName: 'Team A', players: [], active: false });

    expect(component.teams).toEqual(['Team B']);
    expect(component.deletingTeam).toBeFalse();
    expect(component.teamPendingDelete).toBeNull();
  });

  it('shows an error and keeps the team in the list if delete fails', () => {
    loadWithRounds(15, ['Team A']);
    component.openDeleteConfirm('Team A');
    component.deleteConfirmChecked = true;
    component.confirmDeleteTeam();

    httpMock.expectOne(r => r.url.includes('deleteTeam'))
      .flush({ message: 'error' }, { status: 500, statusText: 'Server Error' });

    expect(component.deletingTeam).toBeFalse();
    expect(component.deleteTeamError).toBeTruthy();
    expect(component.teams).toEqual(['Team A']);
  });

  it('closes the delete-confirm modal on cancel', () => {
    loadWithRounds(15, ['Team A']);
    component.openDeleteConfirm('Team A');
    component.closeDeleteConfirm();

    expect(component.teamPendingDelete).toBeNull();
  });

  // ---------- Draft order (drag and drop) ----------

  it('does nothing when a drop lands back on its original index', () => {
    loadWithRounds(15, ['Team A', 'Team B', 'Team C']);
    component.onTeamDrop({ previousIndex: 1, currentIndex: 1 } as any);

    expect(component.teams).toEqual(['Team A', 'Team B', 'Team C']);
    httpMock.expectNone(r => r.url.includes('updateTeam'));
  });

  it('reorders teams locally and persists a fresh draftOrder for every team on drop', () => {
    loadWithRounds(15, ['Team A', 'Team B', 'Team C']);
    component.onTeamDrop({ previousIndex: 0, currentIndex: 2 } as any);

    // Local reorder happens immediately, before the network round trip settles.
    expect(component.teams).toEqual(['Team B', 'Team C', 'Team A']);
    expect(component.reorderingTeams).toBeTrue();

    const reqs = httpMock.match(r => r.url.includes('updateTeam'));
    expect(reqs.length).toBe(3);
    const byTeam = Object.fromEntries(reqs.map(r => [r.request.body.teamName, r.request.body.draftOrder]));
    expect(byTeam).toEqual({ 'Team B': 0, 'Team C': 1, 'Team A': 2 });
    reqs.forEach((r, i) => {
      expect(r.request.method).toBe('PATCH');
      r.flush({ sessionId: '1234', teamName: r.request.body.teamName, players: [], draftOrder: i });
    });

    expect(component.reorderingTeams).toBeFalse();
    expect(component.showTeamOrderSavedConfirm).toBeTrue();
  });

  it('reverts to the pre-drag order if persisting the new order fails', () => {
    loadWithRounds(15, ['Team A', 'Team B', 'Team C']);
    component.onTeamDrop({ previousIndex: 0, currentIndex: 2 } as any);

    // forkJoin errors (and unsubscribes/cancels its sibling requests) as soon as any
    // one of them errors — flushing just this one is enough to settle the whole batch.
    const reqs = httpMock.match(r => r.url.includes('updateTeam'));
    reqs[0].flush({ message: 'error' }, { status: 500, statusText: 'Server Error' });

    expect(component.teams).toEqual(['Team A', 'Team B', 'Team C']);
    expect(component.reorderingTeams).toBeFalse();
    expect(component.teamOrderError).toBeTruthy();
  });

  it('shows a specific message on a 403 while persisting draft order', () => {
    loadWithRounds(15, ['Team A', 'Team B']);
    component.onTeamDrop({ previousIndex: 0, currentIndex: 1 } as any);

    const reqs = httpMock.match(r => r.url.includes('updateTeam'));
    reqs[0].flush({ message: 'Incorrect commissioner password.' }, { status: 403, statusText: 'Forbidden' });

    expect(component.teamOrderError).toBe('Incorrect commissioner password. Your change was not saved.');
    expect(component.teams).toEqual(['Team A', 'Team B']);
  });

  it('ignores a drop while a previous reorder is still saving', () => {
    loadWithRounds(15, ['Team A', 'Team B', 'Team C']);
    component.onTeamDrop({ previousIndex: 0, currentIndex: 2 } as any);
    expect(component.reorderingTeams).toBeTrue();

    component.onTeamDrop({ previousIndex: 0, currentIndex: 1 } as any);

    // Still only the first drop's 3 requests — the second drop was ignored.
    const reqs = httpMock.match(r => r.url.includes('updateTeam'));
    expect(reqs.length).toBe(3);
    reqs.forEach(r => r.flush({ sessionId: '1234', teamName: r.request.body.teamName, players: [] }));
  });

  // ---------- Commissioner-password (403) handling ----------

  it('shows a specific message on a 403 from addTeam', () => {
    loadWithRounds(15);
    component.newTeamName = 'New Team';
    component.confirmAddTeam();

    httpMock.expectOne(r => r.url.includes('addTeam'))
      .flush({ message: 'Incorrect commissioner password.' }, { status: 403, statusText: 'Forbidden' });

    expect(component.addTeamError).toBe('Incorrect commissioner password. Your change was not saved.');
    expect(component.teams).toEqual([]);
  });

  it('shows a specific message on a 403 from deleteTeam', () => {
    loadWithRounds(15, ['Team A']);
    component.openDeleteConfirm('Team A');
    component.deleteConfirmChecked = true;
    component.confirmDeleteTeam();

    httpMock.expectOne(r => r.url.includes('deleteTeam'))
      .flush({ message: 'Incorrect commissioner password.' }, { status: 403, statusText: 'Forbidden' });

    expect(component.deleteTeamError).toBe('Incorrect commissioner password. Your change was not saved.');
    expect(component.teams).toEqual(['Team A']);
  });

  it('shows a specific message on a 403 from setSettings (rounds)', () => {
    loadWithRounds(15);
    component.incrementRounds();
    component.updateRounds();

    httpMock.expectOne(r => r.url.includes('setSettings'))
      .flush({ message: 'Incorrect commissioner password.' }, { status: 403, statusText: 'Forbidden' });

    expect(component.saveError).toBe('Incorrect commissioner password. Your change was not saved.');
    expect(component.rounds).toBe(16);
    expect(component.roundsDirty).toBeTrue();
  });
});
