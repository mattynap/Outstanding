import type { ProgressionConfig } from '@outstanding/config';
import type { GameContext } from '../context';
import type { Rng } from '../rng';
import { ageAt } from '../time';
import type { EffectiveLoad, Load, Player, Skill, Skills } from '../types';
import { clamp } from '../util';
import { growthFreshnessFactor, injuryFreshnessFactor } from './freshness';
import { computeOvr, SKILLS } from './ratings';

function band(bands: ProgressionConfig['growth']['ageMultipliers'], age: number): number {
  return (bands.find((b) => age <= b.maxAge) ?? bands[bands.length - 1]!).value;
}

/**
 * Moltiplicatore della crescita: età, distanza dal potenziale (lontano dal tetto si cresce più in
 * fretta, fino a `maxGapFactor`; vicino al tetto poco), disciplina ed energia.
 */
export function growthMultiplier(player: Player, week: number, ctx: GameContext): number {
  const f = growthFactors(player, week, ctx);
  return f.age * f.gap * f.discipline * f.freshness;
}

/** I fattori del moltiplicatore di crescita, separati: l'anteprima ne ricava il motivo del ritmo. */
export function growthFactors(
  player: Player,
  week: number,
  ctx: GameContext,
): { age: number; gap: number; discipline: number; freshness: number } {
  const g = ctx.config.progression.growth;
  const age = ageAt(player.birthWeek, week, ctx.config.calendar);
  const ovr = computeOvr(player.skills, player.role, ctx.config.ratings);
  const d = g.disciplineFactor;
  return {
    age: band(g.ageMultipliers, age),
    gap: clamp((player.potential - ovr) / g.potentialGapScale, 0, g.maxGapFactor),
    discipline: d.min + ((d.max - d.min) * player.persona.discipline) / 100,
    freshness: growthFreshnessFactor(player.condition.energy, ctx),
  };
}

/**
 * Applica una crescita pari a `sessions` sessioni di allenamento sulle abilità del ruolo (di più
 * quelle che pesano di più). Restituisce il giocatore aggiornato e gli incrementi per abilità.
 */
export function applyGrowth(
  player: Player,
  sessions: number,
  week: number,
  ctx: GameContext,
): { player: Player; gains: Partial<Skills> } {
  const g = ctx.config.progression.growth;
  const amount = g.basePerSession * sessions * growthMultiplier(player, week, ctx);
  if (amount <= 0) return { player, gains: {} };
  const cap = Math.min(g.skillMax, player.potential + g.skillCapOverPotential);
  const weights = ctx.config.ratings.roleWeights[player.role];
  const maxW = Math.max(...SKILLS.map((s) => weights[s]));

  const skills = { ...player.skills };
  const gains: Partial<Skills> = {};
  for (const s of SKILLS) {
    if (weights[s] <= 0) continue;
    const delta = amount * (g.minWeightShare + (1 - g.minWeightShare) * (weights[s] / maxW));
    const next = Math.min(cap, skills[s] + delta);
    if (next > skills[s]) {
      gains[s] = next - skills[s];
      skills[s] = next;
    }
  }
  return { player: { ...player, skills }, gains };
}

/**
 * Crescita di una settimana col carico scelto. Punti totali T = basePerSession × sedute × moltiplicatore,
 * ripartiti sui pesi del ruolo. Con focus il totale scende a (1 − focusLoss) × T: `focusShare` va
 * sull'abilità scelta, il resto sui pesi del ruolo (compresa la stessa abilità).
 */
export function applyLoadGrowth(
  player: Player,
  week: number,
  load: Load,
  focus: Skill | undefined,
  ctx: GameContext,
  /** Moltiplicatore della difficoltà sulla crescita. */
  growthFactor = 1,
): { player: Player; gains: Partial<Skills> } {
  const g = ctx.config.progression.growth;
  const amount =
    g.basePerSession *
    ctx.config.progression.loads[load].sessions *
    growthMultiplier(player, week, ctx) *
    growthFactor;
  if (amount <= 0) return { player, gains: {} };
  const cap = Math.min(g.skillMax, player.potential + g.skillCapOverPotential);
  const weights = ctx.config.ratings.roleWeights[player.role];
  const maxW = Math.max(...SKILLS.map((s) => weights[s]));

  const raw: Partial<Skills> = {};
  let rawTotal = 0;
  for (const s of SKILLS) {
    if (weights[s] <= 0) continue;
    raw[s] = amount * (g.minWeightShare + (1 - g.minWeightShare) * (weights[s] / maxW));
    rawTotal += raw[s]!;
  }
  const total = focus ? (1 - g.focusLoss) * rawTotal : rawTotal;
  const restShare = focus ? 1 - g.focusShare : 1;

  const skills = { ...player.skills };
  const gains: Partial<Skills> = {};
  for (const s of SKILLS) {
    const roleShare = rawTotal > 0 ? (raw[s] ?? 0) / rawTotal : 0;
    const delta = total * restShare * roleShare + (s === focus ? total * g.focusShare : 0);
    if (delta <= 0) continue;
    const next = Math.min(cap, skills[s] + delta);
    if (next > skills[s]) {
      gains[s] = next - skills[s];
      skills[s] = next;
    }
  }
  return { player: { ...player, skills }, gains };
}

/**
 * Declino di fine stagione dopo l'età indicata; la disciplina lo attenua. Il fattore è la media dei
 * `loads.*.decline` pesata sulle settimane passate a ogni carico (nessuna settimana: 1).
 */
export function applyDecline(
  player: Player,
  age: number,
  loadWeeks: Record<EffectiveLoad, number>,
  ctx: GameContext,
): Player {
  const d = ctx.config.progression.decline;
  if (age < d.startAge) return player;
  const loads = ctx.config.progression.loads;
  const entries = Object.entries(loadWeeks) as [EffectiveLoad, number][];
  const weeks = entries.reduce((sum, [, n]) => sum + n, 0);
  const loadFactor =
    weeks > 0 ? entries.reduce((sum, [l, n]) => sum + n * loads[l].decline, 0) / weeks : 1;
  const base = (d.basePerSeason + d.extraPerYear * (age - d.startAge)) * loadFactor;
  const mitigation = 1 - (d.disciplineMitigation * player.persona.discipline) / 100;
  const skills = { ...player.skills };
  for (const s of SKILLS) {
    skills[s] = Math.max(1, skills[s] - base * d.skillMultipliers[s] * mitigation);
  }
  return { ...player, skills };
}

/** Estrae un infortunio dalla tabella in config. */
export function rollInjury(rng: Rng, ctx: GameContext): { type: string; weeksLeft: number } {
  const type = rng.weighted(ctx.config.progression.injuries.types, (t) => t.weight);
  return { type: type.id, weeksLeft: rng.int(type.weeks[0], type.weeks[1]) };
}

/** Probabilità di infortunio: la base scalata dalla freschezza (condition.energy). */
export function injuryChance(base: number, player: Player, ctx: GameContext): number {
  return clamp(base * injuryFreshnessFactor(player.condition.energy, ctx), 0, 1);
}

/** Applica un nuovo infortunio (se più lungo di quello in corso) con i suoi effetti su forma e morale. */
export function injure(
  player: Player,
  injury: { type: string; weeksLeft: number },
  ctx: GameContext,
  moraleLossFactor = 1,
): Player {
  if (player.injury && player.injury.weeksLeft >= injury.weeksLeft) return player;
  const inj = ctx.config.progression.injuries;
  return {
    ...player,
    injury,
    condition: {
      ...player.condition,
      form: clamp(player.condition.form + inj.formOnInjury, 0, 100),
      morale: clamp(player.condition.morale + inj.moraleOnInjury * moraleLossFactor, 0, 100),
    },
  };
}
