import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { PlayersComponent } from './players.component';
import { DraftApiService } from '../services/draft-api.service';

describe('PlayersComponent', () => {
  let component: PlayersComponent;
  let fixture: ComponentFixture<PlayersComponent>;
  let httpMock: HttpTestingController;

  const csv = [
    '"RK",TIERS,"PLAYER NAME",TEAM,"POS","BYE WEEK","UPSIDE ","BUST ","SOS SEASON","ECR VS. ADP"',
    '"1",1,"Drafted Guy",BUF,"RB1","7","","","3 out of 5 stars","+1"',
    '"2",1,"Available Guy",BUF,"WR1","7","","","3 out of 5 stars","+1"'
  ].join('\n');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlayersComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PlayersComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    // The draft-board poll (started in ngOnInit via DraftApiService.startPolling) lives
    // on the shared service, not on the component — stop it explicitly so it doesn't
    // keep firing in the background against a torn-down TestBed in a later test.
    TestBed.inject(DraftApiService).stopPolling();
  });

  it('should create', () => {
    fixture.detectChanges();
    httpMock.expectOne(req => req.url.includes('.csv')).flush('');
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({ sessionId: '1234', teams: [], count: 0 });
    expect(component).toBeTruthy();
  });

  it('crosses out only players drafted in the current session\'s draft board', () => {
    fixture.detectChanges();
    httpMock.expectOne(req => req.url.includes('.csv')).flush(csv);
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({
      sessionId: '1234',
      teams: [{
        sessionId: '1234',
        teamName: 'Team A',
        players: [{ round: 1, name: 'Drafted Guy', position: 'RB' }]
      }],
      count: 1
    });

    expect(component.isDrafted('Drafted Guy')).toBeTrue();
    expect(component.isDrafted('Available Guy')).toBeFalse();
  });

  it('updates crossed-out players when the shared draft-board poll emits again, not just on the initial load', () => {
    fixture.detectChanges();
    httpMock.expectOne(req => req.url.includes('.csv')).flush(csv);
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({ sessionId: '1234', teams: [], count: 0 });

    expect(component.isDrafted('Drafted Guy')).toBeFalse();

    // Simulate the admin adding the player on the Dashboard while this page stays open —
    // pushed directly onto the shared draftBoard$ stream (see DraftApiService.startPolling)
    // to stand in for a later poll tick, since that poll's own timing is already covered
    // in draft-api.service.spec.ts; this just checks that PlayersComponent reacts to it.
    (TestBed.inject(DraftApiService) as any).draftBoardSubject.next({
      sessionId: '1234',
      teams: [{ sessionId: '1234', teamName: 'Team A', players: [{ round: 1, name: 'Drafted Guy', position: 'RB' }] }],
      count: 1
    });

    expect(component.isDrafted('Drafted Guy')).toBeTrue();
  });
});
