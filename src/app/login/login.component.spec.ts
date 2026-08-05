import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { LoginComponent } from './login.component';
import { SessionService } from '../services/session.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let router: Router;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
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

  it('selects the room and navigates to the board on Enter Draft', () => {
    const sessionService = TestBed.inject(SessionService);
    spyOn(sessionService, 'selectRoom');
    spyOn(router, 'navigateByUrl');

    component.enterDraft();

    expect(sessionService.selectRoom).toHaveBeenCalledWith(component.selectedRoom);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
  });
});
