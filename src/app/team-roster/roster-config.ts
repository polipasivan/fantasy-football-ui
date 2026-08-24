export interface RosterConfig {
  starters: { position: string; count: number }[];
  bench: number;
}

/**
 * Starter-slot counts per position, plus `bench` — the shape a getSettings/
 * setSettings response carries. `bench` isn't a starter position (it doesn't appear
 * in `starters` below — it maps to `RosterConfig.bench` directly), but it's a Team
 * Size field the commissioner can edit exactly like the others — see
 * `DEFAULT_POSITION_COUNTS` in `lambda/models/settings.js`.
 */
export interface PositionCounts {
  qb: number;
  rb: number;
  wr: number;
  te: number;
  dst: number;
  k: number;
  bench: number;
}

// Matches DEFAULT_POSITION_COUNTS in lambda/models/settings.js — a session that's
// never customized Team Size behaves exactly as every session did before this
// feature existed.
export const DEFAULT_POSITION_COUNTS: PositionCounts = { qb: 1, rb: 2, wr: 2, te: 1, dst: 1, k: 1, bench: 8 };

// Order here drives starter-group render order in the roster modal — matches the
// Team Size section's field order and the app's position legend (QB, RB, WR, TE,
// DEF, K). `dst` is the internal key for the DEF/ST position (see roster.ts /
// lambda/models/settings.js) even though the label shown to users is "DEF".
const STARTER_POSITIONS: { position: string; countKey: keyof PositionCounts }[] = [
  { position: 'QB', countKey: 'qb' },
  { position: 'RB', countKey: 'rb' },
  { position: 'WR', countKey: 'wr' },
  { position: 'TE', countKey: 'te' },
  { position: 'DST', countKey: 'dst' },
  { position: 'K', countKey: 'k' },
];

/**
 * Turns the Team Size fields from a getSettings/setSettings response into the
 * RosterConfig shape buildRosterBreakdown (roster.ts) uses. A position with a count
 * of 0 still appears in `starters` with an empty `slots` array once built — callers
 * that render starter groups (the roster modal) filter those out rather than this
 * function omitting them, so the mapping here stays a straightforward 1:1. `bench`
 * maps straight to `RosterConfig.bench` the same defensive way as every starter
 * field, rather than the fixed value it used to be — see `roster.ts`'s
 * `buildRosterBreakdown`, which already just treats `config.bench` as a plain count.
 *
 * Accepts `Partial<PositionCounts>` and falls back to `DEFAULT_POSITION_COUNTS` field
 * by field for anything missing — the real getSettings endpoint always sends all seven
 * (see `withSettingsDefaults` in lambda/models/settings.js), but staying defensive
 * here means a missing field degrades to the old fixed roster shape for that one
 * field rather than `new Array(undefined)` silently producing a 1-slot array.
 */
export function toRosterConfig(counts: Partial<PositionCounts>): RosterConfig {
  return {
    starters: STARTER_POSITIONS.map(({ position, countKey }) => ({
      position,
      count: counts[countKey] ?? DEFAULT_POSITION_COUNTS[countKey],
    })),
    bench: counts.bench ?? DEFAULT_POSITION_COUNTS.bench,
  };
}

// The roster shape used before Settings has loaded (or if it fails to load) — the
// same defaults DEFAULT_POSITION_COUNTS describes, so nothing behaves differently
// from before this feature existed until the commissioner actually customizes Team
// Size for a session.
export const STANDARD_ROSTER: RosterConfig = toRosterConfig(DEFAULT_POSITION_COUNTS);
