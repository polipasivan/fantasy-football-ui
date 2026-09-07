import { TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { DraftApiService, DRAFT_BOARD_POLL_INTERVAL_MS } from './draft-api.service';
import { SessionService } from './session.service';

describe('DraftApiService', () => {
  let service: DraftApiService;
  let sessionService: SessionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(DraftApiService);
    sessionService = TestBed.inject(SessionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('does not attach X-Commissioner-Password when none is held', () => {
    service.addTeam('Team A').subscribe();
    const req = httpMock.expectOne(r => r.url.includes('addTeam'));
    expect(req.request.headers.has('X-Commissioner-Password')).toBeFalse();
    req.flush({ sessionId: '1234', teamName: 'Team A', players: [] });
  });

  it('attaches X-Commissioner-Password to addTeam when one is held', () => {
    sessionService.setCommissionerPassword('fambam123');

    service.addTeam('Team A').subscribe();
    const req = httpMock.expectOne(r => r.url.includes('addTeam'));
    expect(req.request.headers.get('X-Commissioner-Password')).toBe('fambam123');
    req.flush({ sessionId: '1234', teamName: 'Team A', players: [] });
  });

  it('attaches X-Commissioner-Password to addPlayer', () => {
    sessionService.setCommissionerPassword('fambam123');

    service.addPlayer('Team A', { round: 1, name: 'tyreek', position: 'WR' }).subscribe();
    const req = httpMock.expectOne(r => r.url.includes('addPlayer'));
    expect(req.request.headers.get('X-Commissioner-Password')).toBe('fambam123');
    req.flush({ sessionId: '1234', teamName: 'Team A', players: [] });
  });

  it('attaches X-Commissioner-Password to deletePlayer', () => {
    sessionService.setCommissionerPassword('fambam123');

    service.deletePlayer('Team A', 1).subscribe();
    const req = httpMock.expectOne(r => r.url.includes('deletePlayer'));
    expect(req.request.headers.get('X-Commissioner-Password')).toBe('fambam123');
    req.flush({ sessionId: '1234', teamName: 'Team A', players: [] });
  });

  it('attaches X-Commissioner-Password to deleteTeam', () => {
    sessionService.setCommissionerPassword('fambam123');

    service.deleteTeam('Team A').subscribe();
    const req = httpMock.expectOne(r => r.url.includes('deleteTeam'));
    expect(req.request.headers.get('X-Commissioner-Password')).toBe('fambam123');
    req.flush({ sessionId: '1234', teamName: 'Team A', players: [], active: false });
  });

  it('never attaches X-Commissioner-Password to the read-only getDraftBoard call', () => {
    sessionService.setCommissionerPassword('fambam123');

    service.getDraftBoard().subscribe();
    const req = httpMock.expectOne(r => r.url.includes('getDraftBoard'));
    expect(req.request.headers.has('X-Commissioner-Password')).toBeFalse();
    req.flush({ sessionId: '1234', teams: [], count: 0 });
  });

  it('omits draftOrder from the addTeam body when not given', () => {
    service.addTeam('Team A').subscribe();
    const req = httpMock.expectOne(r => r.url.includes('addTeam'));
    expect(req.request.body).toEqual({ sessionId: '', teamName: 'Team A' });
    req.flush({ sessionId: '1234', teamName: 'Team A', players: [] });
  });

  it('includes draftOrder in the addTeam body when given', () => {
    service.addTeam('Team A', 2).subscribe();
    const req = httpMock.expectOne(r => r.url.includes('addTeam'));
    expect(req.request.body).toEqual({ sessionId: '', teamName: 'Team A', draftOrder: 2 });
    req.flush({ sessionId: '1234', teamName: 'Team A', players: [], draftOrder: 2 });
  });

  it('sends a PATCH to updateTeam with the team identity and changes, attaching X-Commissioner-Password', () => {
    sessionService.setCommissionerPassword('fambam123');

    service.updateTeam('Team A', { draftOrder: 1 }).subscribe();
    const req = httpMock.expectOne(r => r.url.includes('updateTeam'));
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ sessionId: '', teamName: 'Team A', draftOrder: 1 });
    expect(req.request.headers.get('X-Commissioner-Password')).toBe('fambam123');
    req.flush({ sessionId: '1234', teamName: 'Team A', players: [], draftOrder: 1 });
  });

  // ---------- Shared draft-board poll (startPolling/draftBoard$) ----------

  it('fetches immediately on startPolling and pushes the response onto draftBoard$', fakeAsync(() => {
    const seen: any[] = [];
    service.draftBoard$.subscribe(res => seen.push(res));

    service.startPolling();
    httpMock.expectOne(r => r.url.includes('getDraftBoard')).flush({ sessionId: '1234', teams: [], count: 0 });

    expect(seen.length).toBe(1);
    expect(seen[0].sessionId).toBe('1234');
    service.stopPolling();
    discardPeriodicTasks();
  }));

  it('is idempotent — a second startPolling call does not start a second poll', fakeAsync(() => {
    service.startPolling();
    httpMock.expectOne(r => r.url.includes('getDraftBoard')).flush({ sessionId: '1234', teams: [], count: 0 });

    service.startPolling();
    expect(httpMock.match(r => r.url.includes('getDraftBoard')).length).toBe(0);

    service.stopPolling();
    discardPeriodicTasks();
  }));

  it('shares one poll across multiple subscribers — a late subscriber gets the latest snapshot immediately', fakeAsync(() => {
    service.startPolling();
    httpMock.expectOne(r => r.url.includes('getDraftBoard')).flush({ sessionId: '1234', teams: [], count: 0 });

    let lateValue: any;
    service.draftBoard$.subscribe(res => lateValue = res);
    expect(lateValue.sessionId).toBe('1234');

    service.stopPolling();
    discardPeriodicTasks();
  }));

  it('re-fetches on the next tick after the poll interval elapses', fakeAsync(() => {
    service.startPolling();
    httpMock.expectOne(r => r.url.includes('getDraftBoard')).flush({ sessionId: '1234', teams: [], count: 0 });

    tick(DRAFT_BOARD_POLL_INTERVAL_MS);
    const req = httpMock.expectOne(r => r.url.includes('getDraftBoard'));
    expect(req.request.method).toBe('GET');
    req.flush({ sessionId: '1234', teams: [], count: 1 });

    service.stopPolling();
    discardPeriodicTasks();
  }));

  it('stops issuing requests once stopPolling is called', fakeAsync(() => {
    service.startPolling();
    httpMock.expectOne(r => r.url.includes('getDraftBoard')).flush({ sessionId: '1234', teams: [], count: 0 });

    service.stopPolling();
    tick(DRAFT_BOARD_POLL_INTERVAL_MS);
    expect(httpMock.match(r => r.url.includes('getDraftBoard')).length).toBe(0);
  }));

  it('a failed poll tick is logged and skipped, without killing the poll', fakeAsync(() => {
    spyOn(console, 'error');

    service.startPolling();
    httpMock.expectOne(r => r.url.includes('getDraftBoard'))
      .flush({ message: 'error' }, { status: 500, statusText: 'Server Error' });

    expect(console.error).toHaveBeenCalled();

    tick(DRAFT_BOARD_POLL_INTERVAL_MS);
    httpMock.expectOne(r => r.url.includes('getDraftBoard')).flush({ sessionId: '1234', teams: [], count: 0 });

    service.stopPolling();
    discardPeriodicTasks();
  }));
});
