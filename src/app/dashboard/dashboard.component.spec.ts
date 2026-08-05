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
  });

  it('should create', () => {
    httpMock.expectOne(req => req.url.includes('.csv')).flush('');
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({ sessionId: '1234', teams: [], count: 0 });
    expect(component).toBeTruthy();
  });

  it('should start with no teams', () => {
    httpMock.expectOne(req => req.url.includes('.csv')).flush('');
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({ sessionId: '1234', teams: [], count: 0 });
    expect(component.teams).toEqual([]);
  });

  it('shows the large in-table Add Team button when there are no teams yet', () => {
    httpMock.expectOne(req => req.url.includes('.csv')).flush('');
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({ sessionId: '1234', teams: [], count: 0 });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.add-team-header')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.add-team-btn-compact')).toBeNull();
  });

  it('shows the compact Add Team button above the table once a team exists', () => {
    httpMock.expectOne(req => req.url.includes('.csv')).flush('');
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({
      sessionId: '1234',
      teams: [{ sessionId: '1234', teamName: 'Team A', players: [] }],
      count: 1
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.add-team-btn-compact')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.add-team-header')).toBeNull();
  });

  it('should open and close the add-team modal', () => {
    httpMock.expectOne(req => req.url.includes('.csv')).flush('');
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({ sessionId: '1234', teams: [], count: 0 });
    component.openAddTeamModal();
    expect(component.showAddTeamModal).toBeTrue();
    component.closeAddTeamModal();
    expect(component.showAddTeamModal).toBeFalse();
  });

  it('clears the session and navigates to /login when leaving the draft', () => {
    httpMock.expectOne(req => req.url.includes('.csv')).flush('');
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({ sessionId: '1234', teams: [], count: 0 });

    const sessionService = TestBed.inject(SessionService);
    const router = TestBed.inject(Router);
    spyOn(sessionService, 'clearSession');
    spyOn(router, 'navigateByUrl');

    component.leaveDraft();

    expect(sessionService.clearSession).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('shows the board as loading until both the players and draft board requests settle', () => {
    expect(component.isLoading()).toBeTrue();

    httpMock.expectOne(req => req.url.includes('.csv')).flush('');
    expect(component.isLoading()).toBeTrue();

    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({ sessionId: '1234', teams: [], count: 0 });
    expect(component.isLoading()).toBeFalse();
  });

  it('should open and close the team roster modal', () => {
    httpMock.expectOne(req => req.url.includes('.csv')).flush('');
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({ sessionId: '1234', teams: [], count: 0 });
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

    const roster = component.teamRosters['Team A'];
    expect(roster).toBeTruthy();
    const rbGroup = roster.starters.find(s => s.position === 'RB');
    expect(rbGroup?.slots.map(s => s?.name)).toEqual(['RB One', 'RB Two']);
    expect(roster.bench[0]?.name).toBe('RB Three');
  });

  it('blocks drafting a player when the position and bench are both full, showing an inline message', () => {
    httpMock.expectOne(req => req.url.includes('.csv')).flush('');
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({ sessionId: '1234', teams: [], count: 0 });

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
});
