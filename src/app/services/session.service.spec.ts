import { TestBed } from '@angular/core/testing';
import { SessionService } from './session.service';

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(SessionService);
  });

  afterEach(() => {
    localStorage.clear();
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
});
