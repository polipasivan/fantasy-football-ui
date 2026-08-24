import { DEFAULT_POSITION_COUNTS, STANDARD_ROSTER, toRosterConfig } from './roster-config';

describe('toRosterConfig', () => {
  it('maps each position count field to a starters entry', () => {
    const config = toRosterConfig({ qb: 1, rb: 3, wr: 3, te: 1, dst: 1, k: 0 });

    expect(config.starters).toEqual([
      { position: 'QB', count: 1 },
      { position: 'RB', count: 3 },
      { position: 'WR', count: 3 },
      { position: 'TE', count: 1 },
      { position: 'DST', count: 1 },
      { position: 'K', count: 0 },
    ]);
  });

  it('applies a custom bench count when provided, same as any starter field', () => {
    const config = toRosterConfig({ qb: 1, rb: 2, wr: 2, te: 1, dst: 1, k: 1, bench: 10 });
    expect(config.bench).toBe(10);
  });

  it('bench can validly be set to zero, same as a starter field', () => {
    const config = toRosterConfig({ qb: 1, rb: 2, wr: 2, te: 1, dst: 1, k: 1, bench: 0 });
    expect(config.bench).toBe(0);
  });

  it('falls back to the default bench count when bench is missing', () => {
    const config = toRosterConfig({ qb: 5, rb: 5, wr: 5, te: 5, dst: 5, k: 5 });
    expect(config.bench).toBe(DEFAULT_POSITION_COUNTS.bench);
  });

  it('falls back to DEFAULT_POSITION_COUNTS field by field when fields are missing', () => {
    const config = toRosterConfig({ wr: 3 });

    const byPosition = Object.fromEntries(config.starters.map(s => [s.position, s.count]));
    expect(byPosition['WR']).toBe(3);
    expect(byPosition['QB']).toBe(DEFAULT_POSITION_COUNTS.qb);
    expect(byPosition['RB']).toBe(DEFAULT_POSITION_COUNTS.rb);
    expect(byPosition['TE']).toBe(DEFAULT_POSITION_COUNTS.te);
    expect(byPosition['DST']).toBe(DEFAULT_POSITION_COUNTS.dst);
    expect(byPosition['K']).toBe(DEFAULT_POSITION_COUNTS.k);
    expect(config.bench).toBe(DEFAULT_POSITION_COUNTS.bench);
  });

  it('falls back to defaults entirely for an empty object, matching STANDARD_ROSTER', () => {
    expect(toRosterConfig({})).toEqual(STANDARD_ROSTER);
  });
});

describe('STANDARD_ROSTER', () => {
  it('matches DEFAULT_POSITION_COUNTS — the shape used before Settings has loaded', () => {
    const byPosition = Object.fromEntries(STANDARD_ROSTER.starters.map(s => [s.position, s.count]));
    expect(byPosition).toEqual({
      QB: DEFAULT_POSITION_COUNTS.qb,
      RB: DEFAULT_POSITION_COUNTS.rb,
      WR: DEFAULT_POSITION_COUNTS.wr,
      TE: DEFAULT_POSITION_COUNTS.te,
      DST: DEFAULT_POSITION_COUNTS.dst,
      K: DEFAULT_POSITION_COUNTS.k,
    });
    expect(STANDARD_ROSTER.bench).toBe(8);
  });
});
