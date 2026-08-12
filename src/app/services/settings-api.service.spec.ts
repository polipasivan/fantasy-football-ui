import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { SettingsApiService, DraftSettings } from './settings-api.service';
import { SessionService } from './session.service';

describe('SettingsApiService', () => {
  let service: SettingsApiService;
  let sessionService: SessionService;
  let httpMock: HttpTestingController;

  const fullSettings: DraftSettings = {
    sessionId: '1234', rounds: 12, qb: 1, rb: 2, wr: 2, te: 1, dst: 1, k: 1
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(SettingsApiService);
    sessionService = TestBed.inject(SessionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('does not attach X-Commissioner-Password to setSettings when none is held', () => {
    service.updateSettings({ rounds: 12 }).subscribe();
    const req = httpMock.expectOne(r => r.url.includes('setSettings'));
    expect(req.request.headers.has('X-Commissioner-Password')).toBeFalse();
    req.flush(fullSettings);
  });

  it('attaches X-Commissioner-Password to setSettings when one is held', () => {
    sessionService.setCommissionerPassword('fambam123');

    service.updateSettings({ rounds: 12 }).subscribe();
    const req = httpMock.expectOne(r => r.url.includes('setSettings'));
    expect(req.request.headers.get('X-Commissioner-Password')).toBe('fambam123');
    req.flush(fullSettings);
  });

  it('sends only the fields passed to updateSettings, alongside sessionId', () => {
    service.updateSettings({ wr: 3, rb: 3 }).subscribe();
    const req = httpMock.expectOne(r => r.url.includes('setSettings'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ sessionId: '', wr: 3, rb: 3 });
    req.flush({ ...fullSettings, wr: 3, rb: 3 });
  });

  it('never attaches X-Commissioner-Password to the read-only getSettings call', () => {
    sessionService.setCommissionerPassword('fambam123');

    service.getSettings().subscribe();
    const req = httpMock.expectOne(r => r.url.includes('getSettings'));
    expect(req.request.headers.has('X-Commissioner-Password')).toBeFalse();
    req.flush(fullSettings);
  });

  it('posts the given sessionId and password to verifyCommissioner, independent of the current session', () => {
    service.verifyCommissioner('9876', 'fambam123').subscribe();
    const req = httpMock.expectOne(r => r.url.includes('verifyCommissioner'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ sessionId: '9876', password: 'fambam123' });
    expect(req.request.headers.has('X-Commissioner-Password')).toBeFalse();
    req.flush({ sessionId: '9876', valid: true });
  });
});
