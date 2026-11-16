import type { WeekActionConfig } from '@outstanding/config';
import { defaultContext, type GameContext } from '../context';
import { applyGrowth, injure, injuryChance, rollInjury } from '../player/progression';
import { SKILLS } from '../player/ratings';
import { Rng } from '../rng';
import type { GameState, Player, Skill, Skills } from '../types';
import { clamp } from '../util';
import { advanceWeek, isSeasonOver, playerFixture } from './week';

/** Azione della settimana come la vede l'interfaccia. */
export interface WeekOption {
  id: string;
  kind: WeekActionConfig['kind'];
  nameKey: string;
  descKey: string;
  /** Vero se l'azione richiede di scegliere un'abilità su cui concentrarsi. */
  needsFocus: boolean;
  available: boolean;
  /** Motivo per cui l'azione non è disponibile (chiave di testo). */
  reasonKey?: string;
}

export interface WeekChoice {
  actionId: string;
  focus?: Skill;
}

export interface WeekPlanReport {
  choices: WeekChoice[];
  /** Incrementi delle abilità dovuti agli allenamenti. */
  gains: Partial<Skills>;
  injury?: { type: string; weeksLeft: number };
  /** Vero se le cure hanno accorciato l'infortunio. */
  healed: boolean;
}

const isInjured = (p: Player) => Boolean(p.injury && p.injury.weeksLeft > 0);

function getAction(id: string, ctx: GameContext): WeekActionConfig {
  const action = ctx.config.progression.actions.find((a) => a.id === id);
  if (!action) throw new Error(`Unknown week action "${id}"`);
  return action;
}

/** Le azioni possibili questa settimana (gli allenamenti non sono disponibili da infortunati). */
export function getWeekOptions(state: GameState, ctx: GameContext = defaultContext): WeekOption[] {
  const injured = isInjured(state.player);
  const noSponsor = state.player.sponsors.length === 0;
  return ctx.config.progression.actions.map((a) => {
    const reasonKey =
      injured && a.kind === 'training'
        ? 'week.blocked.injured'
        : noSponsor && a.kind === 'sponsor'
          ? 'week.blocked.no_sponsor'
          : undefined;
    const blocked = reasonKey !== undefined;
    return {
      id: a.id,
      kind: a.kind,
      nameKey: `week.actions.${a.id}.name`,
      descKey: `week.actions.${a.id}.desc`,
      needsFocus: Boolean(a.focus),
      available: !blocked,
      ...(reasonKey ? { reasonKey } : {}),
    };
  });
}

function applyDeltas(player: Player, a: WeekActionConfig, ctx: GameContext): Player {
  const e = a.effects;
  // Il servizio fotografico paga qualche settimana extra di ogni sponsor.
  const bonus =
    a.kind === 'sponsor'
      ? player.sponsors.reduce((sum, d) => sum + d.weeklyIncome, 0) *
        ctx.config.economy.sponsors.shootBonusWeeks
      : 0;
  return {
    ...player,
    money: { ...player.money, cash: player.money.cash + bonus },
    image: {
      ...player.image,
      popularity: clamp(player.image.popularity + (e.popularity ?? 0), 0, 100),
    },
    condition: {
      ...player.condition,
      energy: clamp(player.condition.energy + (e.energy ?? 0), 0, 100),
      morale: clamp(player.condition.morale + (e.morale ?? 0), 0, 100),
      injuryRisk: clamp(player.condition.injuryRisk + (e.injuryRisk ?? 0), 0, 100),
    },
    persona: {
      ...player.persona,
      happiness: clamp(player.persona.happiness + (e.happiness ?? 0), 0, 100),
      discipline: clamp(player.persona.discipline + (e.discipline ?? 0), 0, 100),
    },
  };
}

/**
 * Applica le azioni scelte per la settimana (al massimo `actionsPerWeek`, senza ripetizioni):
 * allenamenti (crescita e rischio infortuni), riposo, cure, svago. Una sola volta per settimana.
 */
export function planWeek(
  state: GameState,
  choices: readonly WeekChoice[],
  ctx: GameContext = defaultContext,
): { state: GameState; report: WeekPlanReport } {
  const cfg = ctx.config.progression;
  if (state.retired) throw new Error('The career is over');
  if (state.plannedWeek === state.week) throw new Error('This week is already planned');
  if (choices.length > cfg.actionsPerWeek) throw new Error(`At most ${cfg.actionsPerWeek} actions`);
  if (new Set(choices.map((c) => c.actionId)).size !== choices.length) {
    throw new Error('The same action cannot be chosen twice');
  }
  const options = getWeekOptions(state, ctx);
  for (const c of choices) {
    const action = getAction(c.actionId, ctx);
    if (!options.find((o) => o.id === c.actionId)?.available) {
      throw new Error(`Action "${c.actionId}" is not available`);
    }
    if (Boolean(action.focus) !== (c.focus !== undefined)) {
      throw new Error(`Action "${c.actionId}" ${action.focus ? 'needs' : 'does not take'} a focus`);
    }
    if (c.focus !== undefined && !SKILLS.includes(c.focus)) {
      throw new Error(`Unknown skill "${c.focus}"`);
    }
  }

  const rng = Rng.fromState(state.rngState);
  let player = state.player;
  const gains: Partial<Skills> = {};
  let injury: WeekPlanReport['injury'];
  let healed = false;

  for (const c of choices) {
    const action = getAction(c.actionId, ctx);
    if (action.kind === 'training') {
      const grown = applyGrowth(player, action.intensity ?? 1, state.week, ctx, c.focus);
      player = grown.player;
      for (const [s, g] of Object.entries(grown.gains) as [Skill, number][]) {
        gains[s] = Math.round(((gains[s] ?? 0) + g) * 100) / 100;
      }
      if (action.injuryChance && rng.chance(injuryChance(action.injuryChance, player, ctx))) {
        injury = rollInjury(rng, ctx);
        player = injure(player, injury, ctx);
      }
    }
    if (action.healChance && player.injury && rng.chance(action.healChance)) {
      const weeksLeft = player.injury.weeksLeft - 1;
      if (weeksLeft > 0) player = { ...player, injury: { ...player.injury, weeksLeft } };
      else {
        const { injury: _healed, ...rest } = player;
        player = rest;
      }
      healed = true;
    }
    player = applyDeltas(player, action, ctx);
  }

  return {
    state: { ...state, player, plannedWeek: state.week, rngState: rng.getState() },
    report: { choices: [...choices], gains, ...(injury ? { injury } : {}), healed },
  };
}

/**
 * Salta le settimane senza partite (pausa estiva o invernale) applicando il piano automatico
 * `skipWeekPlan`; nelle settimane saltate non si estraggono eventi. Si ferma alla prima settimana
 * con una partita del giocatore o a fine stagione.
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
      const available = new Set(
        getWeekOptions(s, ctx)
          .filter((o) => o.available)
          .map((o) => o.id),
      );
      const plan = ctx.config.progression.skipWeekPlan
        .filter((id) => available.has(id))
        .map((actionId) => ({ actionId }));
      s = planWeek(s, plan, ctx).state;
    }
    s = advanceWeek(s, ctx).state;
    weeks++;
  }
  return { state: s, weeksSkipped: weeks };
}
