import { defaultContext, type GameContext } from '../context';
import { difficultyMods } from '../difficulty';
import { applyMatchAftermath } from '../player/condition';
import { computeOvr } from '../player/ratings';
import { Rng } from '../rng';
import { expectedGoals } from '../season/quickSim';
import { playerFixture } from '../season/week';
import type {
  ClubBase,
  GameState,
  MatchEvent,
  MatchState,
  RosterPlayer,
  Selection,
  Side,
} from '../types';
import { clamp, roundTo } from '../util';
import { settleKnockout } from '../cups/cups';
import { interviewContext, pressBonus, recordMatchForMedia } from '../media/media';
import { clubRatings, getAnyClub, getClub } from '../world/queries';
import {
  getMomentType,
  consequenceOf,
  optionChance,
  pickMomentType,
  planMomentMinutes,
  type KeyMoment,
} from './moments';
import { planMinutes, selectPlayer } from './selection';

/** Voci che compongono il voto in pagella, nell'ordine in cui si sommano. */
export const RATING_PART_KEYS = [
  'base',
  'moments',
  'goals',
  'assists',
  'result',
  'cleanSheet',
  'conceded',
  'day',
] as const;
export type RatingPartKey = (typeof RATING_PART_KEYS)[number];

export interface RatingPart {
  key: RatingPartKey;
  delta: number;
}

/** Resoconto finale della partita del giocatore. */
export interface MatchReport {
  fixtureId: string;
  homeId: string;
  awayId: string;
  side: Side;
  score: { home: number; away: number };
  result: 'win' | 'draw' | 'loss';
  events: MatchEvent[];
  selection: Selection;
  minutesPlayed: number;
  /** Voto in pagella 4–10 a passi di 0,5; null = senza voto o non entrato. */
  rating: number | null;
  /**
   * Voci del voto prima di arrotondare e limitare: `base` sempre, le altre solo se diverse da 0;
   * `day` è la giornata (rumore). Presenti solo quando c'è un voto.
   */
  ratingParts?: RatingPart[];
  /** Chiave della riga di commento in pagella. */
  commentKey: string;
  goals: number;
  assists: number;
  cleanSheet: boolean;
  /** Coppa: gol dei supplementari e rigori, se la sfida è finita in parità. */
  extraTime?: { home: number; away: number };
  penalties?: { home: number; away: number };
  /** Id della coppa, se è una partita di coppa. */
  competitionId?: string;
  /** Infortunio subito durante la partita. */
  injury?: { type: string; weeksLeft: number };
}

/** Passo della partita: un momento chiave da decidere oppure la partita finita. */
export type MatchStep =
  { kind: 'moment'; moment: KeyMoment } | { kind: 'finished'; report: MatchReport };

/** Scelta del giocatore: qualità del tocco tra 0 e 1, con 0,5 neutro. */
export interface MatchDecision {
  optionIndex: number;
  quality: number;
}

/** Strategia che sceglie l'opzione di un momento chiave (il giocatore in UI, una strategia nel simulatore). */
export type KeyMomentDecider = (moment: KeyMoment, state: GameState) => number | MatchDecision;

const other = (side: Side): Side => (side === 'home' ? 'away' : 'home');
const totalMinutes = (ctx: GameContext) =>
  ctx.config.match.blocks * ctx.config.match.minutesPerBlock;

function fullName(p: { firstName: string; lastName: string }): string {
  return `${p.firstName} ${p.lastName}`;
}

/** Marcatore casuale di una rosa, pesato per ruolo. */
function pickScorer(club: ClubBase, rng: Rng, ctx: GameContext): RosterPlayer {
  const w = ctx.config.match.scorerWeights;
  return rng.weighted(club.roster, (p) => w[p.role]);
}

/** Minuti in cui il giocatore è in campo dentro l'intervallo (from, to]. */
function overlap(m: MatchState, from: number, to: number): number {
  if (m.minuteIn === null) return 0;
  return Math.max(0, Math.min(to, m.minuteOut) - Math.max(from, m.minuteIn));
}

function playerOnPitch(m: MatchState, minute: number): boolean {
  return m.minuteIn !== null && minute > m.minuteIn && minute <= m.minuteOut;
}

interface MatchClubs {
  home: ClubBase;
  away: ClubBase;
  neutral: boolean;
}

function matchClubs(state: GameState, m: MatchState): MatchClubs {
  const fixture = state.calendar.find((f) => f.id === m.fixtureId);
  if (!fixture) throw new Error(`Unknown fixture "${m.fixtureId}"`);
  return {
    home: getAnyClub(state.world, fixture.homeId),
    away: getAnyClub(state.world, fixture.awayId),
    neutral: fixture.cup?.neutral ?? false,
  };
}

function addGoal(
  m: MatchState,
  side: Side,
  minute: number,
  scorerName: string,
  opts: { assistName?: string; byPlayer?: boolean; assistByPlayer?: boolean } = {},
): MatchState {
  const event: MatchEvent = {
    kind: 'goal',
    minute,
    side,
    scorerName,
    byPlayer: opts.byPlayer ?? false,
    assistByPlayer: opts.assistByPlayer ?? false,
    ...(opts.assistName ? { assistName: opts.assistName } : {}),
  };
  return {
    ...m,
    score: { ...m.score, [side]: m.score[side] + 1 },
    events: [...m.events, event],
  };
}

/** Simula un blocco di gioco: gol dei compagni e degli avversari al di fuori dei momenti chiave. */
function simulateBlock(
  state: GameState,
  m: MatchState,
  clubs: MatchClubs,
  rng: Rng,
  ctx: GameContext,
): MatchState {
  const cfg = ctx.config.match;
  const from = m.minute;
  // Un salvataggio ripreso a metà blocco chiude il blocco al confine di 90.
  const to = Math.min(from + cfg.minutesPerBlock, totalMinutes(ctx));
  const length = to - from;
  const share = overlap(m, from, to) / length;

  const own = clubs[m.side];
  const ovr = computeOvr(state.player.skills, state.player.role, ctx.config.ratings);
  const ratings = { home: clubs.home.rating, away: clubs.away.rating };
  ratings[m.side] += (ovr - own.rating) * cfg.playerImpact * share;
  const xg = expectedGoals(ratings.home, ratings.away, cfg.quickSim, clubs.neutral);
  const scale = {
    [m.side]: 1 + (cfg.xgScaleWhileOnPitch.for - 1) * share,
    [other(m.side)]: 1 + (cfg.xgScaleWhileOnPitch.against - 1) * share,
  } as Record<Side, number>;

  let next = m;
  for (const side of ['home', 'away'] as const) {
    const goals = rng.poisson(
      (xg[side] * scale[side] * length) / (cfg.blocks * cfg.minutesPerBlock),
    );
    for (let i = 0; i < goals; i++) {
      const minute = rng.int(from + 1, to);
      next = addGoal(next, side, minute, fullName(pickScorer(clubs[side], rng, ctx)));
    }
  }
  return { ...next, minute: to, trace: [...m.trace, ...Array<number>(length).fill(0)] };
}

/** Costruisce la vista del momento chiave in attesa, con le probabilità di ogni opzione. */
function describeMoment(state: GameState, m: MatchState, ctx: GameContext): KeyMoment {
  const pending = m.pending;
  if (!pending) throw new Error('No key moment pending');
  const type = getMomentType(pending.momentId, ctx);
  const opponent = getAnyClub(state.world, m.opponentId);
  // I gol di un blocco vengono simulati prima dei suoi momenti: si contano solo quelli già avvenuti.
  const score = { home: 0, away: 0 };
  for (const e of m.events) {
    if (e.kind === 'goal' && e.minute <= pending.minute) score[e.side] += 1;
  }
  return {
    momentId: type.id,
    minute: pending.minute,
    textKey: `match.moments.${type.id}.text.${pending.textVariant}`,
    params: { opponent: opponent.shortName },
    score,
    options: type.options.map((o) => ({
      id: o.id,
      textKey: `match.moments.${type.id}.options.${o.id}`,
      chance: optionChance(
        state.player,
        o,
        opponent.rating,
        ctx,
        difficultyMods(state, ctx).matchChance + pressBonus(state, m.fixtureId),
      ),
      onSuccess: consequenceOf(o.success, true),
      onFailure: consequenceOf(o.failure, false),
    })),
  };
}

function resultFor(m: MatchState): 'win' | 'draw' | 'loss' {
  const mine = m.score[m.side];
  const theirs = m.score[other(m.side)];
  return mine > theirs ? 'win' : mine < theirs ? 'loss' : 'draw';
}

/** Chiude la partita: voto, commento, risultato nel calendario e statistiche stagionali. */
function finishMatch(
  state: GameState,
  m: MatchState,
  rng: Rng,
  ctx: GameContext,
): { state: GameState; report: MatchReport } {
  const cfg = ctx.config.match.rating;
  const role = state.player.role;
  const minutesPlayed = m.minuteIn === null ? 0 : m.minuteOut - m.minuteIn;
  const result = resultFor(m);
  const opponentSide = other(m.side);
  const concededOnPitch = m.events.filter(
    (e) => e.kind === 'goal' && e.side === opponentSide && playerOnPitch(m, e.minute),
  ).length;
  const cleanSheet =
    minutesPlayed >= cfg.cleanSheetMinMinutes && m.score[opponentSide] === 0 && role !== 'ATT';

  let rating: number | null = null;
  let ratingParts: RatingPart[] | undefined;
  let commentKey: string;
  if (minutesPlayed === 0) {
    commentKey = m.selection === 'out' ? 'match.comment.fuori' : 'match.comment.panchina';
  } else if (minutesPlayed < cfg.minMinutes && m.goals + m.assists === 0) {
    commentKey = 'match.comment.sv';
  } else {
    // Stessi termini e stessa unica estrazione di rng.normal di prima: le carriere non cambiano.
    const parts: RatingPart[] = [
      { key: 'base', delta: cfg.base },
      { key: 'moments', delta: m.ratingDelta },
      { key: 'goals', delta: m.goals * cfg.goal },
      { key: 'assists', delta: m.assists * cfg.assist },
      { key: 'result', delta: cfg.result[result] },
      { key: 'cleanSheet', delta: cleanSheet ? cfg.cleanSheet[role] : 0 },
      { key: 'conceded', delta: concededOnPitch * cfg.concededPerGoal[role] },
      { key: 'day', delta: rng.normal(0, cfg.noise) },
    ];
    const raw = parts.reduce((sum, p) => sum + p.delta, 0);
    ratingParts = parts.filter((p) => p.key === 'base' || p.delta !== 0);
    rating = clamp(roundTo(raw, cfg.step), cfg.min, cfg.max);
    const r = rating;
    const band = cfg.commentBands.find((b) => r <= b.upTo) ?? cfg.commentBands.at(-1)!;
    commentKey = `match.comment.${band.id}.${rng.int(1, band.variants)}`;
  }

  const fixture = state.calendar.find((f) => f.id === m.fixtureId)!;
  const events = [...m.events].sort((a, b) => a.minute - b.minute);
  const s = state.player.seasonStats;
  const played = minutesPlayed > 0;
  const player = {
    ...state.player,
    seasonStats: {
      appearances: s.appearances + (played ? 1 : 0),
      starts: s.starts + (m.selection === 'starter' ? 1 : 0),
      minutes: s.minutes + minutesPlayed,
      goals: s.goals + m.goals,
      assists: s.assists + m.assists,
      cleanSheets: s.cleanSheets + (cleanSheet ? 1 : 0),
      ratingSum: s.ratingSum + (rating ?? 0),
      ratingCount: s.ratingCount + (rating === null ? 0 : 1),
    },
  };
  const coachId = state.player.clubId
    ? getClub(state.world, state.player.clubId).coachId
    : undefined;
  const after = applyMatchAftermath(
    player,
    coachId,
    { selection: m.selection, minutesPlayed, rating, result },
    state.week,
    rng,
    ctx,
    difficultyMods(state, ctx),
  );
  const { currentMatch: _done, ...rest } = state;
  // In coppa una gara decisiva in parità prosegue con supplementari e rigori.
  const settled = settleKnockout(
    { ...fixture, result: { ...m.score } },
    state.calendar,
    clubRatings(state.world),
    rng,
    ctx,
  );
  const next: GameState = recordMatchForMedia(
    {
      ...rest,
      player: after.player,
      calendar: state.calendar.map((f) => (f.id === m.fixtureId ? settled : f)),
    },
    {
      fixtureId: m.fixtureId,
      week: state.week,
      context: interviewContext(result, minutesPlayed, rating, ctx),
      opponent: getAnyClub(state.world, m.opponentId).shortName,
    },
  );
  return {
    state: next,
    report: {
      fixtureId: m.fixtureId,
      homeId: fixture.homeId,
      awayId: fixture.awayId,
      side: m.side,
      score: { ...m.score },
      result,
      events,
      selection: m.selection,
      minutesPlayed,
      rating,
      ...(ratingParts ? { ratingParts } : {}),
      commentKey,
      goals: m.goals,
      assists: m.assists,
      cleanSheet,
      ...(settled.extraTime ? { extraTime: { ...settled.extraTime } } : {}),
      ...(settled.penalties ? { penalties: { ...settled.penalties } } : {}),
      ...(fixture.cup ? { competitionId: fixture.cup.competitionId } : {}),
      ...(after.injured && after.player.injury ? { injury: { ...after.player.injury } } : {}),
    },
  };
}

/** Fa avanzare la partita fino al prossimo momento chiave o alla fine. */
function run(
  state: GameState,
  m: MatchState,
  rng: Rng,
  ctx: GameContext,
): { state: GameState; step: MatchStep } {
  const clubs = matchClubs(state, m);
  let cur = m;
  for (;;) {
    const planned = cur.director.plannedMinutes ?? [];
    const nextMoment = planned[0];
    if (nextMoment !== undefined && nextMoment <= cur.minute) {
      const type = pickMomentType(state.player.role, rng, ctx);
      const d = cur.director;
      cur = {
        ...cur,
        director: {
          ...d,
          plannedMinutes: planned.slice(1),
          budgetLeft: d.budgetLeft - 1,
          interventions: d.interventions + 1,
          lastAt: nextMoment,
          lastTypes: [...d.lastTypes, type.id].slice(-3),
        },
        pending: {
          momentId: type.id,
          minute: nextMoment,
          textVariant: rng.int(1, type.textVariants),
          options: type.options.map((_, i) => i),
        },
      };
      const paused = { ...state, currentMatch: cur, rngState: rng.getState() };
      return { state: paused, step: { kind: 'moment', moment: describeMoment(paused, cur, ctx) } };
    }
    if (cur.minute >= totalMinutes(ctx)) {
      const { state: done, report } = finishMatch(state, cur, rng, ctx);
      return {
        state: { ...done, rngState: rng.getState() },
        step: { kind: 'finished', report },
      };
    }
    cur = simulateBlock(state, cur, clubs, rng, ctx);
  }
}

/**
 * Inizia la partita del giocatore di questa settimana: convocazione, minuti in campo, momenti
 * chiave. Restituisce il primo momento chiave da decidere oppure, se il giocatore non gioca o non
 * ha momenti, la partita già finita.
 */
export function beginMatch(
  state: GameState,
  ctx: GameContext = defaultContext,
): { state: GameState; step: MatchStep } {
  if (state.currentMatch) throw new Error('A match is already in progress');
  if (state.pendingEvents.length > 0) throw new Error('Resolve the pending events first');
  const fixture = playerFixture(state);
  if (!fixture) throw new Error('The player has no match this week');
  if (fixture.result) throw new Error('The match of this week has already been played');

  const rng = Rng.fromState(state.rngState);
  const clubId = state.player.clubId!;
  const side: Side = fixture.homeId === clubId ? 'home' : 'away';
  const club = getClub(state.world, clubId);
  const total = totalMinutes(ctx);
  const selection = selectPlayer(state.player, club, rng, ctx);
  const { minuteIn, minuteOut } = planMinutes(selection, total, rng, ctx);
  const events: MatchEvent[] = [];
  if (minuteIn !== null && minuteIn > 0) events.push({ kind: 'subIn', minute: minuteIn });
  if (minuteIn !== null && minuteOut < total) events.push({ kind: 'subOut', minute: minuteOut });

  const plannedMinutes = planMomentMinutes(state.player.role, minuteIn, minuteOut, total, rng, ctx);
  const m: MatchState = {
    fixtureId: fixture.id,
    side,
    opponentId: side === 'home' ? fixture.awayId : fixture.homeId,
    selection,
    minuteIn,
    minuteOut,
    minute: 0,
    mode: 'full',
    pressure: 0,
    trace: [],
    director: {
      budgetStart: plannedMinutes.length,
      budgetLeft: plannedMinutes.length,
      hotLeft: null,
      lastAt: null,
      interventions: 0,
      armed: null,
      relaxUntil: null,
      lastTypes: [],
      legendsUsed: 0,
      peak: null,
      plannedMinutes,
    },
    dyn: { coachTrust: 0, nerves: 0, fatigue: 0, marking: 0 },
    stakes: 0,
    legend: null,
    score: { home: 0, away: 0 },
    events,
    pending: null,
    ratingDelta: 0,
    goals: 0,
    assists: 0,
  };
  return run(state, m, rng, ctx);
}

/** Il momento chiave in attesa di decisione, se c'è (utile dopo aver ricaricato un salvataggio). */
export function getPendingMoment(
  state: GameState,
  ctx: GameContext = defaultContext,
): KeyMoment | null {
  const m = state.currentMatch;
  return m?.pending ? describeMoment(state, m, ctx) : null;
}

/** Risolve il momento chiave in attesa con l'opzione scelta e fa proseguire la partita. */
export function decideMoment(
  state: GameState,
  decision: number | MatchDecision,
  ctx: GameContext = defaultContext,
): { state: GameState; step: MatchStep } {
  const m = state.currentMatch;
  if (!m?.pending) throw new Error('No key moment pending');
  const type = getMomentType(m.pending.momentId, ctx);
  const { optionIndex, quality } =
    typeof decision === 'number' ? { optionIndex: decision, quality: 0.5 } : decision;
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= type.options.length) {
    throw new Error(`Invalid option ${optionIndex} for "${type.id}"`);
  }
  if (!Number.isFinite(quality) || quality < 0 || quality > 1) {
    throw new Error(`Invalid moment quality ${quality}`);
  }
  const option = type.options[optionIndex];
  if (!option) throw new Error(`Invalid option ${optionIndex} for "${type.id}"`);

  const rng = Rng.fromState(state.rngState);
  const clubs = matchClubs(state, m);
  const opponent = clubs[other(m.side)];
  const minute = m.pending.minute;
  const success = rng.chance(
    optionChance(
      state.player,
      option,
      opponent.rating,
      ctx,
      difficultyMods(state, ctx).matchChance + pressBonus(state, m.fixtureId),
      quality,
    ),
  );
  const outcome = success ? option.success : option.failure;

  let cur: MatchState = {
    ...m,
    pending: null,
    ratingDelta: m.ratingDelta + outcome.rating,
    events: [
      ...m.events,
      { kind: 'moment', minute, momentId: type.id, optionId: option.id, success, quality },
    ],
  };
  const me = fullName(state.player);
  if (outcome.goalFor !== undefined && rng.chance(outcome.goalFor)) {
    if (outcome.by === 'self') {
      cur = addGoal(cur, m.side, minute, me, { byPlayer: true });
      cur = { ...cur, goals: cur.goals + 1 };
    } else {
      const scorer = fullName(pickScorer(clubs[m.side], rng, ctx));
      const assisted = outcome.by === 'assist';
      cur = addGoal(cur, m.side, minute, scorer, {
        ...(assisted ? { assistName: me, assistByPlayer: true } : {}),
      });
      if (assisted) cur = { ...cur, assists: cur.assists + 1 };
    }
  }
  if (outcome.goalAgainst !== undefined && rng.chance(outcome.goalAgainst)) {
    cur = addGoal(cur, other(m.side), minute, fullName(pickScorer(opponent, rng, ctx)));
  }
  return run(state, cur, rng, ctx);
}

/**
 * Decisore delle partite simulate: sceglie sempre l'opzione più probabile. È la scelta prudente:
 * chi gioca la partita di persona può rischiare di più per ottenere di più.
 */
export const autoDecider: KeyMomentDecider = (moment) =>
  moment.options.reduce((best, o, i, all) => (o.chance > all[best]!.chance ? i : best), 0);

/** Simula la partita della settimana senza chiedere nulla al giocatore (momenti con `autoDecider`). */
export function simulateMatch(
  state: GameState,
  ctx: GameContext = defaultContext,
): { state: GameState; matchReport: MatchReport } {
  return playMatch(state, autoDecider, ctx);
}

/** Gioca l'intera partita della settimana affidando i momenti chiave a `decide`. */
export function playMatch(
  state: GameState,
  decide: KeyMomentDecider,
  ctx: GameContext = defaultContext,
): { state: GameState; matchReport: MatchReport } {
  let { state: s, step } = state.currentMatch
    ? { state, step: { kind: 'moment', moment: getPendingMoment(state, ctx)! } as MatchStep }
    : beginMatch(state, ctx);
  while (step.kind === 'moment') {
    ({ state: s, step } = decideMoment(s, decide(step.moment, s), ctx));
  }
  return { state: s, matchReport: step.report };
}
