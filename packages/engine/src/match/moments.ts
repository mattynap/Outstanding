import type {
  MatchConfig,
  MomentOptionConfig,
  MomentOutcomeConfig,
  MomentTypeConfig,
} from '@outstanding/config';
import type { GameContext } from '../context';
import type { Rng } from '../rng';
import type { MatchDyn, MatchState, Player, Role } from '../types';
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
  /** Cosa segue un fallimento: contropiede avversario, pallone perso con rischio gol, niente. */
  onFail: OnFail;
  /** Fascia mostrata della probabilità vera (`chanceBands`). */
  chanceBand: ChanceBand;
}

export type OnFail = 'counter' | 'lost' | 'none';
export type ChanceBand = 'low' | 'mid' | 'high';

/** Fascia della probabilità vera: sotto `low` bassa, da `high` in su alta, altrimenti discreta. */
export function chanceBandOf(chance: number, bands: MatchConfig['chanceBands']): ChanceBand {
  if (chance < bands.low) return 'low';
  return chance >= bands.high ? 'high' : 'mid';
}

/**
 * Cosa telegrafare in caso di fallimento: un seguito in fase difensiva è un contropiede, un gol
 * avversario possibile è un pallone perso pericoloso, altrimenti nessuna conseguenza in campo.
 */
export function onFailOf(option: MomentOptionConfig, ctx: GameContext): OnFail {
  const next = option.failure.next;
  if (next && getMomentType(next.momentId, ctx).phase === 'defense') return 'counter';
  return option.failure.goalAgainst !== undefined && option.failure.goalAgainst > 0
    ? 'lost'
    : 'none';
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
  /** Passo di una catena (dal secondo in poi): radice e numero del passo. */
  chain?: { rootId: string; step: number };
  /** Stati dinamici della partita al momento dell'apertura. */
  dyn: MatchDyn;
  /** Pressione −1..1 al momento dell'apertura. */
  pressure: number;
  options: KeyMomentOption[];
}

/** Stati dinamici a inizio partita. */
export const ZERO_DYN: Readonly<MatchDyn> = Object.freeze({
  coachTrust: 0,
  nerves: 0,
  fatigue: 0,
  marking: 0,
});

/**
 * Applica gli effetti di un esito: somma ai `dyn` (entro `dyn.min`/`dyn.max`) e alla pressione
 * (entro ±1, come `stepPressure`). Non estrae nulla dal generatore.
 */
export function applyEffects(
  m: MatchState,
  effects: Partial<Record<keyof MatchDyn | 'pressure', number>> | undefined,
  cfg: MatchConfig,
): MatchState {
  if (!effects) return m;
  const dyn = { ...m.dyn };
  for (const k of Object.keys(dyn) as (keyof MatchDyn)[]) {
    const d = effects[k];
    if (d) dyn[k] = clamp(dyn[k] + d, cfg.dyn.min, cfg.dyn.max);
  }
  const pressure = clamp(m.pressure + (effects.pressure ?? 0), -1, 1);
  return { ...m, dyn, pressure };
}

export function getMomentType(id: string, ctx: GameContext): MomentTypeConfig {
  const type = ctx.config.match.moments.types.find((t) => t.id === id);
  if (!type) throw new Error(`Unknown key moment "${id}"`);
  return type;
}

export type MomentPhase = MomentTypeConfig['phase'];

/**
 * Probabilità che la radice sia in fase d'attacco: inclinazione del ruolo più la pressione,
 * limitata a [phaseMin, 1 − phaseMin] perché nessuna fase sparisca del tutto.
 */
export function attackShare(role: Role, pressure: number, ctx: GameContext): number {
  const d = ctx.config.match.director;
  return clamp(d.phaseBias[role] + d.phaseTilt * pressure, d.phaseMin, 1 - d.phaseMin);
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
 * Sceglie il tipo della radice con una sola estrazione. Filtri: niente tipi `chainOnly`,
 * profondità entro `maxDepth`, niente ripetizione dell'ultimo tipo se c'è un'alternativa. Ogni
 * candidato pesa P(sua fase) · peso / somma dei pesi della sua fase (pesi di ruolo, penalità di
 * ripetizione, affinità con `dyn`); una fase senza candidati cede tutta la massa all'altra.
 * Null se nessun tipo entra nel budget.
 */
export function pickMomentType(
  role: Role,
  m: MatchState,
  maxDepth: number,
  rng: Rng,
  ctx: GameContext,
): MomentTypeConfig | null {
  let pool = ctx.config.match.moments.types.filter(
    (t) => !t.chainOnly && (t.weights[role] ?? 0) > 0 && chainDepth(t.id, ctx) <= maxDepth,
  );
  if (pool.length === 0) return null;
  const recent = m.director.lastTypes.slice(-3);
  const last = recent.at(-1);
  if (pool.length > 1 && last !== undefined) {
    const rest = pool.filter((t) => t.id !== last);
    if (rest.length > 0) pool = rest;
  }
  const d = ctx.config.match.director;
  const adjusted = (t: MomentTypeConfig) => {
    let w = t.weights[role] ?? 0;
    if (recent.includes(t.id)) w *= d.repeatPenalty;
    if (t.affinity && m.dyn[t.affinity] >= 1) w *= 1 + d.dynAffinity;
    return w;
  };
  const share = attackShare(role, m.pressure, ctx);
  const phaseWeight = new Map<MomentTypeConfig, number>();
  const phases: MomentPhase[] = ['attack', 'defense'];
  const groups = phases.map((p) => pool.filter((t) => t.phase === p));
  groups.forEach((group, i) => {
    if (group.length === 0) return;
    // Con repeatPenalty 0 e soli tipi recenti la fase torna ai pesi di ruolo.
    const raw = group.some((t) => adjusted(t) > 0)
      ? adjusted
      : (t: MomentTypeConfig) => t.weights[role] ?? 0;
    const sum = group.reduce((acc, t) => acc + raw(t), 0);
    const other = groups[1 - i]!.length > 0;
    const mass = other ? (phases[i] === 'attack' ? share : 1 - share) : 1;
    for (const t of group) phaseWeight.set(t, (mass * raw(t)) / sum);
  });
  return rng.weighted(pool, (t) => phaseWeight.get(t) ?? 0);
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

function dynBonus(dyn: MatchDyn, w: MatchConfig['dyn']['chanceWeight']): number {
  return (Object.keys(w) as (keyof MatchDyn)[]).reduce((acc, k) => acc + w[k] * dyn[k], 0);
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
  /** Stati dinamici della partita: ognuno sposta la probabilità col suo peso. */
  dyn: MatchDyn = ZERO_DYN,
): number {
  if (!Number.isFinite(quality) || quality < 0 || quality > 1) {
    throw new Error(`Invalid moment quality ${quality}`);
  }
  const matchCfg = ctx.config.match;
  const cfg = matchCfg.moments;
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
    difficultyBonus +
    dynBonus(dyn, matchCfg.dyn.chanceWeight);
  return clamp(
    1 / (1 + Math.exp(-x)) + mods + (2 * quality - 1) * cfg.qualityMaxBonus,
    cfg.minChance,
    cfg.maxChance,
  );
}
