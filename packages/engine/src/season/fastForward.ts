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
import { settleChapter, startChapterGoal } from './goals';
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
 * Chiude il capitolo corrente (obiettivo liquidato) e apre quello della settimana di `state`,
 * con scelte e obiettivo nuovi. Il registro del tratto passa al capitolo nuovo. Condiviso da
 * `advanceToStop` e `fastForward`.
 */
function openNextChapter(
  state: GameState,
  ctx: GameContext,
): { state: GameState; headline: Headline | null } {
  const out = settleChapter(state, ctx);
  const closed = out.state;
  const next = {
    ...createChapter(closed, ctx),
    lastGoalId: closed.chapter.goal?.id ?? closed.chapter.lastGoalId,
    stretch: closed.chapter.stretch,
  };
  return { state: startChapterGoal({ ...closed, chapter: next }, ctx), headline: out.headline };
}

/** Il piano del capitolo; se è vuoto, quello ricordato dall'ultima scelta (spec §8.2). */
const chapterPlanOf = (s: GameState): readonly WeekChoice[] | undefined =>
  s.chapterPlan.length > 0 ? s.chapterPlan : s.lastPlan;

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
    // Confine di capitolo: stessa transizione di `advanceToStop`, senza fermarsi.
    if (chapterOf(weekOfSeason(s.week, ctx.config.calendar), ctx.config.calendar) !== s.chapter.id)
      s = openNextChapter(s, ctx).state;
    s = { ...s, chapter: { ...s.chapter, picks: refreshChapterPicks(s, ctx) } };
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
      s = { ...planWeek(s, repeatPlan(s, ctx, chapterPlanOf(s)), ctx).state, lastPlan: s.lastPlan };
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
 * Avanti fino al prossimo stop: ripete il piano del capitolo, risolve da solo le notizie e
 * simula le partite non scelte. Si ferma (anche a zero settimane trascorse) per ritiro, fine
 * stagione, notizia personale, offerta che vale, cambio di capitolo e prima di ogni partita
 * scelta, in ordine di calendario. Il cambio di capitolo è all'inizio della settimana: precede
 * tutto il resto di quella settimana, pick compresa; si ritorna con il capitolo nuovo già creato
 * e la settimana intatta (nessuna partita simulata), così il chiamante ne imposta il piano.
 * Alla restituzione non c'è mai una partita aperta e la prossima partita da giocare è una scelta,
 * tranne agli stop `news`, `chapterEnd` e `offers` a inizio settimana (settimana intatta): lì una
 * non scelta può essere ancora dovuta e si simula alla chiamata successiva. Il tratto (`chapter.stretch`) si azzera. Con la carriera già finita
 * o la stagione già chiusa torna subito lo stop, a zero settimane.
 */
export function advanceToStop(
  state: GameState,
  ctx: GameContext = defaultContext,
): { state: GameState; report: FastForwardReport } {
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
  const newOffer = () =>
    report.weeks > 0 && s.offers.some((o) => !offersAtStart.has(o.id) && worthStopping(s, o));
  const isPick = (id: string) => s.chapter.picks.some((p) => p.fixtureId === id);

  // Esito dell'obiettivo liquidato in questo tratto: titolo in testa, nel limite dei titoli.
  let goalHeadline: Headline | null = null;
  const settle = () => {
    const out = settleChapter(s, ctx);
    s = out.state;
    goalHeadline = out.headline ?? goalHeadline;
  };

  const finish = (stop: FastForwardStop): { state: GameState; report: FastForwardReport } => {
    report.stop = stop;
    const news = buildHeadlines(s, s.chapter.stretch, zoneFrom, tableZone(s, ctx), ctx);
    report.headlines = (goalHeadline ? [goalHeadline, ...news] : news).slice(0, cal.headlines.max);
    s = { ...s, chapter: { ...s.chapter, stretch: emptyChapterLog() } };
    return { state: s, report };
  };

  for (;;) {
    if (s.retired) return finish('retired');
    if (isSeasonOver(s, ctx)) {
      // L'ultimo capitolo si chiude con la stagione: l'esito entra nei titoli di questo stop.
      settle();
      return finish('seasonEnd');
    }

    // Capitolo nuovo: il registro del tratto passa con lo stato, così i titoli lo leggono intero.
    if (chapterOf(weekOfSeason(s.week, cal), cal) !== s.chapter.id) {
      // Il confine è all'inizio della settimana: prima del piano, degli eventi e delle partite,
      // così la prima settimana del capitolo nuovo usa il piano scelto dopo questo stop. Un'offerta
      // arrivata con l'ultima settimana non si perde: si ferma prima, il cambio capitolo al giro dopo.
      if (newOffer()) return finish('offers');
      const opened = openNextChapter(s, ctx);
      s = opened.state;
      goalHeadline = opened.headline ?? goalHeadline;
      return finish('chapterEnd');
    }
    s = { ...s, chapter: { ...s.chapter, picks: refreshChapterPicks(s, ctx) } };

    if (s.plannedWeek !== s.week) {
      // Il piano del capitolo non sostituisce quello scelto a mano dal giocatore.
      const plan = repeatPlan(s, ctx, chapterPlanOf(s));
      s = { ...planWeek(s, plan, ctx).state, lastPlan: s.lastPlan };
    }
    s = drawWeekEvents(s, ctx).state;
    // Con una notizia personale da leggere una partita non scelta può essere ancora dovuta, ma
    // beginMatch rifiuta finché le notizie sono in sospeso: la si simula al giro dopo. Un'offerta
    // nuova ha la precedenza, altrimenti il giro dopo non la riconoscerebbe più come nuova.
    if (hasPersonalNews(s, ctx)) return finish(newOffer() ? 'offers' : 'news');
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

    if (newOffer()) return finish('offers');
    if (playerFixture(s)) return finish('pick');

    s = advanceWeek(s, ctx).state;
    report.weeks++;
  }
}
