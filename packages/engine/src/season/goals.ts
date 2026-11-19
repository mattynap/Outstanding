import { chapterGoalOutcomeKey, type ChapterGoal } from '@outstanding/content';
import type { ChapterId } from '@outstanding/config';
import { defaultContext, type GameContext } from '../context';
import { checkConditions } from '../events/events';
import { setStat } from '../events/stats';
import { Rng } from '../rng';
import type { ChapterGoalState, GameState } from '../types';
import { clamp } from '../util';
import { getClub } from '../world/queries';
import type { Headline } from './headlines';
import { playerTable } from './director';

/** La definizione di un obiettivo dai contenuti; id sconosciuto = errore (salvataggio o contenuti incoerenti). */
export function chapterGoalDef(id: string, ctx: GameContext = defaultContext): ChapterGoal {
  const goal = ctx.content.chapterGoals.find((g) => g.id === id);
  if (!goal) throw new Error(`Unknown chapter goal "${id}"`);
  return goal;
}

/**
 * Estrae l'obiettivo del capitolo che inizia ora (`state.chapter` è già quello nuovo): filtra per
 * condizioni, esclude quello del capitolo precedente (`chapter.lastGoalId`) ed estrae pesato con
 * `rng`. Nessun obiettivo in preparazione, senza club (nessuna partita da misurare) o se nessuno
 * è adatto; in quei casi `rng` non viene toccato.
 */
export function pickChapterGoal(
  state: GameState,
  chapter: ChapterId,
  rng: Rng,
  ctx: GameContext = defaultContext,
): ChapterGoal | null {
  if (chapter === 'preseason' || !state.player.clubId) return null;
  const pool = ctx.content.chapterGoals.filter(
    (g) =>
      g.id !== state.chapter.lastGoalId &&
      // Il gol in una partita scelta ha senso solo se il capitolo ne ha.
      (g.metric !== 'pickGoal' || state.chapter.picks.length > 0) &&
      checkConditions(g.conditions, state, ctx),
  );
  return pool.length > 0 ? rng.weighted(pool, (g) => g.weight) : null;
}

/** Avanzamento dell'obiettivo dal registro del capitolo; per `tablePosition` è la posizione attuale. */
export function evaluateChapterGoal(
  state: GameState,
  ctx: GameContext = defaultContext,
): { met: boolean; progress: number } {
  const goal = state.chapter.goal;
  if (!goal) return { met: false, progress: 0 };
  const def = chapterGoalDef(goal.id, ctx);
  const log = state.chapter.log;
  switch (def.metric) {
    case 'starts':
      return { met: log.starts >= goal.target, progress: log.starts };
    case 'goals':
      return { met: log.goals >= goal.target, progress: log.goals };
    case 'assists':
      return { met: log.assists >= goal.target, progress: log.assists };
    case 'cleanSheets':
      return { met: log.cleanSheets >= goal.target, progress: log.cleanSheets };
    case 'pickGoal':
      return { met: log.pickedGoals >= goal.target, progress: log.pickedGoals };
    case 'avgRating': {
      // Con zero voti non è raggiunto.
      const avg = log.ratingCount > 0 ? log.ratingSum / log.ratingCount : 0;
      return { met: log.ratingCount > 0 && avg >= goal.target, progress: avg };
    }
    case 'tablePosition': {
      const clubId = state.player.clubId;
      const table = playerTable(state, ctx);
      const pos = clubId && table ? table.findIndex((r) => r.clubId === clubId) + 1 : 0;
      return { met: pos > 0 && pos <= goal.target, progress: pos };
    }
  }
}

/** Obiettivo nuovo per il capitolo che inizia, estratto con l'`Rng` dello stato. */
export function startChapterGoal(state: GameState, ctx: GameContext = defaultContext): GameState {
  const rng = Rng.fromState(state.rngState);
  const def = pickChapterGoal(state, state.chapter.id, rng, ctx);
  if (!def) return state;
  const goal: ChapterGoalState = { id: def.id, target: def.target, settled: false };
  return { ...state, rngState: rng.getState(), chapter: { ...state.chapter, goal } };
}

/**
 * Liquida l'obiettivo del capitolo, una sola volta (`settled`): se raggiunto, fiducia del mister e
 * morale; se mancato, solo un piccolo calo di morale. L'esito è un titolo di tipo `event`.
 */
export function settleChapter(
  state: GameState,
  ctx: GameContext = defaultContext,
): { state: GameState; headline: Headline | null } {
  const goal = state.chapter.goal;
  if (!goal || goal.settled) return { state, headline: null };
  const cfg = ctx.config.calendar.chapterGoals;
  const { met } = evaluateChapterGoal(state, ctx);
  const p = state.player;
  const limits = ctx.config.events.statLimits;

  let player = setStat(
    p,
    'condition.morale',
    p.condition.morale + (met ? cfg.rewardMorale : cfg.missMorale),
    limits,
  );
  if (met && p.clubId) {
    const coachId = getClub(state.world, p.clubId).coachId;
    const rel = clamp((p.relationships[coachId] ?? 0) + cfg.rewardTrust, -100, 100);
    player = { ...player, relationships: { ...player.relationships, [coachId]: rel } };
  }
  const club = p.clubId ? getClub(state.world, p.clubId).shortName : '';
  const headline: Headline = {
    kind: 'event',
    textKey: chapterGoalOutcomeKey(chapterGoalDef(goal.id, ctx), met),
    params: {
      firstName: p.firstName,
      lastName: p.lastName,
      club,
      target: goal.target,
    },
  };
  return {
    state: { ...state, player, chapter: { ...state.chapter, goal: { ...goal, settled: true } } },
    headline,
  };
}
