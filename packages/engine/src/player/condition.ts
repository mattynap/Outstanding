import type { GameContext } from '../context';
import type { Rng } from '../rng';
import type { Player, Selection } from '../types';
import { clamp } from '../util';
import { applyGrowth, injure, injuryChance, rollInjury } from './progression';

const pct = (v: number) => clamp(v, 0, 100);
const toward = (v: number, target: number, rate: number) => v + (target - v) * rate;

/** Quello che conta di una partita per la condizione del giocatore. */
export interface MatchOutcome {
  selection: Selection;
  minutesPlayed: number;
  rating: number | null;
  result: 'win' | 'draw' | 'loss';
}

/**
 * Effetti di una partita sul giocatore: energia spesa, forma e morale dal voto e dal risultato,
 * fiducia dell'allenatore, esperienza (crescita) e possibile infortunio.
 */
export function applyMatchAftermath(
  player: Player,
  coachId: string | undefined,
  outcome: MatchOutcome,
  week: number,
  rng: Rng,
  ctx: GameContext,
): { player: Player; injured: boolean } {
  const c = ctx.config.progression.condition;
  const played = outcome.minutesPlayed > 0;
  const share =
    outcome.minutesPlayed / (ctx.config.match.blocks * ctx.config.match.minutesPerBlock);
  const ratingDiff = outcome.rating === null ? 0 : outcome.rating - ctx.config.match.rating.base;

  let p: Player = {
    ...player,
    condition: {
      ...player.condition,
      energy: pct(player.condition.energy - c.energyPer90 * share),
      form: pct(
        player.condition.form + (played ? ratingDiff * c.formPerRatingPoint : c.formNotPlaying),
      ),
      morale: pct(
        player.condition.morale +
          c.moraleBySelection[outcome.selection] +
          (played ? c.moraleByResult[outcome.result] + ratingDiff * c.moralePerRatingPoint : 0),
      ),
    },
  };
  if (coachId) {
    const trust = p.relationships[coachId] ?? 0;
    const delta = played ? ratingDiff * c.trustPerRatingPoint : c.trustNotSelected;
    p = { ...p, relationships: { ...p.relationships, [coachId]: clamp(trust + delta, -100, 100) } };
  }
  if (played) {
    p = applyGrowth(p, ctx.config.progression.growth.matchPer90 * share, week, ctx).player;
  }

  let injured = false;
  const chance = injuryChance(
    ctx.config.progression.injuries.matchChancePer90 * share,
    player,
    ctx,
  );
  if (played && rng.chance(chance)) {
    p = injure(p, rollInjury(rng, ctx), ctx);
    injured = true;
  }
  return { player: p, injured };
}

/**
 * Fine settimana: l'energia si recupera, forma, morale e rischio infortuni tornano piano verso i
 * valori di riferimento, l'infortunio in corso cala di una settimana.
 */
export function weeklyRecovery(player: Player, ctx: GameContext): Player {
  const c = ctx.config.progression.condition;
  const cond = player.condition;
  const lowEnergy = cond.energy < ctx.config.progression.growth.lowEnergyThreshold;
  const next: Player = {
    ...player,
    condition: {
      energy: pct(cond.energy + c.energyRecoveryPerWeek),
      form: pct(toward(cond.form, c.formTarget, c.formDriftPerWeek)),
      morale: pct(toward(cond.morale, c.moraleTarget, c.moraleDriftPerWeek)),
      injuryRisk: pct(
        toward(cond.injuryRisk, c.injuryRiskTarget, c.injuryRiskDriftPerWeek) +
          (lowEnergy ? c.lowEnergyInjuryRisk : 0),
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
