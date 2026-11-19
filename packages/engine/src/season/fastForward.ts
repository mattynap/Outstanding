import type { EventEffect, GameEvent } from '@outstanding/content';
import { defaultContext, type GameContext } from '../context';
import { drawWeekEvents, getEvent, resolveEvent } from '../events/events';
import { simulateMatch, type MatchReport } from '../match/match';
import { clubLevel } from '../market/offers';
import { bigMatchKind } from '../media/media';
import type { ContractOffer, GameState, Score } from '../types';
import { weekOfSeason } from '../time';
import { chapterOf, createChapter, emptyChapterLog, refreshChapterPicks } from './director';
import { buildHeadlines, tableZone, type Headline } from './headlines';
import { getWeekOptions, planWeek, type WeekChoice } from './plan';
import { advanceWeek, isSeasonOver, playerFixture } from './week';

export type { Headline, HeadlineKind } from './headlines';

/** Fin dove correre: alla prossima partita importante (o a fine stagione) o a fine stagione. */
export type FastForwardTarget = 'bigMatch' | 'seasonEnd';

/** Perché l'avanti veloce si è fermato. */
export type FastForwardStop =
  'bigMatch' | 'seasonEnd' | 'offers' | 'news' | 'retired' | 'pick' | 'chapterEnd';

/** Una partita simulata del giocatore, per il riepilogo. */
export interface MatchSummary {
  fixtureId: string;
  result: 'win' | 'draw' | 'loss';
  rating: number | null;
}

export interface FastForwardReport {
  weeks: number;
  stop: FastForwardStop;
  /** Partite del giocatore simulate: vinte, pareggiate, perse. */
  record: { win: number; draw: number; loss: number };
  /** Notizie decise in automatico. */
  events: number;
  /** Le partite del giocatore simulate durante l'avanzamento, con il voto. */
  summary: MatchSummary[];
  /** Titoli di prima pagina del tratto (solo `advanceToStop`; vuoti in `fastForward`). */
  headlines: Headline[];
}

/**
 * Il piano da ripetere: quello della settimana scorsa, senza le azioni non disponibili e senza
 * serate (i rischi si scelgono di persona); se non resta nulla, il piano delle settimane saltate.
 */
export function repeatPlan(
  state: GameState,
  ctx: GameContext = defaultContext,
  remembered: readonly WeekChoice[] | undefined = state.lastPlan,
): WeekChoice[] {
  const options = getWeekOptions(state, ctx);
  const ok = (id: string) => {
    const o = options.find((x) => x.id === id);
    return Boolean(o?.available) && o?.kind !== 'party';
  };
  const last = (remembered ?? []).filter((c) => ok(c.actionId));
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

function summaryOf(r: MatchReport): MatchSummary {
  return { fixtureId: r.fixtureId, result: r.result, rating: r.rating };
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
    summary: [],
    headlines: [],
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
      report.summary.push(summaryOf(out.matchReport));
    }
    s = advanceWeek(s, ctx).state;
    report.weeks++;
  }
  return { state: s, report };
}

/** Imposta il piano del capitolo: le settimane simulate lo ripetono (con le regole di `repeatPlan`). */
export function setChapterPlan(
  state: GameState,
  choices: WeekChoice[],
  ctx: GameContext = defaultContext,
): GameState {
  const known = new Set(getWeekOptions(state, ctx).map((o) => o.id));
  for (const c of choices)
    if (!known.has(c.actionId)) throw new Error(`Unknown action "${c.actionId}"`);
  return { ...state, chapterPlan: choices.map((c) => ({ ...c })) };
}

/**
 * Punto d'ingresso della chiusura di un capitolo: qui B4 liquiderà l'obiettivo, prima che il
 * capitolo successivo prenda il posto di quello che si chiude.
 */
function onChapterClose(state: GameState): GameState {
  return state;
}

/**
 * Avanti fino al prossimo stop: ripete il piano del capitolo, risolve da solo le notizie e
 * simula le partite non scelte. Si ferma (anche a zero settimane trascorse) per ritiro, fine
 * stagione, notizia personale, offerta che vale, cambio di capitolo (il nuovo capitolo è già
 * creato: il chiamante imposta il suo piano) e prima di ogni partita scelta, in ordine di
 * calendario. Alla restituzione non c'è mai una partita aperta e, senza notizie in sospeso, la
 * prossima partita da giocare è sempre una scelta. Il tratto (`chapter.stretch`) si azzera.
 * Il cambio di capitolo precede la partita scelta della stessa settimana: il capitolo nuovo
 * nasce all'inizio della sua prima settimana, che si gioca col piano del capitolo precedente.
 */
export function advanceToStop(
  state: GameState,
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
    summary: [],
    headlines: [],
  };
  const offersAtStart = new Set(state.offers.map((o) => o.id));
  const zoneFrom = tableZone(state, ctx);
  const cal = ctx.config.calendar;
  const isPick = (id: string) => s.chapter.picks.some((p) => p.fixtureId === id);

  const finish = (stop: FastForwardStop): { state: GameState; report: FastForwardReport } => {
    report.stop = stop;
    report.headlines = buildHeadlines(s, s.chapter.stretch, zoneFrom, tableZone(s, ctx), ctx);
    s = { ...s, chapter: { ...s.chapter, stretch: emptyChapterLog() } };
    return { state: s, report };
  };

  for (;;) {
    if (s.retired) return finish('retired');
    if (isSeasonOver(s, ctx)) return finish('seasonEnd');

    // Capitolo nuovo: il registro del tratto passa con lo stato, così i titoli lo leggono intero.
    let boundary = false;
    if (chapterOf(weekOfSeason(s.week, cal), cal) !== s.chapter.id) {
      const closed = onChapterClose(s);
      s = {
        ...closed,
        chapter: { ...createChapter(closed, ctx), stretch: closed.chapter.stretch },
      };
      boundary = true;
    } else {
      s = { ...s, chapter: { ...s.chapter, picks: refreshChapterPicks(s, ctx) } };
    }

    if (s.plannedWeek !== s.week) {
      // Il piano del capitolo non sostituisce quello scelto a mano dal giocatore.
      const plan = repeatPlan(s, ctx, s.chapterPlan);
      s = { ...planWeek(s, plan, ctx).state, lastPlan: s.lastPlan };
    }
    s = drawWeekEvents(s, ctx).state;
    if (hasPersonalNews(s, ctx)) return finish('news');
    while (s.pendingEvents.length > 0) {
      const pe = s.pendingEvents[0]!;
      s = resolveEvent(s, pe.eventId, prudentChoice(getEvent(pe.eventId, ctx), s), ctx).state;
      report.events++;
    }
    // Le partite non scelte si simulano, in ordine di calendario, fino alla prima scelta.
    for (let f = playerFixture(s); f && !isPick(f.id); f = playerFixture(s)) {
      const out = simulateMatch(s, ctx);
      s = out.state;
      report.record[resultOf(out.matchReport.score, f.homeId === s.player.clubId)]++;
      report.summary.push(summaryOf(out.matchReport));
    }

    if (report.weeks > 0 && s.offers.some((o) => !offersAtStart.has(o.id) && worthStopping(s, o))) {
      return finish('offers');
    }
    if (boundary) return finish('chapterEnd');
    if (playerFixture(s)) return finish('pick');

    s = advanceWeek(s, ctx).state;
    report.weeks++;
  }
}
