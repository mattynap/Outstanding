import type { GameContext } from '../context';
import { clamp } from '../util';

/** Freschezza 0-100 (salvata in `condition.energy`): moltiplicatore della crescita, da `atZero` a 1. */
export function growthFreshnessFactor(freshness: number, ctx: GameContext): number {
  const atZero = ctx.config.progression.growth.freshnessFactor.atZero;
  return atZero + (1 - atZero) * (freshness / 100);
}

/** Moltiplicatore del rischio infortuni: continuo, da `at0` (stanco) a `at100` (fresco). */
export function injuryFreshnessFactor(freshness: number, ctx: GameContext): number {
  const { at0, at100 } = ctx.config.progression.injuries.freshnessCurve;
  return at0 + (at100 - at0) * (freshness / 100);
}

/** Punti di punteggio persi nella selezione per ogni punto di freschezza sotto la soglia. */
export function selectionFreshnessPenalty(freshness: number, ctx: GameContext): number {
  const s = ctx.config.match.selection;
  return Math.max(0, s.freshnessFrom - freshness) * s.freshnessWeight;
}

/** Modificatore sulla probabilità dei momenti chiave: neutro a 50, positivo sopra, negativo sotto. */
export function momentFreshnessModifier(freshness: number, ctx: GameContext): number {
  return (ctx.config.match.moments.freshnessWeight * (freshness - 50)) / 50;
}

/** Un solo clamp a fine settimana: il tetto vale anche se il delta netto è positivo. */
export function endOfWeekFreshness(f0: number, delta: number, cap: number): number {
  return clamp(f0 + delta, 0, cap);
}
