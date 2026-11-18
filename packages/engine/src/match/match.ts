import type { MomentTypeConfig } from '@outstanding/config';
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
  Player,
  RosterPlayer,
  Skill,
  Selection,
  Side,
} from '../types';
import { clamp, roundTo } from '../util';
import { settleKnockout } from '../cups/cups';
import { interviewContext, pressBonus, recordMatchForMedia } from '../media/media';
import { clubRatings, getAnyClub, getClub, levelOfClub } from '../world/queries';
import { buildupLines } from '@outstanding/content';
import {
  arm,
  directorMinute,
  goalDiff,
  gate,
  initialDirector,
  onChainEnd,
  onStepOpened,
  tension,
} from './director';
import {
  applyEffects,
  chanceBandOf,
  getMomentType,
  consequenceOf,
  onFailOf,
  ZERO_DYN,
  optionChance,
  optionValue,
  riskBonus,
  pickMomentType,
  type KeyMoment,
} from './moments';
import { goalChancePerMinute, pushFor, stepPressure } from './pressure';
import { planMinutes, selectPlayer } from './selection';
import { matchSignals, matchStakes } from './stakes';

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
  /** Gesto da leggenda offerto e scelto in partita (per la prima pagina e l'album). */
  legend?: { id: string; success: boolean };
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

/**
 * Simula un minuto: prima il rumore della pressione, poi il gol di casa (e il marcatore), poi
 * quello in trasferta. L'ordine delle estrazioni è fisso: il regista si appoggia a questo.
 */
function simulateMinute(
  state: GameState,
  m: MatchState,
  clubs: MatchClubs,
  rng: Rng,
  ctx: GameContext,
): MatchState {
  const cfg = ctx.config.match;
  const minute = m.minute + 1;
  const on = playerOnPitch(m, minute) ? 1 : 0;

  const own = clubs[m.side];
  const ovr = computeOvr(state.player.skills, state.player.role, ctx.config.ratings);
  const ratings = { home: clubs.home.rating, away: clubs.away.rating };
  const push = pushFor(ratings, m.side, clubs.neutral, cfg.pressure);
  const p = stepPressure(m.pressure, push, 0, rng, cfg.pressure);

  ratings[m.side] += (ovr - own.rating) * cfg.playerImpact * on;
  const xg = expectedGoals(ratings.home, ratings.away, cfg.quickSim, clubs.neutral);
  const scale = {
    [m.side]: 1 + (cfg.xgScaleWhileOnPitch.for - 1) * on,
    [other(m.side)]: 1 + (cfg.xgScaleWhileOnPitch.against - 1) * on,
  } as Record<Side, number>;

  let next: MatchState = { ...m, minute, pressure: p, trace: [...m.trace, p] };
  for (const side of ['home', 'away'] as const) {
    const sidePressure = side === m.side ? p : -p;
    const chance = goalChancePerMinute(
      xg[side] * scale[side],
      sidePressure,
      totalMinutes(ctx),
      cfg.pressure,
    );
    if (rng.chance(chance)) {
      next = addGoal(next, side, minute, fullName(pickScorer(clubs[side], rng, ctx)));
    }
  }
  return next;
}

/**
 * Indici delle opzioni della config offerte a questo passo, fissati all'apertura. Un gesto da
 * leggenda compare solo come ultimo passo di una catena (passo 2 o oltre, nessun seguito), con
 * tensione e abilità sufficienti e finché ne restano nella partita. Se più gesti sono idonei
 * se ne offrono al massimo quanti ne restano, scegliendo quelli col margine maggiore sulle
 * soglie (somma abilità − soglia; a parità, ordine della config). Sale `legendsUsed` quando
 * viene offerto, scelto o no. Non estrae nulla.
 */
export function availableOptions(
  m: MatchState,
  type: MomentTypeConfig,
  chain: { rootId: string; step: number } | undefined,
  player: Player,
  tens: number,
  ctx: GameContext,
): { options: number[]; legendsOffered: number } {
  const room = Math.max(0, ctx.config.match.legends.perMatch - m.director.legendsUsed);
  const eligible: { index: number; margin: number }[] = [];
  type.options.forEach((o, index) => {
    const lg = o.legend;
    if (!lg || !chain || chain.step < 2 || o.success.next || o.failure.next) return;
    if (tens < lg.minTension) return;
    const gaps = (Object.entries(lg.skills) as [Skill, number][]).map(
      ([k, min]) => player.skills[k] - min,
    );
    if (gaps.some((g) => g < 0)) return;
    eligible.push({ index, margin: gaps.reduce((a, g) => a + g, 0) });
  });
  const offered = new Set(
    eligible
      .slice()
      .sort((x, y) => y.margin - x.margin || x.index - y.index)
      .slice(0, Math.min(1, room))
      .map((e) => e.index),
  );
  const options = type.options.flatMap((o, i) => (!o.legend || offered.has(i) ? [i] : []));
  return { options, legendsOffered: offered.size };
}

/** Costruisce la vista del momento chiave in attesa, con le probabilità di ogni opzione. */
function describeMoment(state: GameState, m: MatchState, ctx: GameContext): KeyMoment {
  const pending = m.pending;
  if (!pending) throw new Error('No key moment pending');
  const type = getMomentType(pending.momentId, ctx);
  const opponent = getAnyClub(state.world, m.opponentId);
  const bonus = difficultyMods(state, ctx).matchChance + pressBonus(state, m.fixtureId);
  return {
    momentId: type.id,
    minute: pending.minute,
    textKey: `match.moments.${type.id}.text.${pending.textVariant}`,
    params: { opponent: opponent.shortName },
    score: { ...m.score },
    ...(pending.chain ? { chain: { ...pending.chain } } : {}),
    dyn: { ...m.dyn },
    pressure: m.pressure,
    options: pending.options.map((index) => {
      const o = type.options[index]!;
      // Chiudere riesce sempre: la probabilità vera è 1 (vedi `decideMoment`).
      const rb = riskBonus(o.risk, goalDiff(m), pending.minute, ctx.config.match.risk);
      const chance = o.closes
        ? 1
        : optionChance(state.player, o, opponent.rating, ctx, bonus, 0.5, m.dyn, rb);
      return {
        id: o.id,
        textKey: o.legend
          ? `match.legends.${o.legend.id}.option`
          : `match.moments.${type.id}.options.${o.id}`,
        chance,
        onSuccess: consequenceOf(o.success, true),
        onFailure: consequenceOf(o.failure, false),
        onFail: onFailOf(o, ctx),
        chanceBand: chanceBandOf(chance, ctx.config.match.chanceBands),
        risk: o.risk,
        value: optionValue(o, chance, m.score[m.side] - m.score[other(m.side)], ctx.config.match),
        ...(o.closes ? { closes: true as const } : {}),
        ...(o.legend ? { legendId: o.legend.id } : {}),
      };
    }),
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
  const level = state.player.clubId ? levelOfClub(state.world, state.player.clubId) : undefined;
  const byLevel = state.player.seasonLevelApps ?? {};
  const player = {
    ...state.player,
    image: m.legend?.success
      ? {
          ...state.player.image,
          popularity: clamp(
            state.player.image.popularity + ctx.config.match.legends.popularity,
            0,
            100,
          ),
        }
      : state.player.image,
    seasonLevelApps:
      played && level !== undefined
        ? { ...byLevel, [level]: (byLevel[level] ?? 0) + 1 }
        : state.player.seasonLevelApps,
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
      ...(m.legend ? { legend: { ...m.legend } } : {}),
      ...(after.injured && after.player.injury ? { injury: { ...after.player.injury } } : {}),
    },
  };
}

/**
 * Apre un passo interattivo al minuto raggiunto: variante del testo e contatori del regista.
 * Senza `chain` è la radice armata; con `chain` è un passo successivo, allo stesso minuto.
 */
function openStep(
  m: MatchState,
  momentId: string,
  chain: { rootId: string; step: number } | undefined,
  player: Player,
  rng: Rng,
  ctx: GameContext,
): MatchState {
  const type = getMomentType(momentId, ctx);
  const textVariant = rng.int(1, type.textVariants);
  const stepTension = tension(m, ctx.config.match);
  const { options, legendsOffered } = availableOptions(m, type, chain, player, stepTension, ctx);
  return {
    ...m,
    director: onStepOpened(
      { ...m.director, legendsUsed: m.director.legendsUsed + legendsOffered },
      {
        minute: m.minute,
        momentId: type.id,
        tension: stepTension,
        root: chain === undefined,
      },
      ctx.config.match,
    ),
    pending: {
      momentId: type.id,
      minute: m.minute,
      textVariant,
      ...(chain ? { chain } : {}),
      options,
    },
  };
}

/**
 * Il regista valuta il minuto raggiunto: minimo garantito senza estrazione, altrimenti
 * `rng.chance(p)`; poi il tipo e la riga di preavviso nella cronaca.
 */
function tryArm(state: GameState, m: MatchState, rng: Rng, ctx: GameContext): MatchState {
  const cfg = ctx.config.match;
  const g = gate(m, cfg);
  if (g.kind === 'none') return m;
  if (g.kind === 'roll' && !rng.chance(g.p)) return m;
  const type = pickMomentType(state.player.role, m, g.maxDepth, rng, ctx);
  if (!type) return m;
  // Il contesto non ha ancora una lingua scelta: l'unica tabella è `it` (content:check ne
  // garantisce almeno BUILDUP_MIN_LINES righe per fase). Da rivedere se arrivano altre lingue.
  const lines = buildupLines(ctx.content.i18n.it, type.phase);
  const buildup: MatchEvent = {
    kind: 'buildup',
    minute: m.minute,
    momentId: type.id,
    textKey: `match.buildup.${type.phase}.${rng.int(1, lines)}`,
  };
  return {
    ...m,
    director: arm(m.director, m.minute, type.id, g.kind === 'forced' || g.forced, cfg),
    events: [...m.events, buildup],
  };
}

/**
 * Fa avanzare la partita fino al prossimo momento chiave o alla fine. Ordine fisso per minuto:
 * pressione e gol, contabilità del regista, apertura del passo armato, nuovo preavviso.
 */
function run(
  state: GameState,
  m: MatchState,
  rng: Rng,
  ctx: GameContext,
): { state: GameState; step: MatchStep } {
  const clubs = matchClubs(state, m);
  let cur = m;
  for (;;) {
    if (cur.minute >= totalMinutes(ctx)) {
      const { state: done, report } = finishMatch(state, cur, rng, ctx);
      return {
        state: { ...done, rngState: rng.getState() },
        step: { kind: 'finished', report },
      };
    }
    // Si riparte sempre dal minuto successivo: il minuto del momento già aperto non si rivaluta.
    const goalsBefore = cur.score.home + cur.score.away;
    cur = simulateMinute(state, cur, clubs, rng, ctx);
    cur = directorMinute(cur, cur.score.home + cur.score.away > goalsBefore, ctx.config.match);
    if (!cur.director.armed) cur = tryArm(state, cur, rng, ctx);
    // Con armLead 0 il preavviso e l'apertura cadono nello stesso minuto.
    if (cur.director.armed && cur.director.armed.at <= cur.minute) {
      cur = openStep(cur, cur.director.armed.momentId, undefined, state.player, rng, ctx);
      const paused = { ...state, currentMatch: cur, rngState: rng.getState() };
      return { state: paused, step: { kind: 'moment', moment: describeMoment(paused, cur, ctx) } };
    }
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

  const mode = 'full';
  const minutesOnPitch = minuteIn === null ? 0 : minuteOut - minuteIn;
  const director = initialDirector(mode, minutesOnPitch, rng, ctx.config.match);
  const m: MatchState = {
    fixtureId: fixture.id,
    side,
    opponentId: side === 'home' ? fixture.awayId : fixture.homeId,
    selection,
    minuteIn,
    minuteOut,
    minute: 0,
    mode,
    pressure: 0,
    trace: [],
    director,
    dyn: { ...ZERO_DYN },
    stakes: matchStakes(matchSignals(state, fixture, ctx), ctx.config.match.stakes),
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
  if (
    !Number.isInteger(optionIndex) ||
    optionIndex < 0 ||
    optionIndex >= m.pending.options.length
  ) {
    throw new Error(`Invalid option ${optionIndex} for "${type.id}"`);
  }
  if (!Number.isFinite(quality) || quality < 0 || quality > 1) {
    throw new Error(`Invalid moment quality ${quality}`);
  }
  const option = type.options[m.pending.options[optionIndex]!];
  if (!option) throw new Error(`Invalid option ${optionIndex} for "${type.id}"`);

  const rng = Rng.fromState(state.rngState);
  const clubs = matchClubs(state, m);
  const opponent = clubs[other(m.side)];
  const minute = m.pending.minute;
  // "Chiudi" non estrae: riesce sempre e il gesto non conta (spec §8.4).
  const success =
    option.closes === true ||
    rng.chance(
      optionChance(
        state.player,
        option,
        opponent.rating,
        ctx,
        difficultyMods(state, ctx).matchChance + pressBonus(state, m.fixtureId),
        quality,
        m.dyn,
        riskBonus(option.risk, goalDiff(m), minute, ctx.config.match.risk),
      ),
    );
  const outcome = success ? option.success : option.failure;
  const legend = option.legend;

  let cur: MatchState = {
    ...m,
    pending: null,
    ratingDelta:
      m.ratingDelta +
      outcome.rating +
      (legend && success ? ctx.config.match.legends.ratingBonus : 0),
    legend: legend ? { id: legend.id, success } : m.legend,
    events: [
      ...m.events,
      { kind: 'moment', minute, momentId: type.id, optionId: option.id, success, quality },
    ],
  };
  cur = applyEffects(cur, outcome.effects, ctx.config.match);
  // Esito del passo decisivo: il picco è il passo aperto a questo minuto con questo tipo.
  const peak = cur.director.peak;
  if (peak && peak.minute === minute && peak.momentId === type.id) {
    cur = { ...cur, director: { ...cur.director, peak: { ...peak, success } } };
  }

  // Seguito della catena: si estrae sempre `chance(next.chance ?? 1)`, anche quando vale 1, così
  // il consumo del generatore dipende solo dalla config e partita continua e ripresa coincidono.
  if (outcome.next && rng.chance(outcome.next.chance ?? 1)) {
    if (cur.director.budgetLeft <= 0) {
      // Invariante: il regista apre solo radici con chainDepth ≤ budgetLeft.
      throw new Error(`Chain step "${outcome.next.momentId}" opened without budget`);
    }
    const chain = {
      rootId: m.pending.chain?.rootId ?? type.id,
      step: (m.pending.chain?.step ?? 1) + 1,
    };
    // Stesso minuto della radice, nessun avanzamento: niente gol dell'esito, niente intervallo.
    cur = openStep(cur, outcome.next.momentId, chain, state.player, rng, ctx);
    const paused = { ...state, currentMatch: cur, rngState: rng.getState() };
    return { state: paused, step: { kind: 'moment', moment: describeMoment(paused, cur, ctx) } };
  }

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
  // Fine della catena: parte il respiro.
  const director = onChainEnd(cur.director, minute, ctx.config.match);
  return run(state, { ...cur, director }, rng, ctx);
}

/**
 * Decisore delle partite simulate: sceglie l'opzione più probabile fra quelle che proseguono
 * l'azione. "Chiudi" (probabilità 1) lo sceglie solo se la migliore delle altre è in fascia bassa:
 * è la scelta prudente, chi gioca di persona può insistere per ottenere di più.
 */
export function prudentMomentChoice(moment: KeyMoment): number {
  const best = (keep: (o: KeyMoment['options'][number]) => boolean) =>
    moment.options.reduce(
      (b, o, i, all) => (keep(o) && (b < 0 || o.chance > all[b]!.chance) ? i : b),
      -1,
    );
  const open = best((o) => !o.closes);
  const close = best((o) => o.closes === true);
  if (close >= 0 && (open < 0 || moment.options[open]!.chanceBand === 'low')) return close;
  return open;
}

/** Decisore delle partite simulate (`prudentMomentChoice`). */
export const autoDecider: KeyMomentDecider = (moment) => prudentMomentChoice(moment);

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
  const cm = state.currentMatch;
  // Partita in corso senza momento aperto (salvataggio migrato): si riprende dal minuto raggiunto.
  let { state: s, step } = cm
    ? cm.pending
      ? { state, step: { kind: 'moment', moment: getPendingMoment(state, ctx)! } as MatchStep }
      : run(state, cm, Rng.fromState(state.rngState), ctx)
    : beginMatch(state, ctx);
  while (step.kind === 'moment') {
    ({ state: s, step } = decideMoment(s, decide(step.moment, s), ctx));
  }
  return { state: s, matchReport: step.report };
}
