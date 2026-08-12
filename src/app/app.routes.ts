import { Routes } from '@angular/router';
import { sessionGuard } from './services/session.guard';
import { commissionerGuard } from './services/commissioner.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login.component').then(m => m.LoginComponent),
  },
  {
    path: '',
    loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [sessionGuard],
  },
  {
    path: 'players',
    loadComponent: () => import('./players/players.component').then(m => m.PlayersComponent),
    canActivate: [sessionGuard],
  },
  {
    path: 'settings',
    loadComponent: () => import('./settings/settings.component').then(m => m.SettingsComponent),
    canActivate: [sessionGuard, commissionerGuard],
  }
];
