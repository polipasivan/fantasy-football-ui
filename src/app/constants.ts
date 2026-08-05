// App-wide constants.

// Base URL of the deployed Fantasy Football Draft Board API (FantasyFootballInfrastructureStack).
export const API_BASE_URL = 'https://qn1aq9wg73.execute-api.us-east-1.amazonaws.com/prod';

export interface DraftRoom {
  name: string;
  sessionId: string;
}

// "Fam Bam" maps to the session id the deployed table already has real draft data under.
export const DRAFT_ROOMS: DraftRoom[] = [
  { name: 'Fam Bam', sessionId: '1234' },
  { name: 'Diesel Clan', sessionId: '9876' }
];
