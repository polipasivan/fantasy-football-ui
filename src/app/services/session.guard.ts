import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from './session.service';

export const sessionGuard: CanActivateFn = () => {
  const sessionService = inject(SessionService);
  const router = inject(Router);
  return sessionService.hasActiveSession() ? true : router.parseUrl('/login');
};
