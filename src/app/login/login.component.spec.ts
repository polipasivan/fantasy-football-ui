import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { LoginComponent } from './login.component';
import { SessionService } from '../services/session.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let router: Router;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('defaults to the first draft room', () => {
    expect(component.selectedRoom).toEqual(component.rooms[0]);
  });

  it('lists every configured draft room', () => {
    expect(component.rooms.map(r => r.name)).toEqual(['Fam Bam', 'Diesel Clan']);
  });

  it('toggles the dropdown open and closed', () => {
    expect(component.dropdownOpen).toBeFalse();
    component.toggleDropdown();
    expect(component.dropdownOpen).toBeTrue();
    component.toggleDropdown();
    expect(component.dropdownOpen).toBeFalse();
  });

  it('renders the option list directly below the trigger once opened', () => {
    component.toggleDropdown();
    fixture.detectChanges();

    const menu = fixture.nativeElement.querySelector('.dropdown-menu');
    const options = fixture.nativeElement.querySelectorAll('.dropdown-option');
    expect(menu).toBeTruthy();
    expect(options.length).toBe(component.rooms.length);
  });

  it('choosing a room updates selectedRoom and closes the dropdown', () => {
    component.toggleDropdown();
    component.chooseRoom(component.rooms[1]);

    expect(component.selectedRoom).toEqual(component.rooms[1]);
    expect(component.dropdownOpen).toBeFalse();
  });

  it('closes the dropdown when clicking outside it', () => {
    component.toggleDropdown();
    expect(component.dropdownOpen).toBeTrue();

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(component.dropdownOpen).toBeFalse();
  });

  // ---------- Blank password: viewer, no verification call ----------

  it('selects the room and navigates to the board immediately when the field is blank', () => {
    const sessionService = TestBed.inject(SessionService);
    spyOn(sessionService, 'selectRoom');
    spyOn(router, 'navigateByUrl');

    component.enterDraft();

    expect(sessionService.selectRoom).toHaveBeenCalledWith(component.selectedRoom);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
    httpMock.expectNone(req => req.url.includes('verifyCommissioner'));
  });

  it('enters as a viewer (no commissioner password) when the field is left blank', () => {
    const sessionService = TestBed.inject(SessionService);
    component.commissionerPassword = '';

    component.enterDraft();

    expect(sessionService.isCommissioner()).toBeFalse();
  });

  it('clears a stale commissioner password when re-entering without one', () => {
    const sessionService = TestBed.inject(SessionService);
    sessionService.setCommissionerPassword('leftover-from-last-time');
    component.commissionerPassword = '   ';

    component.enterDraft();

    expect(sessionService.isCommissioner()).toBeFalse();
  });

  // ---------- Non-blank password: verified up front ----------

  it('verifies a typed password against the selected room before entering', () => {
    component.commissionerPassword = ' fambam123 ';

    component.enterDraft();

    expect(component.verifying).toBeTrue();
    const req = httpMock.expectOne(r => r.url.includes('verifyCommissioner'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ sessionId: component.selectedRoom.sessionId, password: 'fambam123' });
    req.flush({ sessionId: component.selectedRoom.sessionId, valid: true });
  });

  it('does not touch session storage until verification succeeds', () => {
    const sessionService = TestBed.inject(SessionService);
    spyOn(sessionService, 'selectRoom');
    component.commissionerPassword = 'fambam123';

    component.enterDraft();

    expect(sessionService.selectRoom).not.toHaveBeenCalled();
    expect(sessionService.isCommissioner()).toBeFalse();

    httpMock.expectOne(r => r.url.includes('verifyCommissioner')).flush({ sessionId: '1234', valid: true });
  });

  it('stores the password and navigates once verification succeeds', () => {
    const sessionService = TestBed.inject(SessionService);
    spyOn(router, 'navigateByUrl');
    component.commissionerPassword = 'fambam123';

    component.enterDraft();
    httpMock.expectOne(r => r.url.includes('verifyCommissioner')).flush({ sessionId: '1234', valid: true });

    expect(component.verifying).toBeFalse();
    expect(sessionService.getCommissionerPassword()).toBe('fambam123');
    expect(sessionService.getSessionId()).toBe(component.selectedRoom.sessionId);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('shows "Invalid admin password." on a 403 and does not navigate or store anything', () => {
    const sessionService = TestBed.inject(SessionService);
    spyOn(router, 'navigateByUrl');
    component.commissionerPassword = 'wrong-password';

    component.enterDraft();
    httpMock.expectOne(r => r.url.includes('verifyCommissioner'))
      .flush({ message: 'Invalid admin password.' }, { status: 403, statusText: 'Forbidden' });

    expect(component.verifying).toBeFalse();
    expect(component.passwordError).toBe('Invalid admin password.');
    expect(sessionService.isCommissioner()).toBeFalse();
    expect(sessionService.hasActiveSession()).toBeFalse();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('shows a generic error on an unexpected failure', () => {
    component.commissionerPassword = 'fambam123';

    component.enterDraft();
    httpMock.expectOne(r => r.url.includes('verifyCommissioner'))
      .flush({ message: 'error' }, { status: 500, statusText: 'Server Error' });

    expect(component.passwordError).toBe('Failed to verify password. Please try again.');
  });

  it('clears a previous password error once the field is edited again', () => {
    component.passwordError = 'Invalid admin password.';

    component.onPasswordInput();

    expect(component.passwordError).toBeNull();
  });

  it('clears a previous password error when the room selection changes', () => {
    component.passwordError = 'Invalid admin password.';

    component.chooseRoom(component.rooms[1]);

    expect(component.passwordError).toBeNull();
  });

  it('ignores a second Enter Draft click while a verification is already in flight', () => {
    component.commissionerPassword = 'fambam123';
    component.enterDraft();
    component.enterDraft();

    // A second matching pending request would make expectOne throw — asserting the
    // single one exists proves the guard suppressed the duplicate.
    const req = httpMock.expectOne(r => r.url.includes('verifyCommissioner'));
    expect(req.request.body.password).toBe('fambam123');
    req.flush({ sessionId: '1234', valid: true });
  });
});
