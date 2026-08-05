import { DraftPlayer } from '../services/draft-api.service';
import { STANDARD_ROSTER } from './roster-config';

export type RosterSlot = DraftPlayer | null;

export interface RosterBreakdown {
  starters: { position: string; slots: RosterSlot[] }[];
  bench: RosterSlot[];
  // Should stay empty whenever total roster spots >= rounds drafted; keeps the builder total/safe.
  overflow: DraftPlayer[];
}

export function buildRosterBreakdown(picks: DraftPlayer[]): RosterBreakdown {
  const starters = STANDARD_ROSTER.starters.map(s => ({
    position: s.position,
    slots: new Array<RosterSlot>(s.count).fill(null),
  }));
  const bench = new Array<RosterSlot>(STANDARD_ROSTER.bench).fill(null);
  const overflow: DraftPlayer[] = [];

  for (const pick of picks) {
    const group = starters.find(s => s.position === pick.position);
    const openStarterIdx = group ? group.slots.findIndex(s => s === null) : -1;
    if (group && openStarterIdx !== -1) {
      group.slots[openStarterIdx] = pick;
      continue;
    }
    const openBenchIdx = bench.findIndex(s => s === null);
    if (openBenchIdx !== -1) {
      bench[openBenchIdx] = pick;
      continue;
    }
    overflow.push(pick);
  }

  return { starters, bench, overflow };
}

// Position slot is checked before the bench, matching the order a real roster fills.
export function hasOpenRosterSlot(roster: RosterBreakdown | undefined, position: string): boolean {
  if (!roster) return true;
  const group = roster.starters.find(s => s.position === position);
  if (group && group.slots.some(s => s === null)) return true;
  return roster.bench.some(s => s === null);
}
