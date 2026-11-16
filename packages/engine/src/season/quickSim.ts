import type { MatchConfig } from '@outstanding/config';
import type { Rng } from '../rng';

/** Gol attesi delle due squadre dai rating dei club (comune a simulazione rapida e dettagliata). */
export function expectedGoals(
  homeRating: number,
  awayRating: number,
  cfg: MatchConfig['quickSim'],
): { home: number; away: number } {
  const diff = homeRating + cfg.homeAdvantage - awayRating;
  return {
    home: cfg.baseGoals * Math.exp(cfg.ratingScale * diff),
    away: cfg.baseGoals * Math.exp(-cfg.ratingScale * diff),
  };
}

/** Risultato rapido per le partite che non coinvolgono il giocatore. */
export function quickResult(
  homeRating: number,
  awayRating: number,
  rng: Rng,
  cfg: MatchConfig['quickSim'],
): { home: number; away: number } {
  const xg = expectedGoals(homeRating, awayRating, cfg);
  return { home: rng.poisson(xg.home), away: rng.poisson(xg.away) };
}
