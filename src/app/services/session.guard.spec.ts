import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { provideRouter } from '@angular/router';
import { sessionGuard } from './session.guard';
import { SessionService } from './session.service';

describe('sessionGuard', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([])]
    });
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('allows navigation when a session is active', () => {
    TestBed.inject(SessionService).selectRoom({ name: 'Fam Bam', sessionId: '1234' });

    const result = TestBed.runInInjectionContext(() => sessionGuard({} as any, {} as any));

    expect(result).toBeTrue();
  });

  it('redirects to /login when there is no active session', () => {
    const result = TestBed.runInInjectionContext(() => sessionGuard({} as any, {} as any));

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/login');
  });
});
