import { defaultContext, type GameContext } from '../context';
import { difficultyMods } from '../difficulty';
import type { PartyReport } from '../private/private';
import { SKILLS } from '../player/ratings';
import { Rng } from '../rng';
import type { EffectiveLoad, GameState, LifeAction, Load, Skills, WeekPlan } from '../types';
import { clamp } from '../util';
import { applyLifeWeek, LIFE_ACTIONS, lifeModifiers } from './life';
import { applyLoadWeek, effectiveLoad } from './load';
import { advanceWeek, isSeasonOver, playerFixture, playerFixtures } from './week';

export const LOADS: readonly Load[] = ['rest', 'balanced', 'push'];

/** Le scelte possibili questa settimana, come le vede l'interfaccia. */
export interface PlanOptions {
  loads: { id: Load; available: boolean }[];
  life: { id: LifeAction; available: boolean; reasonKey?: string }[];
  /** Da infortunato il carico scelto non conta: la settimana è di recupero. */
  forcedLoad?: 'recovery';
}

export interface WeekPlanReport {
  plan: WeekPlan;
  effectiveLoad: EffectiveLoad;
  /** Incrementi delle abilità dovuti alle sedute. */
  gains: Partial<Skills>;
  injury?: { type: string; weeksLeft: number };
  /** Vero se il recupero ha accorciato l'infortunio. */
  healed: boolean;
  /** Com'è andata la serata, se c'era nel piano. */
  party?: PartyReport;
  /** Soldi incassati dagli sponsor (già accreditati: solo da mostrare). */
  sponsorIncome?: number;
  /** Morale non perso grazie alla famiglia in questa fase della settimana. */
  moraleProtected: number;
  /** Azione fuori dal campo del piano non disponibile questa settimana, quindi saltata. */
  lifeSkipped?: LifeAction;
}

/** Carichi, azioni fuori dal campo e carico forzato di questa settimana. */
export function getPlanOptions(state: GameState, ctx: GameContext = defaultContext): PlanOptions {
  void ctx;
  const injured = Boolean(state.player.injury && state.player.injury.weeksLeft > 0);
  const noSponsor = state.player.sponsors.length === 0;
  return {
    loads: LOADS.map((id) => ({ id, available: !injured })),
    life: LIFE_ACTIONS.map((id) =>
      id === 'sponsor' && noSponsor
        ? { id, available: false, reasonKey: 'week.blocked.no_sponsor' }
        : { id, available: true },
    ),
    ...(injured ? { forcedLoad: 'recovery' as const } : {}),
  };
}

/** Controlla la forma del piano (id validi); la disponibilità della vita la decide il chiamante. */
export function assertWeekPlan(plan: WeekPlan): void {
  if (!LOADS.includes(plan.load)) throw new Error(`Unknown load "${String(plan.load)}"`);
  if (plan.focus !== undefined && !SKILLS.includes(plan.focus)) {
    throw new Error(`Unknown skill "${String(plan.focus)}"`);
  }
  if (plan.life !== undefined && !LIFE_ACTIONS.includes(plan.life)) {
    throw new Error(`Unknown life action "${String(plan.life)}"`);
  }
}

/** Vero se l'azione fuori dal campo si può fare adesso. */
export function lifeAvailable(state: GameState, life: LifeAction, ctx: GameContext): boolean {
  return getPlanOptions(state, ctx).life.find((l) => l.id === life)?.available ?? false;
}

/**
 * Applica il piano della settimana: sedute del carico (crescita e infortunio con la freschezza di
 * inizio settimana), poi l'azione fuori dal campo. La freschezza non si scrive: i delta vanno in
 * `weekInProgress` e li chiude `advanceWeek`. Un'azione non disponibile si salta e si segnala
 * (`lifeSkipped`), senza eccezione. Una sola volta per settimana.
 */
export function planWeek(
  state: GameState,
  plan: WeekPlan,
  ctx: GameContext = defaultContext,
): { state: GameState; report: WeekPlanReport } {
  if (state.retired) throw new Error('The career is over');
  if (state.plannedWeek === state.week) throw new Error('This week is already planned');
  assertWeekPlan(plan);

  const skipped = plan.life !== undefined && !lifeAvailable(state, plan.life, ctx);
  const life = skipped ? undefined : plan.life;
  const lifeMods = lifeModifiers(life, ctx);
  const rng = Rng.fromState(state.rngState);
  const eff = effectiveLoad(state.player, plan.load);

  const loadOut = applyLoadWeek(
    state.player,
    state.week,
    plan.load,
    plan.focus,
    rng,
    ctx,
    difficultyMods(state, ctx),
    lifeMods.moraleLossFactor,
  );
  // Quanto morale la famiglia ha salvato dal calo dell'infortunio in seduta.
  const moraleProtected = loadOut.injury
    ? Math.max(
        0,
        loadOut.player.condition.morale -
          clamp(
            state.player.condition.morale + ctx.config.progression.injuries.moraleOnInjury,
            0,
            100,
          ),
      )
    : 0;

  const hasMatch = playerFixtures(state).length > 0;
  const lifeOut = applyLifeWeek({ ...state, player: loadOut.player }, life, hasMatch, rng, ctx);
  const prev = state.weekInProgress;

  const next: GameState = {
    ...lifeOut.state,
    plannedWeek: state.week,
    rngState: rng.getState(),
    lastPlan: { ...plan },
    weekInProgress: {
      load: eff,
      ...(life ? { life } : {}),
      freshnessDelta: (prev?.freshnessDelta ?? 0) + loadOut.freshnessDelta + lifeOut.freshnessDelta,
    },
  };
  return {
    state: next,
    report: {
      plan: { ...plan },
      effectiveLoad: eff,
      gains: loadOut.gains,
      ...(loadOut.injury ? { injury: loadOut.injury } : {}),
      healed: loadOut.healed,
      ...(lifeOut.party ? { party: lifeOut.party } : {}),
      ...(lifeOut.sponsorIncome !== undefined ? { sponsorIncome: lifeOut.sponsorIncome } : {}),
      moraleProtected,
      ...(skipped ? { lifeSkipped: plan.life } : {}),
    },
  };
}

/**
 * Il piano da ripetere: quello del capitolo, altrimenti l'ultimo scelto, altrimenti il carico delle
 * settimane saltate. Mai filtri silenziosi: un'azione non più disponibile la salta `planWeek` e la
 * segnala nel report (`lifeSkipped`).
 */
export function repeatPlan(state: GameState, ctx: GameContext = defaultContext): WeekPlan {
  const plan = state.chapterPlan ?? state.lastPlan;
  return plan ? { ...plan } : { load: ctx.config.progression.skipWeekPlan.load };
}

/** La famiglia del piano attutisce anche il calo di morale dell'obiettivo mancato. */
export function chapterMoraleLossFactor(state: GameState, ctx: GameContext): number {
  return lifeModifiers(repeatPlan(state, ctx).life, ctx).moraleLossFactor;
}

/** Rimette il piano ricordato di prima: i piani automatici non lo sovrascrivono. */
export function keepLastPlan(planned: GameState, before: GameState): GameState {
  const { lastPlan: _auto, ...rest } = planned;
  return before.lastPlan ? { ...rest, lastPlan: before.lastPlan } : rest;
}

/**
 * Salta le settimane senza partite (pausa estiva o invernale) col carico `skipWeekPlan`; nelle
 * settimane saltate non si estraggono eventi. Si ferma alla prima settimana con una partita del
 * giocatore o a fine stagione.
 */
export function skipToNextMatch(
  state: GameState,
  ctx: GameContext = defaultContext,
): { state: GameState; weeksSkipped: number } {
  if (state.pendingEvents.length > 0) throw new Error('Resolve the pending events first');
  if (state.currentMatch) throw new Error('A match is in progress');
  let s = state;
  let weeks = 0;
  while (!isSeasonOver(s, ctx) && !playerFixture(s)) {
    if (s.plannedWeek !== s.week) {
      const plan: WeekPlan = { load: ctx.config.progression.skipWeekPlan.load };
      // Il piano automatico non sostituisce quello scelto dal giocatore.
      s = keepLastPlan(planWeek(s, plan, ctx).state, s);
    }
    s = advanceWeek(s, ctx).state;
    weeks++;
  }
  return { state: s, weeksSkipped: weeks };
}
