import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from './session.service';

// Guards the Settings route: a viewer with no commissioner password in
// sessionStorage gets bounced back to the dashboard rather than being able to reach
// the Teams/Rounds controls at all. This is UI-only convenience, not the real
// security boundary — every write endpoint re-checks the password itself (see
// lambda/models/commissioner.js) regardless of whether this guard ever ran.
export const commissionerGuard: CanActivateFn = () => {
  const sessionService = inject(SessionService);
  const router = inject(Router);
  return sessionService.isCommissioner() ? true : router.parseUrl('/');
};
