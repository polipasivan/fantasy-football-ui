import { Injectable } from '@angular/core';
import { DraftRoom } from '../constants';

const SESSION_STORAGE_KEY = 'fantasyDraftSessionId';
const COMMISSIONER_PASSWORD_KEY = 'fantasyDraftCommissionerPassword';

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  getSessionId(): string {
    return localStorage.getItem(SESSION_STORAGE_KEY) ?? '';
  }

  hasActiveSession(): boolean {
    return this.getSessionId().length > 0;
  }

  selectRoom(room: DraftRoom): void {
    localStorage.setItem(SESSION_STORAGE_KEY, room.sessionId);
  }

  clearSession(): void {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }

  // The commissioner password is intentionally kept in sessionStorage, not
  // localStorage: unlike the session id (which persists across tab closes on
  // purpose), commissioner access should not survive closing the tab. sessionStorage
  // is cleared by the browser automatically on tab close — no extra code needed for
  // that half of it. leaveDraft() additionally calls clearCommissionerPassword()
  // explicitly, so leaving the draft (without closing the tab) also drops it.
  getCommissionerPassword(): string | null {
    return sessionStorage.getItem(COMMISSIONER_PASSWORD_KEY);
  }

  isCommissioner(): boolean {
    return !!this.getCommissionerPassword();
  }

  setCommissionerPassword(password: string): void {
    sessionStorage.setItem(COMMISSIONER_PASSWORD_KEY, password);
  }

  clearCommissionerPassword(): void {
    sessionStorage.removeItem(COMMISSIONER_PASSWORD_KEY);
  }
}
