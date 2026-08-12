import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';

import { DashboardComponent } from './dashboard.component';
import { Player } from '../services/player.service';
import { SessionService } from '../services/session.service';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let httpMock: HttpTestingController;

  const makePlayer = (name: string, position: string): Player => ({
    rank: '1', tier: '1', name, team: 'BUF', position, bye: '7', sos: '', ecrVsAdp: ''
  });

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
    // Destroys the fixture so DashboardComponent's polling interval (started in ngOnInit)
    // is unsubscribed via takeUntilDestroyed — otherwise it keeps firing in the background
    // and can issue unmatched getDraftBoard requests against a torn-down TestBed later on.
    fixture.destroy();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should create', () => {
    httpMock.expectOne(req => req.url.includes('.csv')).flush('');
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({ sessionId: '1234', teams: [], count: 0 });
    httpMock.expectOne(req => req.url.includes('getSettings')).flush({ sessionId: '1234', rounds: 15 });
    expect(component).toBeTruthy();
  });

  it('should start with no teams', () => {
    httpMock.expectOne(req => req.url.includes('.csv')).flush('');
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({ sessionId: '1234', teams: [], count: 0 });
    httpMock.expectOne(req => req.url.includes('getSettings')).flush({ sessionId: '1234', rounds: 15 });
    expect(component.teams).toEqual([]);
  });

  it('shows a "no teams yet" message linking to Settings for a commissioner when there are no teams', () => {
    httpMock.expectOne(req => req.url.includes('.csv')).flush('');
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({ sessionId: '1234', teams: [], count: 0 });
    httpMock.expectOne(req => req.url.includes('getSettings')).flush({ sessionId: '1234', rounds: 15 });
    TestBed.inject(SessionService).setCommissionerPassword('fambam123');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.no-teams-header')).toBeTruthy();
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('.no-teams-link');
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/settings');
  });

  it('shows the "no teams yet" message without a Settings link for a viewer', () => {
    httpMock.expectOne(req => req.url.includes('.csv')).flush('');
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({ sessionId: '1234', teams: [], count: 0 });
    httpMock.expectOne(req => req.url.includes('getSettings')).flush({ sessionId: '1234', rounds: 15 });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.no-teams-header')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.no-teams-link')).toBeNull();
  });

  it('hides the "no teams yet" message once a team exists', () => {
    httpMock.expectOne(req => req.url.includes('.csv')).flush('');
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({
      sessionId: '1234',
      teams: [{ sessionId: '1234', teamName: 'Team A', players: [] }],
      count: 1
    });
    httpMock.expectOne(req => req.url.includes('getSettings')).flush({ sessionId: '1234', rounds: 15 });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.no-teams-header')).toBeNull();
  });

  it('clears the session and navigates to /login when leaving the draft', () => {
    httpMock.expectOne(req => req.url.includes('.csv')).flush('');
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({ sessionId: '1234', teams: [], count: 0 });
    httpMock.expectOne(req => req.url.includes('getSettings')).flush({ sessionId: '1234', rounds: 15 });

    const sessionService = TestBed.inject(SessionService);
    const router = TestBed.inject(Router);
    spyOn(sessionService, 'clearSession');
    spyOn(router, 'navigateByUrl');

    component.leaveDraft();

    expect(sessionService.clearSession).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('shows the board as loading until the players, draft board, and settings requests all settle', () => {
    expect(component.isLoading()).toBeTrue();

    httpMock.expectOne(req => req.url.includes('.csv')).flush('');
    expect(component.isLoading()).toBeTrue();

    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({ sessionId: '1234', teams: [], count: 0 });
    expect(component.isLoading()).toBeTrue();

    httpMock.expectOne(req => req.url.includes('getSettings')).flush({ sessionId: '1234', rounds: 15 });
    expect(component.isLoading()).toBeFalse();
  });

  it('loads the rounds count from getSettings and builds the round rows accordingly', () => {
    httpMock.expectOne(req => req.url.includes('.csv')).flush('');
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({ sessionId: '1234', teams: [], count: 0 });
    httpMock.expectOne(req => req.url.includes('getSettings')).flush({ sessionId: '1234', rounds: 8 });

    expect(component.rounds).toBe(8);
    expect(component.roundNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('falls back to the default rounds if getSettings fails', () => {
    httpMock.expectOne(req => req.url.includes('.csv')).flush('');
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({ sessionId: '1234', teams: [], count: 0 });
    httpMock.expectOne(req => req.url.includes('getSettings'))
      .flush({ message: 'error' }, { status: 500, statusText: 'Server Error' });

    expect(component.rounds).toBe(15);
    expect(component.isLoading()).toBeFalse();
  });

  // ---------- Team Size (getSettings -> roster building) ----------

  it('builds team rosters using the Team Size counts from getSettings, not the hardcoded defaults', () => {
    httpMock.expectOne(req => req.url.includes('.csv')).flush('');
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({
      sessionId: '1234',
      teams: [{ sessionId: '1234', teamName: 'Team A', players: [] }],
      count: 1
    });
    httpMock.expectOne(req => req.url.includes('getSettings')).flush({
      sessionId: '1234', rounds: 15, qb: 1, rb: 2, wr: 3, te: 1, dst: 1, k: 1
    });

    const wrGroup = component.teamRosters['Team A'].starters.find(s => s.position === 'WR');
    expect(wrGroup?.slots.length).toBe(3); // customized, not the default of 2
  });

  it('respects Team Size when deciding whether a team has an open roster slot', () => {
    // getPlayerPosition resolves a pick's position from the CSV data (matched by
    // name), not the draft board response's own `position` field, so the CSV needs a
    // matching row for this to build the roster correctly.
    const csv = [
      '"RK",TIERS,"PLAYER NAME",TEAM,"POS","BYE WEEK","UPSIDE ","BUST ","SOS SEASON","ECR VS. ADP"',
      '"1",1,"WR One",BUF,"WR1","7","","","3 out of 5 stars","+1"'
    ].join('\n');
    httpMock.expectOne(req => req.url.includes('.csv')).flush(csv);
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({
      sessionId: '1234',
      teams: [{
        sessionId: '1234',
        teamName: 'Team A',
        // 1 WR starter slot (customized down from 2) already filled.
        players: [{ round: 1, name: 'WR One', position: 'WR' }]
      }],
      count: 1
    });
    httpMock.expectOne(req => req.url.includes('getSettings')).flush({
      sessionId: '1234', rounds: 15, qb: 1, rb: 2, wr: 1, te: 1, dst: 1, k: 1
    });

    // The single WR starter slot is taken, but bench is still open, so a 2nd WR
    // still has somewhere to go.
    expect(component.hasOpenRosterSlot('Team A', 'WR')).toBeTrue();
    const wrGroup = component.teamRosters['Team A'].starters.find(s => s.position === 'WR');
    expect(wrGroup?.slots.every(s => s !== null)).toBeTrue(); // the 1 slot is full
  });

  it('falls back to the default Team Size counts if getSettings fails', () => {
    httpMock.expectOne(req => req.url.includes('.csv')).flush('');
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({
      sessionId: '1234',
      teams: [{ sessionId: '1234', teamName: 'Team A', players: [] }],
      count: 1
    });
    httpMock.expectOne(req => req.url.includes('getSettings'))
      .flush({ message: 'error' }, { status: 500, statusText: 'Server Error' });

    const wrGroup = component.teamRosters['Team A'].starters.find(s => s.position === 'WR');
    expect(wrGroup?.slots.length).toBe(2); // STANDARD_ROSTER default
  });

  it('should open and close the team roster modal', () => {
    httpMock.expectOne(req => req.url.includes('.csv')).flush('');
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({ sessionId: '1234', teams: [], count: 0 });
    httpMock.expectOne(req => req.url.includes('getSettings')).flush({ sessionId: '1234', rounds: 15 });
    component.openTeamRoster('Team A');
    expect(component.selectedRosterTeam).toBe('Team A');
    component.closeTeamRoster();
    expect(component.selectedRosterTeam).toBeNull();
  });

  it('populates teamRosters (starters before bench) as soon as the draft board loads, without opening the modal', () => {
    const csv = [
      '"RK",TIERS,"PLAYER NAME",TEAM,"POS","BYE WEEK","UPSIDE ","BUST ","SOS SEASON","ECR VS. ADP"',
      '"1",1,"RB One",BUF,"RB1","7","","","3 out of 5 stars","+1"',
      '"2",1,"RB Two",BUF,"RB2","7","","","3 out of 5 stars","+1"',
      '"3",1,"RB Three",BUF,"RB3","7","","","3 out of 5 stars","+1"'
    ].join('\n');
    httpMock.expectOne(req => req.url.includes('.csv')).flush(csv);
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({
      sessionId: '1234',
      teams: [{
        sessionId: '1234',
        teamName: 'Team A',
        players: [
          { round: 1, name: 'RB One', position: 'RB' },
          { round: 2, name: 'RB Two', position: 'RB' },
          { round: 3, name: 'RB Three', position: 'RB' }
        ]
      }],
      count: 1
    });
    httpMock.expectOne(req => req.url.includes('getSettings')).flush({ sessionId: '1234', rounds: 15 });

    const roster = component.teamRosters['Team A'];
    expect(roster).toBeTruthy();
    const rbGroup = roster.starters.find(s => s.position === 'RB');
    expect(rbGroup?.slots.map(s => s?.name)).toEqual(['RB One', 'RB Two']);
    expect(roster.bench[0]?.name).toBe('RB Three');
  });

  it('blocks drafting a player when the position and bench are both full, showing an inline message', () => {
    httpMock.expectOne(req => req.url.includes('.csv')).flush('');
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({ sessionId: '1234', teams: [], count: 0 });
    httpMock.expectOne(req => req.url.includes('getSettings')).flush({ sessionId: '1234', rounds: 15 });

    TestBed.inject(SessionService).setCommissionerPassword('fambam123');

    // 2 RB starter slots + 7 bench slots = 9 RB picks fills every spot an RB can occupy.
    const rbNames = Array.from({ length: 9 }, (_, i) => `RB ${i + 1}`);
    component.allPlayers = [...rbNames.map(n => makePlayer(n, 'RB')), makePlayer('RB 10', 'RB')];
    component.teams = ['Team A'];
    rbNames.forEach((name, i) => {
      component.draftData[component.getCellKey('Team A', i + 1)] = name;
    });
    (component as any).refreshAllRosters();

    component.editingCell = component.getCellKey('Team A', 10);
    component.playerName = 'RB 10';
    component.addPlayer('Team A', 10);

    expect(component.draftData[component.getCellKey('Team A', 10)]).toBeUndefined();
    expect(component.rosterError).toContain('Team A');
    httpMock.expectNone(req => req.url.includes('addPlayer'));
  });

  // ---------- Commissioner gating ----------

  it('is not a commissioner by default (viewer)', () => {
    httpMock.expectOne(req => req.url.includes('.csv')).flush('');
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({ sessionId: '1234', teams: [], count: 0 });
    httpMock.expectOne(req => req.url.includes('getSettings')).flush({ sessionId: '1234', rounds: 15 });

    expect(component.isCommissioner()).toBeFalse();
  });

  it('is a commissioner once a password is held in session storage', () => {
    httpMock.expectOne(req => req.url.includes('.csv')).flush('');
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({ sessionId: '1234', teams: [], count: 0 });
    httpMock.expectOne(req => req.url.includes('getSettings')).flush({ sessionId: '1234', rounds: 15 });

    TestBed.inject(SessionService).setCommissionerPassword('fambam123');

    expect(component.isCommissioner()).toBeTrue();
  });

  it('hides the Settings link from a viewer and shows it for a commissioner', () => {
    httpMock.expectOne(req => req.url.includes('.csv')).flush('');
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({ sessionId: '1234', teams: [], count: 0 });
    httpMock.expectOne(req => req.url.includes('getSettings')).flush({ sessionId: '1234', rounds: 15 });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.settings-btn-compact')).toBeNull();

    TestBed.inject(SessionService).setCommissionerPassword('fambam123');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.settings-btn-compact')).toBeTruthy();
  });

  it('shows a static empty cell (no Add Player button) for a viewer, and the button for a commissioner', () => {
    httpMock.expectOne(req => req.url.includes('.csv')).flush('');
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({
      sessionId: '1234',
      teams: [{ sessionId: '1234', teamName: 'Team A', players: [] }],
      count: 1
    });
    httpMock.expectOne(req => req.url.includes('getSettings')).flush({ sessionId: '1234', rounds: 15 });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.add-player-btn')).toBeNull();
    expect(fixture.nativeElement.querySelector('.empty-pick-cell')).toBeTruthy();

    TestBed.inject(SessionService).setCommissionerPassword('fambam123');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.add-player-btn')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.empty-pick-cell')).toBeNull();
  });

  it('hides the remove-player button from a viewer', () => {
    httpMock.expectOne(req => req.url.includes('.csv')).flush('');
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({
      sessionId: '1234',
      teams: [{
        sessionId: '1234',
        teamName: 'Team A',
        players: [{ round: 1, name: 'tyreek', position: 'WR' }]
      }],
      count: 1
    });
    httpMock.expectOne(req => req.url.includes('getSettings')).flush({ sessionId: '1234', rounds: 15 });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.remove-btn')).toBeNull();

    TestBed.inject(SessionService).setCommissionerPassword('fambam123');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.remove-btn')).toBeTruthy();
  });

  it('does not start editing, add, or remove a player when not a commissioner', () => {
    httpMock.expectOne(req => req.url.includes('.csv')).flush('');
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({ sessionId: '1234', teams: [], count: 0 });
    httpMock.expectOne(req => req.url.includes('getSettings')).flush({ sessionId: '1234', rounds: 15 });

    component.startEditing('Team A', 1);
    expect(component.editingCell).toBeNull();

    component.playerName = 'tyreek';
    component.addPlayer('Team A', 1);
    httpMock.expectNone(req => req.url.includes('addPlayer'));

    component.draftData[component.getCellKey('Team A', 1)] = 'tyreek';
    component.removePlayer('Team A', 1);
    httpMock.expectNone(req => req.url.includes('deletePlayer'));
  });

  it('clears the commissioner password (in addition to the session) when leaving the draft', () => {
    httpMock.expectOne(req => req.url.includes('.csv')).flush('');
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({ sessionId: '1234', teams: [], count: 0 });
    httpMock.expectOne(req => req.url.includes('getSettings')).flush({ sessionId: '1234', rounds: 15 });

    const sessionService = TestBed.inject(SessionService);
    sessionService.setCommissionerPassword('fambam123');
    spyOn(TestBed.inject(Router), 'navigateByUrl');

    component.leaveDraft();

    expect(sessionService.isCommissioner()).toBeFalse();
  });

  it('shows a specific message and rolls back the optimistic update on a 403 from addPlayer', () => {
    httpMock.expectOne(req => req.url.includes('.csv')).flush('');
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({
      sessionId: '1234',
      teams: [{ sessionId: '1234', teamName: 'Team A', players: [] }],
      count: 1
    });
    httpMock.expectOne(req => req.url.includes('getSettings')).flush({ sessionId: '1234', rounds: 15 });

    TestBed.inject(SessionService).setCommissionerPassword('wrong-password');
    spyOn(window, 'alert');

    component.allPlayers = [makePlayer('tyreek', 'WR')];
    component.teams = ['Team A'];
    component.editingCell = component.getCellKey('Team A', 1);
    component.playerName = 'tyreek';
    component.addPlayer('Team A', 1);

    httpMock.expectOne(req => req.url.includes('addPlayer'))
      .flush({ message: 'Incorrect commissioner password.' }, { status: 403, statusText: 'Forbidden' });

    expect(component.draftData[component.getCellKey('Team A', 1)]).toBeUndefined();
    expect(window.alert).toHaveBeenCalledWith('Incorrect commissioner password. Your change was not saved.');
  });
});
