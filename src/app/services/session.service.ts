import { Injectable } from '@angular/core';
import { DraftRoom } from '../constants';

const SESSION_STORAGE_KEY = 'fantasyDraftSessionId';

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
}
