import type { GameContext } from '../context';
import { endOfWeekFreshness, injuryFreshnessFactor } from '../player/freshness';
import { applyLoadGrowth, injure, rollInjury } from '../player/progression';
import type { Rng } from '../rng';
import type { EffectiveLoad, GameState, LifeAction, Load, Player, Skill, Skills } from '../types';

/** Da infortunato il carico scelto non conta: la settimana è di recupero. */
export function effectiveLoad(player: Player, load: Load): EffectiveLoad {
  return player.injury ? 'recovery' : load;
}

export interface LoadWeekResult {
  player: Player;
  rng: Rng;
  gains: Partial<Skills>;
  injury?: { type: string; weeksLeft: number };
  healed: boolean;
  freshnessDelta: number;
}

/** Probabilità d'infortunio in seduta: la stessa per la settimana vera e per l'anteprima. */
export function sessionInjuryChance(
  player: Player,
  eff: EffectiveLoad,
  injuryMod: number,
  ctx: GameContext,
): number {
  const p =
    ctx.config.progression.loads[eff].sessionInjury *
    injuryMod *
    injuryFreshnessFactor(player.condition.energy, ctx);
  return Math.min(1, Math.max(0, p));
}

/** Crescita deterministica delle sedute: la stessa per la settimana vera e per l'anteprima. */
export function loadWeekGrowth(
  player: Player,
  week: number,
  eff: EffectiveLoad,
  focus: Skill | undefined,
  growthMod: number,
  ctx: GameContext,
): { player: Player; gains: Partial<Skills> } {
  if (eff === 'recovery') return { player, gains: {} };
  return applyLoadGrowth(player, week, eff, focus, ctx, growthMod);
}

/**
 * Parte del carico nella settimana: crescita, tiro d'infortunio in seduta, guarigione in recupero.
 * La freschezza non si tocca qui (F0 resta quella di inizio settimana per tutti i calcoli): si
 * restituisce solo il delta, che `closeWeekFreshness` applica una volta a fine settimana.
 * Il generatore è mutabile: lo si restituisce per comodità del chiamante.
 */
export function applyLoadWeek(
  player: Player,
  week: number,
  load: Load,
  focus: Skill | undefined,
  rng: Rng,
  ctx: GameContext,
  /** Modificatori della difficoltà: crescita e infortuni. */
  mods: { growth: number; injury: number } = { growth: 1, injury: 1 },
  /** La famiglia attutisce il calo di morale di un infortunio in seduta. */
  moraleLossFactor = 1,
): LoadWeekResult {
  const eff = effectiveLoad(player, load);
  const cfg = ctx.config.progression.loads[eff];
  const freshnessDelta = cfg.freshness;

  if (eff === 'recovery') {
    let next = player;
    let healed = false;
    const heal = ctx.config.progression.loads.recovery.healChance ?? 0;
    if (player.injury && rng.chance(heal)) {
      const weeksLeft = player.injury.weeksLeft - 1;
      if (weeksLeft > 0) next = { ...player, injury: { ...player.injury, weeksLeft } };
      else {
        const { injury: _healed, ...rest } = player;
        next = rest;
      }
      healed = true;
    }
    return { player: next, rng, gains: {}, healed, freshnessDelta };
  }

  const grown = loadWeekGrowth(player, week, eff, focus, mods.growth, ctx);
  let next = grown.player;
  let injury: { type: string; weeksLeft: number } | undefined;
  const p = sessionInjuryChance(player, eff, mods.injury, ctx);
  if (p > 0 && rng.chance(p)) {
    injury = rollInjury(rng, ctx);
    next = injure(next, injury, ctx, moraleLossFactor);
  }
  return { player: next, rng, gains: grown.gains, injury, healed: false, freshnessDelta };
}

/** Chiude la settimana: F0 + somma dei delta (carico, vita, partita, eventi), un solo clamp al tetto del carico. */
export function closeWeekFreshness(
  player: Player,
  deltas: number,
  load: EffectiveLoad,
  ctx: GameContext,
): Player {
  const cap = ctx.config.progression.loads[load].freshnessCap;
  return {
    ...player,
    condition: {
      ...player.condition,
      energy: endOfWeekFreshness(player.condition.energy, deltas, cap),
    },
  };
}

/** Variazione di forma nelle settimane in cui non si gioca. */
export function formWhenNotPlaying(load: EffectiveLoad, ctx: GameContext): number {
  return ctx.config.progression.loads[load].formNotPlaying;
}

/** Carico e vita della settimana in corso; senza piano vale il carico delle settimane saltate. */
export function currentWeekLoad(
  state: GameState,
  ctx: GameContext,
): { load: EffectiveLoad; life?: LifeAction } {
  const w = state.weekInProgress;
  const load = w?.load ?? effectiveLoad(state.player, ctx.config.progression.skipWeekPlan.load);
  return w?.life ? { load, life: w.life } : { load };
}

/** Accumula un delta di freschezza da chiudere a fine settimana. */
export function addWeekFreshness(state: GameState, delta: number): GameState {
  const w = state.weekInProgress ?? { freshnessDelta: 0 };
  return { ...state, weekInProgress: { ...w, freshnessDelta: w.freshnessDelta + delta } };
}
