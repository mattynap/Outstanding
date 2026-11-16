import type { MatchConfig } from '@outstanding/config';
import type { Rng } from '../rng';

/** Expected goals of both sides from club ratings (shared by quick and detailed simulation). */
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

/** Fast result for matches that do not involve the human player. */
export function quickResult(
  homeRating: number,
  awayRating: number,
  rng: Rng,
  cfg: MatchConfig['quickSim'],
): { home: number; away: number } {
  const xg = expectedGoals(homeRating, awayRating, cfg);
  return { home: rng.poisson(xg.home), away: rng.poisson(xg.away) };
}
