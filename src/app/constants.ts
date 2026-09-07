// App-wide constants.

// Base URL of the deployed Fantasy Football Draft Board API (FantasyFootballInfrastructureStack).
export const API_BASE_URL = 'https://qn1aq9wg73.execute-api.us-east-1.amazonaws.com/prod';

export interface DraftRoom {
  name: string;
  sessionId: string;
}

// "Fam Bam" is the go-forward session id for the draft (started fresh — the deployed
// table's prior real draft data under sessionId 1234 is intentionally left behind,
// not migrated).
export const DRAFT_ROOMS: DraftRoom[] = [
  { name: 'Fam Bam', sessionId: '4321' },
  { name: 'Diesel Clan', sessionId: '9876' }
];
