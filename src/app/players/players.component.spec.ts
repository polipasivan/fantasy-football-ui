import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { PlayersComponent } from './players.component';

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

  it('re-fetches the draft board (not a cached snapshot) on every load', () => {
    fixture.detectChanges();
    httpMock.expectOne(req => req.url.includes('.csv')).flush(csv);
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({ sessionId: '1234', teams: [], count: 0 });

    expect(component.isDrafted('Drafted Guy')).toBeFalse();

    component.loadDraftedPlayers();
    httpMock.expectOne(req => req.url.includes('getDraftBoard')).flush({
      sessionId: '1234',
      teams: [{ sessionId: '1234', teamName: 'Team A', players: [{ round: 1, name: 'Drafted Guy', position: 'RB' }] }],
      count: 1
    });

    expect(component.isDrafted('Drafted Guy')).toBeTrue();
  });
});
