import { inject } from '@angular/core';
import { Router, type CanActivateFn, type Routes } from '@angular/router';
import { GameService } from './core/game.service';

/** Le schermate di gioco richiedono una carriera caricata. */
const needsGame: CanActivateFn = () =>
  inject(GameService).hasGame() || inject(Router).parseUrl('/');

/** A carriera finita resta solo la schermata di fine carriera. */
const notRetired: CanActivateFn = () =>
  !inject(GameService).state()?.retired || inject(Router).parseUrl('/fine');

const game = (path: string, load: Routes[number]['loadComponent']) => ({
  path,
  loadComponent: load,
  canActivate: [needsGame, notRetired],
});

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/start.page').then((m) => m.StartPage) },
  { path: 'crea', loadComponent: () => import('./pages/create.page').then((m) => m.CreatePage) },
  game('settimana', () => import('./pages/week.page').then((m) => m.WeekPage)),
  game('evento', () => import('./pages/event.page').then((m) => m.EventPage)),
  game('partita', () => import('./pages/match.page').then((m) => m.MatchPage)),
  game('stagione', () => import('./pages/season.page').then((m) => m.SeasonPage)),
  game('mercato', () => import('./pages/market.page').then((m) => m.MarketPage)),
  game('vita', () => import('./pages/life.page').then((m) => m.LifePage)),
  game('aspetto', () => import('./pages/look.page').then((m) => m.LookPage)),
  game('patrimonio', () => import('./pages/wealth.page').then((m) => m.WealthPage)),
  game('vita-privata', () => import('./pages/private.page').then((m) => m.PrivatePage)),
  game('social', () => import('./pages/social.page').then((m) => m.SocialPage)),
  game('conferenza', () => import('./pages/press.page').then((m) => m.PressPage)),
  {
    path: 'profilo',
    loadComponent: () => import('./pages/profile.page').then((m) => m.ProfilePage),
    canActivate: [needsGame],
  },
  {
    path: 'classifica',
    loadComponent: () => import('./pages/standings.page').then((m) => m.StandingsPage),
    canActivate: [needsGame],
  },
  {
    path: 'carriera',
    loadComponent: () => import('./pages/career.page').then((m) => m.CareerPage),
    canActivate: [needsGame],
  },
  {
    path: 'fine',
    loadComponent: () => import('./pages/end.page').then((m) => m.EndPage),
    canActivate: [needsGame],
  },
  {
    path: 'editor',
    loadComponent: () => import('./pages/editor.page').then((m) => m.EditorPage),
    canActivate: [needsGame],
  },
  {
    path: 'impostazioni',
    loadComponent: () => import('./pages/settings.page').then((m) => m.SettingsPage),
  },
  { path: '**', redirectTo: '' },
];
