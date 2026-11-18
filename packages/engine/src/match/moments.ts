import type {
  MomentOptionConfig,
  MomentOutcomeConfig,
  MomentTypeConfig,
} from '@outstanding/config';
import type { GameContext } from '../context';
import type { Rng } from '../rng';
import type { MatchState, Player, Role } from '../types';
import { clamp } from '../util';

/** Opzione di un momento chiave come la vede l'interfaccia. */
export interface KeyMomentOption {
  id: string;
  textKey: string;
  /** Probabilità di successo (0–1), già comprensiva di forma, morale e tratti. */
  chance: number;
  /** Cosa può succedere se l'azione riesce. */
  onSuccess: Consequence;
  /** Cosa può succedere se l'azione non riesce. */
  onFailure: Consequence;
}

/** Conseguenza possibile di un'opzione, da mostrare prima della scelta. */
export type Consequence = 'goal' | 'assist' | 'teamGoal' | 'rating' | 'goalAgainst' | 'lost';

export const CONSEQUENCES: readonly Consequence[] = [
  'goal',
  'assist',
  'teamGoal',
  'rating',
  'goalAgainst',
  'lost',
];

/** Conseguenza dichiarata di un esito: il gol possibile se c'è, altrimenti solo il voto o il pallone perso. */
export function consequenceOf(outcome: MomentOutcomeConfig, success: boolean): Consequence {
  if (success) {
    if (outcome.goalFor !== undefined && outcome.goalFor > 0) {
      if (outcome.by === 'self') return 'goal';
      if (outcome.by === 'assist') return 'assist';
      return 'teamGoal';
    }
    return 'rating';
  }
  return outcome.goalAgainst !== undefined && outcome.goalAgainst > 0 ? 'goalAgainst' : 'lost';
}

/** Momento chiave da mostrare al giocatore. */
export interface KeyMoment {
  momentId: string;
  minute: number;
  textKey: string;
  /** Valori per i segnaposto del testo (es. `{opponent}`). */
  params: Record<string, string>;
  score: { home: number; away: number };
  options: KeyMomentOption[];
}

export function getMomentType(id: string, ctx: GameContext): MomentTypeConfig {
  const type = ctx.config.match.moments.types.find((t) => t.id === id);
  if (!type) throw new Error(`Unknown key moment "${id}"`);
  return type;
}

export type MomentPhase = MomentTypeConfig['phase'];

/** Fase del momento dal segno della pressione: 0 o più = attacco. */
export function phaseOf(pressure: number): MomentPhase {
  return pressure >= 0 ? 'attack' : 'defense';
}

const depthCache = new WeakMap<readonly MomentTypeConfig[], Map<string, number>>();

/** Passi massimi di una catena che parte da questo tipo (1 = nessun seguito), dalla config. */
export function chainDepth(typeId: string, ctx: GameContext): number {
  const types = ctx.config.match.moments.types;
  let cache = depthCache.get(types);
  if (!cache) {
    cache = new Map();
    depthCache.set(types, cache);
  }
  const known = cache.get(typeId);
  if (known !== undefined) return known;
  // La config è già validata senza cicli: la ricorsione termina.
  const type = getMomentType(typeId, ctx);
  const next = type.options.flatMap((o) =>
    [o.success.next?.momentId, o.failure.next?.momentId].filter((x): x is string => !!x),
  );
  const depth = 1 + Math.max(0, ...next.map((id) => chainDepth(id, ctx)));
  cache.set(typeId, depth);
  return depth;
}

/**
 * Sceglie il tipo della radice. Filtri in ordine: fase (con ripiego sull'altra), niente tipi
 * `chainOnly`, profondità entro `maxDepth`, niente ripetizione dell'ultimo tipo se c'è
 * un'alternativa; poi pesi di ruolo, penalità di ripetizione e affinità con gli stati `dyn`.
 * Null se nessun tipo entra nel budget.
 */
export function pickMomentType(
  role: Role,
  phase: MomentPhase,
  m: MatchState,
  maxDepth: number,
  rng: Rng,
  ctx: GameContext,
): MomentTypeConfig | null {
  const all = ctx.config.match.moments.types;
  const fits = (p: MomentPhase) =>
    all.filter(
      (t) =>
        t.phase === p &&
        !t.chainOnly &&
        (t.weights[role] ?? 0) > 0 &&
        chainDepth(t.id, ctx) <= maxDepth,
    );
  let pool = fits(phase);
  if (pool.length === 0) pool = fits(phase === 'attack' ? 'defense' : 'attack');
  if (pool.length === 0) return null;
  const recent = m.director.lastTypes.slice(-3);
  const last = recent.at(-1);
  if (pool.length > 1 && last !== undefined) {
    const rest = pool.filter((t) => t.id !== last);
    if (rest.length > 0) pool = rest;
  }
  const d = ctx.config.match.director;
  const weight = (t: MomentTypeConfig) => {
    let w = t.weights[role] ?? 0;
    if (recent.includes(t.id)) w *= d.repeatPenalty;
    if (t.affinity && m.dyn[t.affinity] >= 1) w *= 1 + d.dynAffinity;
    return w;
  };
  // Con repeatPenalty 0 e soli tipi recenti si torna ai pesi di ruolo.
  const anyPositive = pool.some((t) => weight(t) > 0);
  return rng.weighted(pool, anyPositive ? weight : (t) => t.weights[role] ?? 0);
}

/** Somma dei modificatori dei tratti per un'etichetta di momento (`match.all` + `match.tag.<tag>`). */
function traitBonus(player: Player, tag: string | undefined, ctx: GameContext): number {
  let bonus = 0;
  for (const id of player.traits) {
    const trait = ctx.content.traits.find((t) => t.id === id);
    for (const mod of trait?.modifiers ?? []) {
      if (mod.target === 'match.all' || (tag && mod.target === `match.tag.${tag}`)) {
        bonus += mod.value;
      }
    }
  }
  return bonus;
}

/**
 * Probabilità di successo: funzione logistica di (abilità pesata − forza avversaria − difficoltà),
 * più i modificatori di forma, morale, energia e tratti, limitata tra minChance e maxChance.
 */
export function optionChance(
  player: Player,
  option: MomentOptionConfig,
  opponentRating: number,
  ctx: GameContext,
  /** Bonus della difficoltà sulla probabilità (vedi `difficultyMods`). */
  difficultyBonus = 0,
  quality = 0.5,
): number {
  if (!Number.isFinite(quality) || quality < 0 || quality > 1) {
    throw new Error(`Invalid moment quality ${quality}`);
  }
  const cfg = ctx.config.match.moments;
  let total = 0;
  let weights = 0;
  for (const [skill, w] of Object.entries(option.skills)) {
    total += player.skills[skill as keyof Player['skills']] * w;
    weights += w;
  }
  const x = (total / weights - opponentRating - option.difficulty) / cfg.logisticScale;
  const { form, morale, energy } = player.condition;
  const mods =
    (cfg.formWeight * (form - 50)) / 50 +
    (cfg.moraleWeight * (morale - 50)) / 50 +
    (cfg.energyWeight * (energy - 50)) / 50 +
    traitBonus(player, option.tag, ctx) +
    difficultyBonus;
  return clamp(
    1 / (1 + Math.exp(-x)) + mods + (2 * quality - 1) * cfg.qualityMaxBonus,
    cfg.minChance,
    cfg.maxChance,
  );
}
