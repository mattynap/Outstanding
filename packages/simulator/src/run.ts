import type { SimulatorConfig } from '@outstanding/config';
import { chapterGoalOutcomeKey } from '@outstanding/content';
import {
  acceptOffer,
  acceptSponsor,
  advanceToStop,
  advanceWeek,
  careerScore,
  careerTotals,
  defaultContext,
  drawWeekEvents,
  endSeason,
  getAgentCandidates,
  getPendingEvents,
  getOffers,
  hireAgent,
  isLegend,
  isSeasonOver,
  newCareer,
  type Difficulty,
  planWeek,
  playerFixture,
  playMatch,
  resolveEvent,
  ROLES,
  setChapterPlan,
  Rng,
  simulateMatch,
  type CareerScore,
  type CareerTotals,
  type GameContext,
  type GameState,
  type NewCareerOptions,
  type Retirement,
  type Role,
} from '@outstanding/engine';
import { getStrategy, type Strategy, type StrategyId, type StrategyOptions } from './strategies';

/**
 * Stima del tempo di gioco: secondi per decisione da `config/data/simulator.json > secondsPer`
 * (ipotesi del simulatore, non parametri del gioco), da confrontare con 20–30 minuti a stagione
 * e 6–8 ore a carriera. I passi di catena (dal secondo in poi) costano meno delle radici.
 */
export function estimateSeconds(d: Decisions, sp: SimulatorConfig['secondsPer']): number {
  return (
    d.weeks * sp.week +
    d.events * sp.event +
    d.moments * sp.momentStep +
    d.chainSteps * sp.chainStep +
    d.matches * sp.fullMatch +
    d.quickMatches * sp.quickMatch +
    d.simulatedMatches * sp.simulatedMatch +
    d.offers * sp.offer
  );
}

/** Limite di sicurezza: nessuna carriera dura più di così (il ritiro arriva al più tardi a 40 anni). */
const MAX_SEASONS = 40;

export interface Decisions {
  weeks: number;
  events: number;
  /** Passi radice (il primo di ogni catena). */
  moments: number;
  /** Passi di catena dopo il primo. */
  chainSteps: number;
  /** Passi risolti in automatico nelle partite giocate di persona (non contano nel tempo). */
  autoSteps: number;
  /** Partite giocate di persona in modalità completa e rapida; partite simulate. */
  matches: number;
  quickMatches: number;
  simulatedMatches: number;
  offers: number;
}

export interface CareerResult {
  seed: number;
  strategy: StrategyId;
  role: Role;
  potential: number;
  retirement: Retirement;
  totals: CareerTotals;
  score: CareerScore;
  legend: boolean;
  /** Massimo OVR raggiunto a fine stagione. */
  peakOvr: number;
  /** Livello più alto (numero più basso) in cui ha giocato almeno una partita. */
  bestLevel: number | null;
  decisions: Decisions;
  /** Minuti di gioco stimati. */
  playMinutes: number;
  /** Secondi stimati per stagione (solo ciclo a capitoli): la base di minuti a stagione e ore a carriera. */
  seasonSeconds?: number[];
  /** Capitoli giocati, stop per notizie e offerte, partite scelte (solo ciclo a capitoli). */
  chapterStats?: ChapterStats;
}

export interface ChapterStats {
  chapters: number;
  newsStops: number;
  offerStops: number;
  picks: number;
  /** Obiettivi dei capitoli liquidati, per metrica: raggiunti e totali. */
  goals: Record<string, { met: number; total: number }>;
}

/** Opzioni di creazione casuali ma riproducibili dal seme della carriera. */
export function randomCareerOptions(rng: Rng, ctx: GameContext): NewCareerOptions {
  const traits = ctx.content.traits.filter((t) => t.selectableAtCreation);
  const role = rng.pick(ROLES);
  const allowed = traits.filter((t) => !t.roles || t.roles.includes(role));
  const count = rng.int(0, Math.min(ctx.config.player.maxTraitsAtCreation, allowed.length));
  return {
    firstName: rng.pick(ctx.content.names.firstNames),
    lastName: rng.pick(ctx.content.names.lastNames),
    hometown: rng.pick(ctx.content.cities).name,
    role,
    traits: rng
      .shuffle(allowed)
      .slice(0, count)
      .map((t) => t.id),
  };
}

/** Firma sponsor e procuratore migliore disponibili: tutte le strategie lo fanno. */
function manageLife(state: GameState, ctx: GameContext): GameState {
  let s = state;
  for (const offer of s.sponsorOffers) {
    if (s.player.sponsors.length >= ctx.config.economy.sponsors.max) break;
    s = acceptSponsor(s, offer.id, ctx);
  }
  const best = getAgentCandidates(s, ctx)[0];
  const current = s.world.npcs.find((n) => n.id === s.player.agentId);
  if (best && (best.quality ?? 0) > (current?.quality ?? 0)) s = hireAgent(s, best.id, ctx);
  return s;
}

interface LoopInput {
  s: GameState;
  d: Decisions;
  strategy: Strategy;
  mode: 'full' | 'quick';
  rng: Rng;
  momentRng: Rng;
  ctx: GameContext;
}

interface LoopOutput {
  state: GameState;
  peakOvr: number;
  seasonSeconds?: number[];
  chapterStats?: ChapterStats;
}

/** Ciclo a settimane (quello di prima dei capitoli): resta com'è per il confronto con la Parte A. */
function playWeeks(input: LoopInput): LoopOutput {
  const { d, strategy, mode, rng, momentRng, ctx } = input;
  let s = input.s;
  let peakOvr = 0;
  let seasons = 0;

  while (!s.retired) {
    if (isSeasonOver(s, ctx)) {
      if (++seasons > MAX_SEASONS) throw new Error(`Career ${input.s.seed} did not end`);
      s = endSeason(s, ctx).state;
      peakOvr = Math.max(peakOvr, s.player.history.at(-1)!.ovr);
      continue;
    }
    s = manageLife(s, ctx);
    const offers = getOffers(s);
    if (offers.length > 0) {
      const pick = strategy.pickOffer(s, offers, rng, ctx);
      if (pick) {
        try {
          s = acceptOffer(s, pick.id, ctx);
          d.offers++;
        } catch {
          // Offerta non firmabile adesso (es. finestra chiusa): si riprova la settimana dopo.
        }
      }
    }
    if (s.plannedWeek !== s.week) {
      s = planWeek(s, strategy.planWeek(s, rng, ctx), ctx).state;
      d.weeks++;
    }
    const drawn = drawWeekEvents(s, ctx);
    s = drawn.state;
    for (const e of drawn.events) {
      s = resolveEvent(s, e.eventId, strategy.chooseEvent(e.choices.length, rng), ctx).state;
      d.events++;
    }
    for (let f = playerFixture(s); f; f = playerFixture(s)) {
      if (!strategy.playsManually(s, f, rng)) {
        s = simulateMatch(s, ctx).state;
        d.simulatedMatches++;
        continue;
      }
      const played = playMatch(
        s,
        (moment) => {
          if (moment.chain) d.chainSteps++;
          else d.moments++;
          return strategy.decideMoment(moment, momentRng);
        },
        ctx,
        { mode },
      );
      s = played.state;
      d.autoSteps += played.matchReport.events.filter((e) => e.kind === 'moment' && e.auto).length;
      if (mode === 'quick') d.quickMatches++;
      else d.matches++;
    }
    s = advanceWeek(s, ctx).state;
  }
  return { state: s, peakOvr };
}

/**
 * Ciclo a capitoli: il giocatore imposta il piano a inizio capitolo, legge le notizie personali,
 * firma le offerte e gioca solo le partite scelte dal regista (nella modalità della scelta);
 * le altre le simula `advanceToStop`. `--mode` qui non conta.
 */
function playChapters(input: LoopInput): LoopOutput {
  const { d, strategy, rng, momentRng, ctx } = input;
  const sp = ctx.config.simulator.secondsPer;
  let s = input.s;
  let peakOvr = 0;
  let seasons = 0;
  let planned = '';
  let seconds = 0;
  const seasonSeconds: number[] = [];
  const chapterStats: ChapterStats = {
    chapters: 0,
    newsStops: 0,
    offerStops: 0,
    picks: 0,
    goals: {},
  };
  // Rete di sicurezza contro uno stop che non fa avanzare lo stato.
  let guard = 0;

  while (!s.retired) {
    if (isSeasonOver(s, ctx)) {
      if (++seasons > MAX_SEASONS) throw new Error(`Career ${input.s.seed} did not end`);
      const now = estimateSeconds(d, sp);
      seasonSeconds.push(now - seconds);
      seconds = now;
      s = endSeason(s, ctx).state;
      peakOvr = Math.max(peakOvr, s.player.history.at(-1)!.ovr);
      continue;
    }
    if (++guard > 500_000) throw new Error(`Career ${input.s.seed}: chapter loop stalled`);
    s = manageLife(s, ctx);
    const offers = getOffers(s);
    if (offers.length > 0) {
      const pick = strategy.pickOffer(s, offers, rng, ctx);
      if (pick) {
        try {
          s = acceptOffer(s, pick.id, ctx);
          d.offers++;
        } catch {
          // Offerta non firmabile adesso (es. finestra chiusa): si riprova al prossimo stop.
        }
      }
    }
    // Un piano per capitolo: a inizio capitolo (o stagione) si imposta, poi si avanza.
    const key = `${s.season}:${s.chapter.id}`;
    if (planned !== key) {
      s = setChapterPlan(s, strategy.planWeek(s, rng, ctx), ctx);
      planned = key;
      d.weeks++;
      chapterStats.chapters++;
    }
    const out = advanceToStop(s, ctx);
    s = out.state;
    d.simulatedMatches += out.report.summary.length;
    // L'esito dell'obiettivo liquidato è il titolo `chapterGoals.<id>.met|missed` di questo stop.
    for (const h of out.report.headlines) {
      for (const g of ctx.content.chapterGoals) {
        const met = h.textKey === chapterGoalOutcomeKey(g, true);
        if (!met && h.textKey !== chapterGoalOutcomeKey(g, false)) continue;
        const row = (chapterStats.goals[g.metric] ??= { met: 0, total: 0 });
        row.total++;
        if (met) row.met++;
      }
    }
    if (out.report.stop === 'chapterEnd') continue;
    if (out.report.stop === 'news' || out.report.stop === 'offers') {
      if (out.report.stop === 'news') chapterStats.newsStops++;
      else chapterStats.offerStops++;
    }
    for (const e of getPendingEvents(s, ctx)) {
      s = resolveEvent(s, e.eventId, strategy.chooseEvent(e.choices.length, rng), ctx).state;
      d.events++;
    }
    if (out.report.stop === 'pick') {
      const f = playerFixture(s)!;
      const mode = s.chapter.picks.find((p) => p.fixtureId === f.id)?.mode ?? 'full';
      chapterStats.picks++;
      const played = playMatch(
        s,
        (moment) => {
          if (moment.chain) d.chainSteps++;
          else d.moments++;
          return strategy.decideMoment(moment, momentRng);
        },
        ctx,
        { mode },
      );
      s = played.state;
      d.autoSteps += played.matchReport.events.filter((e) => e.kind === 'moment' && e.auto).length;
      if (mode === 'quick') d.quickMatches++;
      else d.matches++;
    }
  }
  const rest = estimateSeconds(d, sp) - seconds;
  if (rest > 0) seasonSeconds.push(rest);
  return { state: s, peakOvr, seasonSeconds, chapterStats };
}

/** Gioca una carriera completa senza interfaccia, dalla creazione al ritiro. */
export function runCareer(
  seed: number,
  strategyId: StrategyId,
  ctx: GameContext = defaultContext,
  difficulty?: Difficulty,
  options: StrategyOptions = {},
): CareerResult {
  const strategy = getStrategy(strategyId, options);
  // Le partite giocate di persona sono complete o rapide; le altre sono simulate.
  const mode = options.mode ?? 'full';
  // Le scelte della strategia usano un generatore separato: lo stato del gioco resta deterministico.
  const rng = Rng.fromSeed(seed ^ 0x5bd1e995);
  // In isolamento le estrazioni dei momenti non spostano quelle delle scelte fuori campo.
  const momentRng = options.isolate ? Rng.fromSeed(seed) : rng;
  let s = newCareer({ ...randomCareerOptions(rng, ctx), difficulty }, seed, ctx);
  const d: Decisions = {
    weeks: 0,
    events: 0,
    moments: 0,
    chainSteps: 0,
    autoSteps: 0,
    matches: 0,
    quickMatches: 0,
    simulatedMatches: 0,
    offers: 0,
  };
  const potential = s.player.potential;
  const loop = options.loop === 'weeks' ? playWeeks : playChapters;
  const out = loop({ s, d, strategy, mode, rng, momentRng, ctx });
  s = out.state;
  const peakOvr = out.peakOvr;

  const history = s.player.history;
  const totals = careerTotals(history);
  const score = careerScore(history, s.player.role, ctx);
  const levels = history.filter((h) => h.stats.appearances > 0 && h.leagueLevel !== null);
  const seconds = estimateSeconds(d, ctx.config.simulator.secondsPer);
  return {
    seed,
    strategy: strategyId,
    role: s.player.role,
    potential,
    retirement: s.retired!,
    totals,
    score,
    legend: isLegend(score, ctx),
    peakOvr,
    bestLevel: levels.length ? Math.min(...levels.map((h) => h.leagueLevel!)) : null,
    decisions: d,
    playMinutes: Math.round(seconds / 60),
    ...(out.seasonSeconds
      ? { seasonSeconds: out.seasonSeconds, chapterStats: out.chapterStats }
      : {}),
  };
}
