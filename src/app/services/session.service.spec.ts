import { TestBed } from '@angular/core/testing';
import { SessionService } from './session.service';

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(SessionService);
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('has no active session by default', () => {
    expect(service.hasActiveSession()).toBeFalse();
    expect(service.getSessionId()).toBe('');
  });

  it('persists the selected room session id across instances', () => {
    service.selectRoom({ name: 'Fam Bam', sessionId: '1234' });

    expect(service.hasActiveSession()).toBeTrue();
    expect(service.getSessionId()).toBe('1234');

    const anotherInstance = TestBed.inject(SessionService);
    expect(anotherInstance.getSessionId()).toBe('1234');
  });

  it('has no commissioner password by default', () => {
    expect(service.isCommissioner()).toBeFalse();
    expect(service.getCommissionerPassword()).toBeNull();
  });

  it('stores and clears the commissioner password via sessionStorage', () => {
    service.setCommissionerPassword('fambam123');

    expect(service.isCommissioner()).toBeTrue();
    expect(service.getCommissionerPassword()).toBe('fambam123');
    expect(sessionStorage.getItem('fantasyDraftCommissionerPassword')).toBe('fambam123');

    service.clearCommissionerPassword();

    expect(service.isCommissioner()).toBeFalse();
    expect(service.getCommissionerPassword()).toBeNull();
  });

  it('keeps the commissioner password in sessionStorage, not localStorage', () => {
    service.setCommissionerPassword('fambam123');
    expect(localStorage.getItem('fantasyDraftCommissionerPassword')).toBeNull();
  });
});
