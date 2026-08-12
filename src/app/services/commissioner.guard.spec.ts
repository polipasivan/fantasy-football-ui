import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { provideRouter } from '@angular/router';
import { commissionerGuard } from './commissioner.guard';
import { SessionService } from './session.service';

describe('commissionerGuard', () => {
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

  it('allows navigation when a commissioner password is held', () => {
    TestBed.inject(SessionService).setCommissionerPassword('fambam123');

    const result = TestBed.runInInjectionContext(() => commissionerGuard({} as any, {} as any));

    expect(result).toBeTrue();
  });

  it('redirects to / when there is no commissioner password', () => {
    const result = TestBed.runInInjectionContext(() => commissionerGuard({} as any, {} as any));

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/');
  });
});
