import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { TeamRosterModalComponent } from './team-roster-modal.component';
import { RosterBreakdown } from './roster';

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

  // A position configured with 0 Team Size slots still appears in the breakdown
  // (with an empty slots array) — the template is responsible for not rendering an
  // empty section for it.
  it('hides a starter section for a position with 0 configured slots, but shows one with slots', () => {
    const roster: RosterBreakdown = {
      starters: [
        { position: 'QB', slots: [] },
        { position: 'RB', slots: [null, null] },
      ],
      bench: [],
      overflow: []
    };
    component.team = 'Team A';
    component.loading = false;
    component.roster = roster;
    fixture.detectChanges();

    const sectionTitles = Array.from(fixture.nativeElement.querySelectorAll('.roster-section-title'))
      .map((el: any) => el.textContent.trim());
    expect(sectionTitles).not.toContain('QB');
    expect(sectionTitles).toContain('RB');
  });
});
