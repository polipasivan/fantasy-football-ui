import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { TeamRosterModalComponent } from './team-roster-modal.component';

describe('TeamRosterModalComponent', () => {
  let component: TeamRosterModalComponent;
  let fixture: ComponentFixture<TeamRosterModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeamRosterModalComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TeamRosterModalComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders nothing when team is null', () => {
    component.team = null;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.modal-overlay')).toBeNull();
  });

  it('emits closed when the overlay is clicked', () => {
    component.team = 'Team A';
    fixture.detectChanges();
    spyOn(component.closed, 'emit');

    fixture.debugElement.query(By.css('.modal-overlay')).triggerEventHandler('click', { stopPropagation: () => {} });

    expect(component.closed.emit).toHaveBeenCalled();
  });

  it('does not emit closed when the inner modal is clicked', () => {
    component.team = 'Team A';
    fixture.detectChanges();
    spyOn(component.closed, 'emit');

    fixture.debugElement.query(By.css('.roster-modal')).triggerEventHandler('click', { stopPropagation: () => {} });

    expect(component.closed.emit).not.toHaveBeenCalled();
  });

  it('shows a spinner instead of the roster while loading', () => {
    component.team = 'Team A';
    component.loading = true;
    component.roster = null;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.roster-modal-loading .spinner')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.roster-section')).toBeNull();
  });
});
