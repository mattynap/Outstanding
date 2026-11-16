import { defaultContext, type GameContext } from '../context';
import { Rng } from '../rng';
import { seasonStartWeek, weekOfSeason } from '../time';
import type { Fixture, GameState } from '../types';
import { quickResult } from './quickSim';

export type TransferWindow = 'summer' | 'winter';

export interface WeekReport {
  /** La settimana appena giocata. */
  week: number;
  /** Risultati della settimana nel girone del giocatore. */
  results: Fixture[];
}

/** Vero quando tutte le settimane della stagione sono state giocate: poi va chiamato endSeason. */
export function isSeasonOver(state: GameState, ctx: GameContext = defaultContext): boolean {
  return state.week >= seasonStartWeek(state.season + 1, ctx.config.calendar);
}

/** Finestra di mercato aperta nella settimana corrente, se c'è. */
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

/** La partita del club del giocatore nella settimana corrente, se c'è. */
export function playerFixture(state: GameState): Fixture | undefined {
  const clubId = state.player.clubId;
  if (!clubId) return undefined;
  return state.calendar.find(
    (f) => f.week === state.week && (f.homeId === clubId || f.awayId === clubId),
  );
}

/**
 * Chiude la settimana corrente: simula tutte le partite non giocate e passa alla successiva.
 * Se il club del giocatore gioca questa settimana, la sua partita va prima giocata con playMatch.
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
