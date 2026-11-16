import type { ProgressionConfig } from '@outstanding/config';
import type { GameContext } from '../context';
import type { Rng } from '../rng';
import { ageAt } from '../time';
import type { Player, Skill, Skills } from '../types';
import { clamp } from '../util';
import { computeOvr, SKILLS } from './ratings';

/** Le abilità si salvano con due decimali: crescono poco alla volta ma restano leggibili. */
const round2 = (v: number) => Math.round(v * 100) / 100;

function band(bands: ProgressionConfig['growth']['ageMultipliers'], age: number): number {
  return (bands.find((b) => age <= b.maxAge) ?? bands[bands.length - 1]!).value;
}

/**
 * Moltiplicatore della crescita: età, distanza dal potenziale (lontano dal tetto si cresce più in
 * fretta, fino a `maxGapFactor`; vicino al tetto poco), disciplina ed energia.
 */
export function growthMultiplier(player: Player, week: number, ctx: GameContext): number {
  const g = ctx.config.progression.growth;
  const age = ageAt(player.birthWeek, week, ctx.config.calendar);
  const ovr = computeOvr(player.skills, player.role, ctx.config.ratings);
  const gap = clamp((player.potential - ovr) / g.potentialGapScale, 0, g.maxGapFactor);
  const d = g.disciplineFactor;
  const discipline = d.min + ((d.max - d.min) * player.persona.discipline) / 100;
  const energy = player.condition.energy < g.lowEnergyThreshold ? g.lowEnergyFactor : 1;
  return band(g.ageMultipliers, age) * gap * discipline * energy;
}

/**
 * Applica una crescita pari a `sessions` sessioni di allenamento. Senza `focus` crescono le abilità
 * del ruolo (di più quelle che pesano di più); con `focus` solo quella scelta, più in fretta.
 * Restituisce il giocatore aggiornato e gli incrementi per abilità.
 */
export function applyGrowth(
  player: Player,
  sessions: number,
  week: number,
  ctx: GameContext,
  focus?: Skill,
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
    let delta = 0;
    if (focus) delta = s === focus ? amount * g.focusMultiplier : 0;
    else if (weights[s] > 0)
      delta = amount * (g.minWeightShare + (1 - g.minWeightShare) * (weights[s] / maxW));
    if (delta <= 0) continue;
    const next = round2(Math.min(cap, skills[s] + delta));
    if (next > skills[s]) {
      gains[s] = round2(next - skills[s]);
      skills[s] = next;
    }
  }
  return { player: { ...player, skills }, gains };
}

/** Declino di fine stagione dopo l'età indicata; la disciplina lo attenua. */
export function applyDecline(player: Player, age: number, ctx: GameContext): Player {
  const d = ctx.config.progression.decline;
  if (age < d.startAge) return player;
  const base = d.basePerSeason + d.extraPerYear * (age - d.startAge);
  const mitigation = 1 - (d.disciplineMitigation * player.persona.discipline) / 100;
  const skills = { ...player.skills };
  for (const s of SKILLS) {
    skills[s] = round2(Math.max(1, skills[s] - base * d.skillMultipliers[s] * mitigation));
  }
  return { ...player, skills };
}

/** Estrae un infortunio dalla tabella in config. */
export function rollInjury(rng: Rng, ctx: GameContext): { type: string; weeksLeft: number } {
  const type = rng.weighted(ctx.config.progression.injuries.types, (t) => t.weight);
  return { type: type.id, weeksLeft: rng.int(type.weeks[0], type.weeks[1]) };
}

/** Probabilità di infortunio corretta per il rischio accumulato e l'energia. */
export function injuryChance(base: number, player: Player, ctx: GameContext): number {
  const inj = ctx.config.progression.injuries;
  const c = ctx.config.progression.condition;
  const risk = 1 + inj.riskPerPoint * (player.condition.injuryRisk - c.injuryRiskTarget);
  const tired =
    player.condition.energy < ctx.config.progression.growth.lowEnergyThreshold
      ? inj.lowEnergyMultiplier
      : 1;
  return clamp(base * Math.max(0, risk) * tired, 0, 1);
}

/** Applica un nuovo infortunio (se più lungo di quello in corso) con i suoi effetti su forma e morale. */
export function injure(
  player: Player,
  injury: { type: string; weeksLeft: number },
  ctx: GameContext,
): Player {
  if (player.injury && player.injury.weeksLeft >= injury.weeksLeft) return player;
  const inj = ctx.config.progression.injuries;
  return {
    ...player,
    injury,
    condition: {
      ...player.condition,
      form: clamp(player.condition.form + inj.formOnInjury, 0, 100),
      morale: clamp(player.condition.morale + inj.moraleOnInjury, 0, 100),
    },
  };
}
