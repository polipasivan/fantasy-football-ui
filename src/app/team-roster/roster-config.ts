export interface RosterConfig {
  starters: { position: string; count: number }[];
  bench: number;
}

// Static for now — later a Settings tab can swap this out for a user-configured RosterConfig.
export const STANDARD_ROSTER: RosterConfig = {
  starters: [
    { position: 'QB', count: 1 },
    { position: 'RB', count: 2 },
    { position: 'WR', count: 2 },
    { position: 'TE', count: 1 },
    { position: 'DST', count: 1 },
    { position: 'K', count: 1 },
  ],
  bench: 7,
};
