import type { CalendarConfig } from '@outstanding/config';
import { defaultContext, type GameContext } from '../context';
import type { MatchReport } from '../match/match';
import { matchSignals, matchStakes } from '../match/stakes';
import { weekOfSeason } from '../time';
import type {
  ChapterId,
  ChapterLog,
  ChapterPlanLog,
  ChapterPick,
  ChapterState,
  Fixture,
  GameState,
  Skill,
  Skills,
} from '../types';
import { getClub, getGroup, levelOfClub } from '../world/queries';
import type { WeekPlanReport } from './plan';
import { computeStandings, type StandingRow } from './standings';

/** Registro vuoto: lo aggiorna chi chiude una partita del giocatore (Task B2). */
export function emptyChapterLog(): ChapterLog {
  return {
    starts: 0,
    goals: 0,
    assists: 0,
    ratingSum: 0,
    ratingCount: 0,
    cleanSheets: 0,
    pickedGoals: 0,
    legends: 0,
    decisive: null,
    events: 0,
    bestRating: null,
    lastResult: null,
    lastLegend: null,
  };
}

/** Intervallo di settimane della stagione (da 0, estremi inclusi) coperto da un capitolo. */
export function chapterWeekRange(id: ChapterId, cal: CalendarConfig): [number, number] {
  const i = cal.chapters.findIndex((c) => c.id === id);
  if (i < 0) throw new Error(`Unknown chapter "${id}"`);
  const next = cal.chapters[i + 1];
  return [cal.chapters[i]!.fromWeek, (next ? next.fromWeek : cal.weeksPerSeason) - 1];
}

/** Il capitolo di una settimana della stagione (0–51), non assoluta. */
export function chapterOf(seasonWeek: number, cal: CalendarConfig): ChapterId {
  let id = cal.chapters[0]!.id;
  for (const c of cal.chapters) if (seasonWeek >= c.fromWeek) id = c.id;
  return id;
}

/** Classifica del girone del giocatore, nulla senza club. */
export function playerTable(state: GameState, ctx: GameContext): StandingRow[] | null {
  const clubId = state.player.clubId;
  if (!clubId) return null;
  const { group } = getGroup(state.world, getClub(state.world, clubId).groupId);
  return computeStandings(
    state.calendar.filter((f) => f.groupId === group.id && f.season === state.season),
    group.clubIds,
    ctx.config.world.points,
  );
}

/**
 * Peso della classifica: massimo sul confine della zona promozione o retrocessione, cala
 * linearmente con la distanza in posizioni. Solo in campionato e dopo `fromMatchday`.
 */
function tableWeight(
  state: GameState,
  fixture: Fixture,
  table: StandingRow[] | null,
  ctx: GameContext,
): number {
  const w = ctx.config.calendar.chapterWeights.table;
  const clubId = state.player.clubId;
  if (!table || !clubId || fixture.cup || fixture.matchday < w.fromMatchday) return 0;
  const level = levelOfClub(state.world, clubId);
  const levelCfg = ctx.config.world.levels.find((l) => l.level === level);
  const pos = table.findIndex((r) => r.clubId === clubId);
  if (!levelCfg || pos < 0) return 0;
  const near = (boundary: number, weight: number) =>
    weight * Math.max(0, 1 - Math.abs(pos - boundary) / w.window);
  const promotion =
    levelCfg.promotePerGroup > 0 ? near(levelCfg.promotePerGroup - 0.5, w.promotion) : 0;
  const relegation =
    levelCfg.relegatePerGroup > 0
      ? near(levelCfg.clubsPerGroup - levelCfg.relegatePerGroup - 0.5, w.relegation)
      : 0;
  return Math.max(promotion, relegation);
}

/** Quanto una partita merita di essere giocata dal giocatore: posta più peso della classifica. */
export function scoreFixture(
  state: GameState,
  fixture: Fixture,
  ctx: GameContext = defaultContext,
  table: StandingRow[] | null = playerTable(state, ctx),
): number {
  const stakes = matchStakes(matchSignals(state, fixture, ctx), ctx.config.match.stakes);
  return stakes + tableWeight(state, fixture, table, ctx);
}

interface Scored {
  fixture: Fixture;
  score: number;
  /** Già fra le scelte future: resta finché una nuova non la supera strettamente. */
  kept: boolean;
}

const byCalendar = (a: Fixture, b: Fixture) =>
  a.week - b.week || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Sceglie le partite future del capitolo dopo aver tenuto `locked` (già giocate o in corso, che
 * occupano la quota). Spareggi: punteggio, poi settimana più vicina, poi id: nessun `Rng`, così le
 * scelte si possono rivalutare a ogni stop e in migrazione senza spostare la sequenza principale.
 * `full` va alla più importante fra le future se non c'è già una `full` fra le tenute.
 */
function select(
  state: GameState,
  id: ChapterId,
  ctx: GameContext,
  locked: ChapterPick[],
  previous: ChapterPick[],
): ChapterPick[] {
  const clubId = state.player.clubId;
  const cal = ctx.config.calendar;
  const quota = Math.max(0, cal.chapterMatches.max - locked.length);
  const [from, to] = chapterWeekRange(id, cal);
  const lockedIds = new Set(locked.map((p) => p.fixtureId));
  const prevIds = new Set(previous.map((p) => p.fixtureId));
  const table = playerTable(state, ctx);

  const pool: Scored[] = clubId
    ? state.calendar
        .filter((f) => {
          if (f.season !== state.season || f.result || f.week < state.week) return false;
          if (f.homeId !== clubId && f.awayId !== clubId) return false;
          const w = weekOfSeason(f.week, cal);
          return w >= from && w <= to && !lockedIds.has(f.id);
        })
        .map((f) => ({
          fixture: f,
          score: scoreFixture(state, f, ctx, table),
          kept: prevIds.has(f.id),
        }))
    : [];

  const rank = (x: Scored, y: Scored) => y.score - x.score || byCalendar(x.fixture, y.fixture);
  // Si tengono le scelte future attuali; i posti liberi si riempiono per graduatoria.
  const taken = pool
    .filter((x) => x.kept)
    .sort(rank)
    .slice(0, quota);
  const rest = pool.filter((x) => !x.kept).sort(rank);
  while (taken.length < quota && rest.length > 0) taken.push(rest.shift()!);
  // Una nuova entra solo se supera strettamente la più bassa fra le tenute, che esce (uno a uno).
  for (;;) {
    taken.sort(rank);
    const lowest = taken[taken.length - 1];
    const best = rest[0];
    if (!lowest || !best || best.score <= lowest.score) break;
    taken[taken.length - 1] = rest.shift()!;
  }
  taken.sort(rank);
  // La full va alla più importante (punteggio, settimana, id), senza preferenze per le tenute.
  const fullId = locked.some((p) => p.mode === 'full') ? null : taken[0]?.fixture.id;

  const fresh: ChapterPick[] = taken.map((t) => ({
    fixtureId: t.fixture.id,
    mode: t.fixture.id === fullId ? 'full' : 'quick',
  }));
  const week = new Map(state.calendar.map((f) => [f.id, f]));
  return [...locked, ...fresh].sort((a, b) => {
    const fa = week.get(a.fixtureId);
    const fb = week.get(b.fixtureId);
    return fa && fb ? byCalendar(fa, fb) : 0;
  });
}

/** La partita in corso, se è del capitolo: resta sempre fra le scelte. */
function openPick(state: GameState, id: ChapterId, ctx: GameContext): ChapterPick[] {
  const m = state.currentMatch;
  const f = m && state.calendar.find((x) => x.id === m.fixtureId);
  if (!m || !f) return [];
  const [from, to] = chapterWeekRange(id, ctx.config.calendar);
  const w = weekOfSeason(f.week, ctx.config.calendar);
  if (f.season !== state.season || w < from || w > to) return [];
  return [{ fixtureId: f.id, mode: m.mode === 'full' ? 'full' : 'quick' }];
}

/**
 * Le 2–3 partite future del capitolo con il punteggio più alto, in ordine di calendario; la
 * `full` è la più importante, le altre `quick`. Senza partite (preparazione) torna vuoto.
 */
export function pickChapterMatches(
  state: GameState,
  chapter: ChapterId,
  ctx: GameContext = defaultContext,
): ChapterPick[] {
  return select(state, chapter, ctx, openPick(state, chapter, ctx), []);
}

/**
 * Rivaluta le scelte del capitolo corrente a uno stop (coppa sorteggiata, trasferimento,
 * osservatori). Le partite giocate o in corso restano e occupano la quota; fra le future ne esce
 * solo la più bassa quando una nuova ha un punteggio più alto.
 */
export function refreshChapterPicks(
  state: GameState,
  ctx: GameContext = defaultContext,
): ChapterPick[] {
  const { id, picks } = state.chapter;
  const open = state.currentMatch?.fixtureId;
  const done = (p: ChapterPick) => {
    if (p.fixtureId === open) return true;
    const f = state.calendar.find((x) => x.id === p.fixtureId);
    return !f || !!f.result || f.week < state.week;
  };
  const locked = picks.filter(done);
  const future = picks.filter((p) => !done(p));
  return select(state, id, ctx, locked, future);
}

/** Capitolo senza scelte né registri. */
export function blankChapter(id: ChapterId): ChapterState {
  return {
    id,
    picks: [],
    goal: null,
    lastGoalId: null,
    log: emptyChapterLog(),
    stretch: emptyChapterLog(),
  };
}

/** Un capitolo nuovo per la settimana di `state`: scelte, registri a zero, nessun obiettivo. */
export function createChapter(state: GameState, ctx: GameContext = defaultContext): ChapterState {
  const id = chapterOf(weekOfSeason(state.week, ctx.config.calendar), ctx.config.calendar);
  return { ...blankChapter(id), picks: pickChapterMatches(state, id, ctx) };
}

function addToLog(log: ChapterLog, r: MatchReport, week: number, picked: boolean): ChapterLog {
  const rated = r.rating !== null;
  const best = log.bestRating;
  const mine = r.side === 'home' ? r.score.home : r.score.away;
  const theirs = r.side === 'home' ? r.score.away : r.score.home;
  return {
    ...log,
    starts: log.starts + (r.selection === 'starter' ? 1 : 0),
    goals: log.goals + r.goals,
    assists: log.assists + r.assists,
    ratingSum: log.ratingSum + (r.rating ?? 0),
    ratingCount: log.ratingCount + (rated ? 1 : 0),
    cleanSheets: log.cleanSheets + (r.cleanSheet ? 1 : 0),
    pickedGoals: log.pickedGoals + (picked ? r.goals : 0),
    legends: log.legends + (r.legend ? 1 : 0),
    decisive: r.peak ? { week, fixtureId: r.fixtureId, success: r.peak.success } : log.decisive,
    bestRating:
      r.rating !== null && (!best || r.rating >= best.rating)
        ? { week, fixtureId: r.fixtureId, rating: r.rating }
        : best,
    lastResult: {
      week,
      fixtureId: r.fixtureId,
      result: r.result,
      goalsFor: mine,
      goalsAgainst: theirs,
    },
    lastLegend: r.legend
      ? { week, fixtureId: r.fixtureId, id: r.legend.id, success: r.legend.success }
      : log.lastLegend,
  };
}

/** Aggiorna il registro del piano di un registro (lo crea da `startSkills` se manca). */
function withPlanLog(
  log: ChapterLog,
  startSkills: Skills,
  endSkills: Skills,
  patch: (p: ChapterPlanLog) => ChapterPlanLog,
): ChapterLog {
  const base: ChapterPlanLog = log.plan ?? {
    skillsAtStart: { ...startSkills },
    freshnessAtMatches: [],
    moraleProtected: 0,
    sponsorIncome: 0,
    popularity: 0,
    gossip: 0,
    fines: 0,
    pointsGained: {},
  };
  const next = patch(base);
  const gained: Partial<Record<Skill, number>> = {};
  for (const k of Object.keys(endSkills) as Skill[]) {
    const d = Math.floor(endSkills[k]) - Math.floor(next.skillsAtStart[k]);
    if (d !== 0) gained[k] = d;
  }
  return { ...log, plan: { ...next, pointsGained: gained } };
}

/**
 * Registra una partita del giocatore, giocata o simulata, nel registro del capitolo e in quello
 * del tratto. Nessuna estrazione: non sposta la sequenza di `Rng`. `plan` porta la freschezza di
 * inizio settimana letta dalla partita e il morale che la Famiglia ha protetto.
 */
export function recordChapterMatch(
  state: GameState,
  report: MatchReport,
  plan: { freshness: number; moraleProtected: number; startSkills: Skills },
): GameState {
  const picked = state.chapter.picks.some((p) => p.fixtureId === report.fixtureId);
  const { chapter } = state;
  const note = (log: ChapterLog) =>
    withPlanLog(
      addToLog(log, report, state.week, picked),
      plan.startSkills,
      state.player.skills,
      (p) => ({
        ...p,
        freshnessAtMatches: [...p.freshnessAtMatches, plan.freshness],
        moraleProtected: p.moraleProtected + plan.moraleProtected,
      }),
    );
  return {
    ...state,
    chapter: { ...chapter, log: note(chapter.log), stretch: note(chapter.stretch) },
  };
}

/**
 * Registra nel capitolo e nel tratto quello che il piano della settimana ha fatto (dal report di
 * `planWeek`). `startSkills` sono le abilità prima delle sedute. Nessuna estrazione.
 */
export function recordChapterPlan(
  state: GameState,
  startSkills: Skills,
  r: WeekPlanReport,
): GameState {
  const { chapter } = state;
  const note = (log: ChapterLog) =>
    withPlanLog(log, startSkills, state.player.skills, (p) => ({
      ...p,
      moraleProtected: p.moraleProtected + r.moraleProtected,
      sponsorIncome: p.sponsorIncome + (r.sponsorIncome ?? 0),
      popularity: p.popularity + (r.popularityGained ?? 0),
      gossip: p.gossip + (r.party?.gossip ? 1 : 0),
      fines: p.fines + (r.party?.fine ? 1 : 0),
    }));
  return {
    ...state,
    chapter: { ...chapter, log: note(chapter.log), stretch: note(chapter.stretch) },
  };
}
