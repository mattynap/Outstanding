import type { EventEffect, GameEvent } from '@outstanding/content';
import { defaultContext, type GameContext } from '../context';
import { drawWeekEvents, getEvent, resolveEvent } from '../events/events';
import { simulateMatch } from '../match/match';
import { clubLevel } from '../market/offers';
import { bigMatchKind } from '../media/media';
import type { ContractOffer, GameState, Score } from '../types';
import { getWeekOptions, planWeek, type WeekChoice } from './plan';
import { advanceWeek, isSeasonOver, playerFixture } from './week';

/** Fin dove correre: alla prossima partita importante (o a fine stagione) o a fine stagione. */
export type FastForwardTarget = 'bigMatch' | 'seasonEnd';

/** Perché l'avanti veloce si è fermato. */
export type FastForwardStop = 'bigMatch' | 'seasonEnd' | 'offers' | 'news' | 'retired';

export interface FastForwardReport {
  weeks: number;
  stop: FastForwardStop;
  /** Partite del giocatore simulate: vinte, pareggiate, perse. */
  record: { win: number; draw: number; loss: number };
  /** Notizie decise in automatico. */
  events: number;
}

/**
 * Il piano da ripetere: quello della settimana scorsa, senza le azioni non disponibili e senza
 * serate (i rischi si scelgono di persona); se non resta nulla, il piano delle settimane saltate.
 */
export function repeatPlan(state: GameState, ctx: GameContext = defaultContext): WeekChoice[] {
  const options = getWeekOptions(state, ctx);
  const ok = (id: string) => {
    const o = options.find((x) => x.id === id);
    return Boolean(o?.available) && o?.kind !== 'party';
  };
  const last = (state.lastPlan ?? []).filter((c) => ok(c.actionId));
  if (last.length > 0) return last;
  return ctx.config.progression.skipWeekPlan.filter(ok).map((actionId) => ({ actionId }));
}

/** Valore "prudente" di un effetto: guadagni moderati, nessun salto nel buio. */
function effectScore(e: EventEffect, state: GameState): number {
  const salary = Math.max(100, state.player.contract?.salaryWeekly ?? 0);
  switch (e.type) {
    case 'stat':
      if (e.path === 'condition.injuryRisk') return -e.delta;
      if (e.path === 'image.followers') return e.delta / 500;
      if (e.path.startsWith('money.')) return (e.delta / salary) * 2;
      return e.delta;
    case 'money':
      return (e.delta / salary) * 2;
    case 'relationship':
      return e.delta * 0.5;
    case 'partner':
      return e.affinity * 0.5;
    case 'business':
      return e.health * 0.3;
    case 'injury':
      return -10;
    case 'breakup':
      return -20;
    case 'affair':
      return e.action === 'start' ? -15 : 2;
    case 'startTransfer':
      return -3;
    case 'trait':
      return e.action === 'add' ? 2 : -2;
    case 'meet':
      return 1;
    case 'chance':
      return (
        e.p * e.effects.reduce((s, x) => s + effectScore(x, state), 0) +
        (1 - e.p) * (e.otherwise ?? []).reduce((s, x) => s + effectScore(x, state), 0)
      );
    default:
      return 0;
  }
}

/** La scelta più prudente di una notizia (a parità vince la prima). */
export function prudentChoice(event: GameEvent, state: GameState): number {
  let best = 0;
  let bestScore = -Infinity;
  event.choices.forEach((c, i) => {
    const score = c.effects.reduce((s, e) => s + effectScore(e, state), 0);
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  });
  return best;
}

/** Vero se tra le notizie c'è un fatto della vita privata da vivere di persona. */
function hasPersonalNews(state: GameState, ctx: GameContext): boolean {
  return state.pendingEvents.some((p) => Boolean(getEvent(p.eventId, ctx).trigger));
}

/**
 * Un'offerta per cui vale la pena fermarsi: un rinnovo, una squadra di categoria più alta, o
 * qualsiasi offerta se il giocatore è senza squadra.
 */
function worthStopping(state: GameState, offer: ContractOffer): boolean {
  if (!state.player.clubId || offer.kind === 'renewal') return true;
  return clubLevel(state, offer.clubId) < clubLevel(state, state.player.clubId);
}

function resultOf(score: Score, home: boolean): 'win' | 'draw' | 'loss' {
  const mine = home ? score.home : score.away;
  const theirs = home ? score.away : score.home;
  return mine > theirs ? 'win' : mine < theirs ? 'loss' : 'draw';
}

/**
 * Avanti veloce: gioca le settimane da solo (piano ripetuto, notizie con la scelta più prudente,
 * partite simulate) e si ferma prima di una partita importante (se richiesto), a fine stagione,
 * quando arrivano offerte nuove, quando c'è una notizia personale o a fine carriera. La settimana
 * in corso viene sempre completata.
 */
export function fastForward(
  state: GameState,
  target: FastForwardTarget,
  ctx: GameContext = defaultContext,
): { state: GameState; report: FastForwardReport } {
  if (state.retired) throw new Error('The career is over');
  if (state.currentMatch) throw new Error('A match is in progress');
  let s = state;
  const report: FastForwardReport = {
    weeks: 0,
    stop: 'seasonEnd',
    record: { win: 0, draw: 0, loss: 0 },
    events: 0,
  };
  const offersAtStart = new Set(state.offers.map((o) => o.id));

  for (;;) {
    if (s.retired) {
      report.stop = 'retired';
      break;
    }
    if (isSeasonOver(s, ctx)) {
      report.stop = 'seasonEnd';
      break;
    }
    if (report.weeks > 0) {
      if (s.offers.some((o) => !offersAtStart.has(o.id) && worthStopping(s, o))) {
        report.stop = 'offers';
        break;
      }
      const f = playerFixture(s);
      if (target === 'bigMatch' && f && s.plannedWeek !== s.week && bigMatchKind(s, f, ctx)) {
        report.stop = 'bigMatch';
        break;
      }
    }

    if (s.plannedWeek !== s.week) {
      // Il piano automatico non sostituisce quello scelto dal giocatore.
      s = { ...planWeek(s, repeatPlan(s, ctx), ctx).state, lastPlan: s.lastPlan };
    }
    s = drawWeekEvents(s, ctx).state;
    if (report.weeks > 0 && hasPersonalNews(s, ctx)) {
      report.stop = 'news';
      break;
    }
    while (s.pendingEvents.length > 0) {
      const pe = s.pendingEvents[0]!;
      s = resolveEvent(s, pe.eventId, prudentChoice(getEvent(pe.eventId, ctx), s), ctx).state;
      report.events++;
    }
    for (let f = playerFixture(s); f; f = playerFixture(s)) {
      const home = f.homeId === s.player.clubId;
      const out = simulateMatch(s, ctx);
      s = out.state;
      report.record[resultOf(out.matchReport.score, home)]++;
    }
    s = advanceWeek(s, ctx).state;
    report.weeks++;
  }
  return { state: s, report };
}
