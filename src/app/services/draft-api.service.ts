import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL, SESSION_ID } from '../constants';

export interface DraftPlayer {
  round: number;
  name: string;
  position: string;
}

export interface Team {
  sessionId: string;
  teamName: string;
  players: DraftPlayer[];
}

export interface DraftBoardResponse {
  sessionId: string;
  teams: Team[];
  count: number;
}

@Injectable({
  providedIn: 'root'
})
export class DraftApiService {
  constructor(private http: HttpClient) {}

  /**
   * GET /getDraftBoard — returns every team (and its players) for the hardcoded session.
   */
  getDraftBoard(): Observable<DraftBoardResponse> {
    return this.http.get<DraftBoardResponse>(`${API_BASE_URL}/getDraftBoard`, {
      params: { sessionId: SESSION_ID }
    });
  }

  /**
   * POST /addTeam — creates a team under the hardcoded session with an empty players list.
   * The session id is sent in the request body.
   */
  addTeam(teamName: string): Observable<Team> {
    return this.http.post<Team>(`${API_BASE_URL}/addTeam`, {
      sessionId: SESSION_ID,
      teamName
    });
  }

  /**
   * POST /addPlayer — appends a player to a team's list for the hardcoded session.
   */
  addPlayer(teamName: string, player: DraftPlayer): Observable<Team> {
    return this.http.post<Team>(`${API_BASE_URL}/addPlayer`, {
      sessionId: SESSION_ID,
      teamName,
      player
    });
  }

  /**
   * DELETE /deletePlayer — removes the player at a given round from a team.
   */
  deletePlayer(teamName: string, round: number): Observable<Team> {
    return this.http.delete<Team>(`${API_BASE_URL}/deletePlayer`, {
      params: { sessionId: SESSION_ID, teamName, round: String(round) }
    });
  }
}
