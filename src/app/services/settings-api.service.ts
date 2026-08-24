import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../constants';
import { SessionService } from './session.service';

export interface DraftSettings {
  sessionId: string;
  rounds: number;
  qb: number;
  rb: number;
  wr: number;
  te: number;
  dst: number;
  k: number;
  bench: number;
}

/** The settings fields `setSettings` accepts — every field but `sessionId`. */
export type SettingsUpdate = Partial<Omit<DraftSettings, 'sessionId'>>;

export interface VerifyCommissionerResponse {
  sessionId: string;
  valid: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SettingsApiService {
  constructor(private http: HttpClient, private sessionService: SessionService) {}

  /**
   * GET /getSettings — returns the current session's settings (`rounds` plus Team
   * Size: `qb`/`rb`/`wr`/`te`/`dst`/`k`/`bench`), defaulting server-side field by field when
   * the session has never customized them. Meant to be called once per page load, not
   * polled — a setting changed mid-draft by the commissioner is only picked up
   * elsewhere on the next page load.
   */
  getSettings(): Observable<DraftSettings> {
    return this.http.get<DraftSettings>(`${API_BASE_URL}/getSettings`, {
      params: { sessionId: this.sessionService.getSessionId() }
    });
  }

  /**
   * POST /setSettings — partial update of the current session's settings. Only the
   * fields present in `changes` are sent, and only those are written server-side
   * (see lambda/setSettings/index.js) — `{ rounds: 15 }` touches just `rounds`,
   * `{ wr: 3, rb: 3 }` touches just those two. Callers are expected to only include
   * fields that actually changed (see settings.component.ts), though the endpoint
   * itself doesn't require that — sending an unchanged value back is harmless, just
   * redundant.
   */
  updateSettings(changes: SettingsUpdate): Observable<DraftSettings> {
    return this.http.post<DraftSettings>(`${API_BASE_URL}/setSettings`, {
      sessionId: this.sessionService.getSessionId(),
      ...changes
    }, { headers: this.commissionerHeaders() });
  }

  /**
   * POST /verifyCommissioner — checks a typed password against the given session's
   * commissioner password up front, before the login screen navigates anywhere.
   * Takes `sessionId` explicitly rather than reading it from SessionService: at login
   * time the room the user is verifying against may not be the one already selected
   * (or nothing may be selected yet), so this must not depend on session state having
   * been committed. On a valid password (or a session with none set — see
   * lambda/models/commissioner.js), the observable emits normally; on `403` it errors,
   * same as every other endpoint.
   */
  verifyCommissioner(sessionId: string, password: string): Observable<VerifyCommissionerResponse> {
    return this.http.post<VerifyCommissionerResponse>(`${API_BASE_URL}/verifyCommissioner`, {
      sessionId,
      password
    });
  }

  // The backend only enforces this once a commissioner password has actually been
  // set for the session (see lambda/models/commissioner.js) — attaching it
  // unconditionally when we have one is harmless for sessions that don't.
  private commissionerHeaders(): { [header: string]: string } {
    const password = this.sessionService.getCommissionerPassword();
    return password ? { 'X-Commissioner-Password': password } : {};
  }
}
