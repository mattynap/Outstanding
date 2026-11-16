import { defaultContext, type GameContext } from '../context';
import { Rng } from '../rng';
import { seasonStartWeek, weekOfSeason } from '../time';
import type { Fixture, GameState } from '../types';
import { quickResult } from './quickSim';

export type TransferWindow = 'summer' | 'winter';

export interface WeekReport {
  /** The week that was just played. */
  week: number;
  /** Results of the week in the player's group. */
  results: Fixture[];
}

/** True when every week of the current season has been played: call endSeason next. */
export function isSeasonOver(state: GameState, ctx: GameContext = defaultContext): boolean {
  return state.week >= seasonStartWeek(state.season + 1, ctx.config.calendar);
}

/** Open transfer window in the current week, if any. */
export function getTransferWindow(
  state: GameState,
  ctx: GameContext = defaultContext,
): TransferWindow | null {
  const w = weekOfSeason(state.week, ctx.config.calendar);
  const { summer, winter } = ctx.config.calendar.transferWindows;
  if (w >= summer.fromWeek && w <= summer.toWeek) return 'summer';
  if (w >= winter.fromWeek && w <= winter.toWeek) return 'winter';
  return null;
}

/** The player's club fixture in the current week, if any. */
export function playerFixture(state: GameState): Fixture | undefined {
  const clubId = state.player.clubId;
  if (!clubId) return undefined;
  return state.calendar.find(
    (f) => f.week === state.week && (f.homeId === clubId || f.awayId === clubId),
  );
}

/**
 * Closes the current week: simulates every unplayed fixture of the week and moves to the next one.
 * If the player's club plays this week, its match must be played first with playMatch.
 */
export function advanceWeek(
  state: GameState,
  ctx: GameContext = defaultContext,
): { state: GameState; report: WeekReport } {
  if (isSeasonOver(state, ctx)) throw new Error('Season is over: call endSeason');
  const own = playerFixture(state);
  if (own && !own.result) throw new Error('The player has a match this week: call playMatch');

  const rng = Rng.fromState(state.rngState);
  const ratings = new Map(state.world.clubs.map((c) => [c.id, c.rating]));
  const calendar = state.calendar.map((f) => {
    if (f.week !== state.week || f.result) return f;
    const result = quickResult(
      ratings.get(f.homeId) ?? 0,
      ratings.get(f.awayId) ?? 0,
      rng,
      ctx.config.match.quickSim,
    );
    return { ...f, result };
  });

  const groupId = state.world.clubs.find((c) => c.id === state.player.clubId)?.groupId;
  const results = calendar.filter((f) => f.week === state.week && f.groupId === groupId);
  return {
    state: { ...state, calendar, week: state.week + 1, rngState: rng.getState() },
    report: { week: state.week, results },
  };
}
