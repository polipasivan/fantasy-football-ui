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
  active?: boolean;
  // Sort position on the draft board — lower first. Absent for a team that's never
  // had one set (see getDraftBoard's sort in lambda/models/team.js's sortByDraftOrder).
  draftOrder?: number;
}

// Fields updateTeam is allowed to change — currently just draftOrder, mirroring the
// backend's TEAM_UPDATABLE_FIELDS allowlist (lambda/models/team.js).
export interface TeamUpdate {
  draftOrder?: number;
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
   * The session id is sent in the request body. `draftOrder` is optional — the
   * Settings page always passes the next available value so a new team appends to
   * the end of the draft order.
   */
  addTeam(teamName: string, draftOrder?: number): Observable<Team> {
    return this.http.post<Team>(`${API_BASE_URL}/addTeam`, {
      sessionId: this.sessionService.getSessionId(),
      teamName,
      ...(draftOrder !== undefined ? { draftOrder } : {})
    }, { headers: this.commissionerHeaders() });
  }

  /**
   * POST /addPlayer — appends a player to a team's list for the current session.
   */
  addPlayer(teamName: string, player: DraftPlayer): Observable<Team> {
    return this.http.post<Team>(`${API_BASE_URL}/addPlayer`, {
      sessionId: this.sessionService.getSessionId(),
      teamName,
      player
    }, { headers: this.commissionerHeaders() });
  }

  /**
   * DELETE /deletePlayer — removes the player at a given round from a team.
   */
  deletePlayer(teamName: string, round: number): Observable<Team> {
    return this.http.delete<Team>(`${API_BASE_URL}/deletePlayer`, {
      params: { sessionId: this.sessionService.getSessionId(), teamName, round: String(round) },
      headers: this.commissionerHeaders()
    });
  }

  /**
   * DELETE /deleteTeam — soft-deletes a team for the current session (backend flips
   * `active` to false rather than removing its draft history).
   */
  deleteTeam(teamName: string): Observable<Team> {
    return this.http.delete<Team>(`${API_BASE_URL}/deleteTeam`, {
      params: { sessionId: this.sessionService.getSessionId(), teamName },
      headers: this.commissionerHeaders()
    });
  }

  /**
   * PATCH /updateTeam — partial update of allowlisted Team fields (currently just
   * draftOrder) for a team in the current session, identified by teamName. Used to
   * persist drag-and-drop draft-order reordering on the Settings page.
   */
  updateTeam(teamName: string, changes: TeamUpdate): Observable<Team> {
    return this.http.patch<Team>(`${API_BASE_URL}/updateTeam`, {
      sessionId: this.sessionService.getSessionId(),
      teamName,
      ...changes
    }, { headers: this.commissionerHeaders() });
  }

  // Every write above needs this; reads (getDraftBoard) don't. The backend only
  // enforces it once a commissioner password has actually been set for the session
  // (see lambda/models/commissioner.js) — attaching it unconditionally when we have
  // one is harmless for sessions that don't.
  private commissionerHeaders(): { [header: string]: string } {
    const password = this.sessionService.getCommissionerPassword();
    return password ? { 'X-Commissioner-Password': password } : {};
  }
}
