import type { DifficultyLevel } from '@outstanding/config';
import type { GameContext } from '../context';
import type { Rng } from '../rng';
import type { EffectiveLoad, Player, Selection } from '../types';
import { clamp } from '../util';
import type { LifeModifiers } from '../season/life';
import { formWhenNotPlaying } from '../season/load';
import { applyGrowth, injure, injuryChance, rollInjury } from './progression';

const pct = (v: number) => clamp(v, 0, 100);
/** Solo i delta negativi sono scalati: la famiglia attutisce i cali, non i rialzi. */
const scaleLoss = (delta: number, factor: number) => (delta < 0 ? delta * factor : delta);
export const toward = (v: number, target: number, rate: number) => v + (target - v) * rate;

/** Quello che conta di una partita per la condizione del giocatore. */
export interface MatchOutcome {
  selection: Selection;
  minutesPlayed: number;
  rating: number | null;
  result: 'win' | 'draw' | 'loss';
}

/**
 * Effetti di una partita sul giocatore: forma e morale dal voto e dal risultato, fiducia
 * dell'allenatore, esperienza (crescita) e possibile infortunio. La freschezza spesa non si scrive
 * qui: torna come `freshnessDelta` e la somma `advanceWeek` a fine settimana.
 */
export function applyMatchAftermath(
  player: Player,
  coachId: string | undefined,
  outcome: MatchOutcome,
  week: number,
  rng: Rng,
  ctx: GameContext,
  /** Modificatori della difficoltà: solo crescita e infortuni. */
  mods: Pick<DifficultyLevel, 'growth' | 'injury'> = { growth: 1, injury: 1 },
  /** Azione fuori dal campo del capitolo: scala solo i cali di morale. */
  lifeMods: Pick<LifeModifiers, 'moraleLossFactor'> = { moraleLossFactor: 1 },
  /** Carico della settimana: decide la forma quando non si gioca. */
  load: EffectiveLoad = 'balanced',
): { player: Player; injured: boolean; freshnessDelta: number } {
  const c = ctx.config.progression.condition;
  const played = outcome.minutesPlayed > 0;
  const share =
    outcome.minutesPlayed / (ctx.config.match.blocks * ctx.config.match.minutesPerBlock);
  const ratingDiff = outcome.rating === null ? 0 : outcome.rating - ctx.config.match.rating.base;

  let p: Player = {
    ...player,
    condition: {
      ...player.condition,
      form: pct(
        player.condition.form +
          (played ? ratingDiff * c.formPerRatingPoint : formWhenNotPlaying(load, ctx)),
      ),
      morale: pct(
        player.condition.morale +
          scaleLoss(
            c.moraleBySelection[outcome.selection] +
              (played ? c.moraleByResult[outcome.result] + ratingDiff * c.moralePerRatingPoint : 0),
            lifeMods.moraleLossFactor,
          ),
      ),
    },
  };
  if (coachId) {
    const trust = p.relationships[coachId] ?? 0;
    const delta = played ? ratingDiff * c.trustPerRatingPoint : c.trustNotSelected;
    p = { ...p, relationships: { ...p.relationships, [coachId]: clamp(trust + delta, -100, 100) } };
  }
  if (played) {
    p = applyGrowth(
      p,
      ctx.config.progression.growth.matchPer90 * share * mods.growth,
      week,
      ctx,
    ).player;
  }

  let injured = false;
  const chance = injuryChance(
    ctx.config.progression.injuries.matchChancePer90 * share * mods.injury,
    player,
    ctx,
  );
  if (played && rng.chance(chance)) {
    p = injure(p, rollInjury(rng, ctx), ctx, lifeMods.moraleLossFactor);
    injured = true;
  }
  return { player: p, injured, freshnessDelta: -c.freshnessPer90 * share };
}

/**
 * Fine settimana: forma e morale tornano piano verso i valori di riferimento, l'infortunio in
 * corso cala di una settimana. La freschezza la chiude `closeWeekFreshness`.
 */
export function weeklyDrift(
  player: Player,
  ctx: GameContext,
  lifeMods: Pick<LifeModifiers, 'moraleRecoveryFactor'>,
): Player {
  const c = ctx.config.progression.condition;
  const cond = player.condition;
  const next: Player = {
    ...player,
    condition: {
      ...cond,
      form: pct(toward(cond.form, c.formTarget, c.formDriftPerWeek)),
      morale: pct(
        toward(
          cond.morale,
          c.moraleTarget,
          // Il fattore di recupero vale solo sotto il riferimento.
          c.moraleDriftPerWeek * (cond.morale < c.moraleTarget ? lifeMods.moraleRecoveryFactor : 1),
        ),
      ),
    },
  };
  const injury = next.injury;
  if (!injury) return next;
  if (injury.weeksLeft > 1)
    return { ...next, injury: { ...injury, weeksLeft: injury.weeksLeft - 1 } };
  const { injury: _healed, ...healed } = next;
  return healed;
}
