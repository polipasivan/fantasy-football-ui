import { buildRosterBreakdown, hasOpenRosterSlot } from './roster';
import { RosterConfig, toRosterConfig, STANDARD_ROSTER } from './roster-config';
import { DraftPlayer } from '../services/draft-api.service';

describe('buildRosterBreakdown', () => {
  it('uses STANDARD_ROSTER when no config is passed', () => {
    const roster = buildRosterBreakdown([]);
    const rbGroup = roster.starters.find(s => s.position === 'RB');
    expect(rbGroup?.slots.length).toBe(2); // STANDARD_ROSTER default
    expect(roster.bench.length).toBe(8);
  });

  it('respects a custom Team Size config — more starter slots at a position', () => {
    const config = toRosterConfig({ qb: 1, rb: 2, wr: 3, te: 1, dst: 1, k: 1 });
    const picks: DraftPlayer[] = [
      { round: 1, name: 'WR One', position: 'WR' },
      { round: 2, name: 'WR Two', position: 'WR' },
      { round: 3, name: 'WR Three', position: 'WR' },
    ];

    const roster = buildRosterBreakdown(picks, config);
    const wrGroup = roster.starters.find(s => s.position === 'WR');
    expect(wrGroup?.slots.map(s => s?.name)).toEqual(['WR One', 'WR Two', 'WR Three']);
    expect(roster.bench.every(s => s === null)).toBeTrue(); // none pushed to bench
  });

  it('respects a custom Team Size config — a different bench count', () => {
    const config = toRosterConfig({ qb: 1, rb: 2, wr: 2, te: 1, dst: 1, k: 1, bench: 3 });
    const roster = buildRosterBreakdown([], config);
    expect(roster.bench.length).toBe(3);
  });

  it('a position configured to 0 slots sends every pick at that position straight to the bench', () => {
    const config = toRosterConfig({ qb: 0, rb: 2, wr: 2, te: 1, dst: 1, k: 1 });
    const picks: DraftPlayer[] = [{ round: 1, name: 'Some QB', position: 'QB' }];

    const roster = buildRosterBreakdown(picks, config);
    const qbGroup = roster.starters.find(s => s.position === 'QB');
    expect(qbGroup?.slots).toEqual([]);
    expect(roster.bench[0]?.name).toBe('Some QB');
  });

  it('shrinking a position after picks already exist pushes the overflow to bench, not to overflow[], while bench has room', () => {
    // Team originally had 2 RB starter slots and drafted 2 RBs; Team Size is then
    // reduced to 1 RB starter slot. Rebuilding from the same picks against the new
    // config reclassifies the 2nd RB as bench — no picks are lost.
    const shrunkConfig = toRosterConfig({ qb: 1, rb: 1, wr: 2, te: 1, dst: 1, k: 1 });
    const picks: DraftPlayer[] = [
      { round: 1, name: 'RB One', position: 'RB' },
      { round: 2, name: 'RB Two', position: 'RB' },
    ];

    const roster = buildRosterBreakdown(picks, shrunkConfig);
    const rbGroup = roster.starters.find(s => s.position === 'RB');
    expect(rbGroup?.slots.map(s => s?.name)).toEqual(['RB One']);
    expect(roster.bench[0]?.name).toBe('RB Two');
    expect(roster.overflow).toEqual([]);
  });
});

describe('hasOpenRosterSlot with a custom config', () => {
  const config: RosterConfig = toRosterConfig({ qb: 1, rb: 2, wr: 1, te: 1, dst: 1, k: 1 });

  it('is true when the position has an open starter slot under the custom config', () => {
    const roster = buildRosterBreakdown([], config);
    expect(hasOpenRosterSlot(roster, 'WR')).toBeTrue();
  });

  it('is false once the custom (smaller) WR allotment and the bench are both full', () => {
    // 1 WR starter slot (custom) + 8 bench slots = 9 total WR-eligible spots.
    const picks: DraftPlayer[] = Array.from({ length: 9 }, (_, i) => ({
      round: i + 1, name: `WR ${i + 1}`, position: 'WR'
    }));
    const roster = buildRosterBreakdown(picks, config);
    expect(hasOpenRosterSlot(roster, 'WR')).toBeFalse();
  });

  it('defaults to true (open) when the roster is undefined', () => {
    expect(hasOpenRosterSlot(undefined, 'WR')).toBeTrue();
  });
});
