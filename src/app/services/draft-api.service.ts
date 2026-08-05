import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../constants';
import { SessionService } from './session.service';

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
  constructor(private http: HttpClient, private sessionService: SessionService) {}

  /**
   * GET /getDraftBoard — returns every team (and its players) for the current session.
   */
  getDraftBoard(): Observable<DraftBoardResponse> {
    return this.http.get<DraftBoardResponse>(`${API_BASE_URL}/getDraftBoard`, {
      params: { sessionId: this.sessionService.getSessionId() }
    });
  }

  /**
   * POST /addTeam — creates a team under the current session with an empty players list.
   * The session id is sent in the request body.
   */
  addTeam(teamName: string): Observable<Team> {
    return this.http.post<Team>(`${API_BASE_URL}/addTeam`, {
      sessionId: this.sessionService.getSessionId(),
      teamName
    });
  }

  /**
   * POST /addPlayer — appends a player to a team's list for the current session.
   */
  addPlayer(teamName: string, player: DraftPlayer): Observable<Team> {
    return this.http.post<Team>(`${API_BASE_URL}/addPlayer`, {
      sessionId: this.sessionService.getSessionId(),
      teamName,
      player
    });
  }

  /**
   * DELETE /deletePlayer — removes the player at a given round from a team.
   */
  deletePlayer(teamName: string, round: number): Observable<Team> {
    return this.http.delete<Team>(`${API_BASE_URL}/deletePlayer`, {
      params: { sessionId: this.sessionService.getSessionId(), teamName, round: String(round) }
    });
  }
}
