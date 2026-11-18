import type { MatchConfig } from '@outstanding/config';
import type { Rng } from '../rng';
import type { Side } from '../types';
import { clamp } from '../util';

type PressureConfig = MatchConfig['pressure'];

/**
 * Un passo della barra della pressione (−1..1, punto di vista del giocatore): inerzia che decade,
 * spinta strutturale, impulso esterno e rumore. Una sola estrazione di rng.
 */
export function stepPressure(
  p: number,
  push: number,
  impulse: number,
  rng: Rng,
  cfg: PressureConfig,
): number {
  return clamp(p * cfg.decay + push + impulse + cfg.noise * (rng.next() * 2 - 1), -1, 1);
}

/** Spinta per minuto di un lato: differenza di rating e campo di casa (nullo in campo neutro). */
export function pushFor(
  ratings: Record<Side, number>,
  side: Side,
  neutral: boolean,
  cfg: PressureConfig,
): number {
  const other: Side = side === 'home' ? 'away' : 'home';
  const home = side === 'home' && !neutral ? cfg.homePush : 0;
  const away = other === 'home' && !neutral ? cfg.homePush : 0;
  return cfg.ratingPush * (ratings[side] - ratings[other]) + home - away;
}

/**
 * Probabilità di gol in un minuto. La normalizzazione divide per la media attesa di
 * exp(goalBoost·p), stimata con p gaussiana di deviazione sigma, per non spostare i gol medi.
 */
export function goalChancePerMinute(
  xg: number,
  p: number,
  minutes: number,
  cfg: PressureConfig,
): number {
  const norm = Math.exp((cfg.goalBoost * cfg.goalBoost * cfg.sigma * cfg.sigma) / 2);
  return Math.min(1, ((xg / minutes) * Math.exp(cfg.goalBoost * p)) / norm);
}
