import { defaultContext, type GameContext } from '../context';
import { Rng } from '../rng';
import { seasonStartWeek, weekOfSeason } from '../time';
import type { Fixture, GameState } from '../types';
import { applyWeeklyWealth, type WealthWeek } from '../finance/finance';
import { applyWeeklyPrivate, type PrivateWeek } from '../private/private';
import { applyWeeklyFinances, type WeekFinance } from '../market/life';
import { refreshMarket } from '../market/offers';
import { weeklyRecovery } from '../player/condition';
import { progressCups, settleKnockout } from '../cups/cups';
import { clubRatings } from '../world/queries';
import { quickResult } from './quickSim';

export type TransferWindow = 'summer' | 'winter';

export interface WeekReport {
  /** La settimana appena giocata. */
  week: number;
  /** Risultati della settimana nel girone del giocatore. */
  results: Fixture[];
  /** Risultati della settimana nelle coppe a cui partecipa il club del giocatore. */
  cupResults: Fixture[];
  /** Entrate e uscite della settimana. */
  finance: WeekFinance;
  /** Movimenti del patrimonio: interessi, mantenimento, rate, attività. */
  wealth: WealthWeek;
  /** Vita privata: spese per i figli, assegni, nascite, separazioni. */
  private: PrivateWeek;
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

/**
 * Tutte le partite del club del giocatore nella settimana corrente: campionato e, nelle settimane
 * infrasettimanali, coppa.
 */
export function playerFixtures(state: GameState): Fixture[] {
  const clubId = state.player.clubId;
  if (!clubId) return [];
  return state.calendar.filter(
    (f) => f.week === state.week && (f.homeId === clubId || f.awayId === clubId),
  );
}

/** La prossima partita ancora da giocare del club del giocatore in questa settimana, se c'è. */
export function playerFixture(state: GameState): Fixture | undefined {
  return playerFixtures(state).find((f) => !f.result);
}

/**
 * Chiude la settimana corrente: simula tutte le partite non giocate e passa alla successiva.
 * Se il club del giocatore gioca questa settimana, la sua partita va prima giocata con playMatch.
 */
export function advanceWeek(
  state: GameState,
  ctx: GameContext = defaultContext,
): { state: GameState; report: WeekReport } {
  if (state.retired) throw new Error('The career is over');
  if (isSeasonOver(state, ctx)) throw new Error('Season is over: call endSeason');
  if (state.pendingEvents.length > 0) throw new Error('Pending events: call resolveEvent');
  if (playerFixture(state)) throw new Error('The player has a match this week: call playMatch');

  const rng = Rng.fromState(state.rngState);
  const ratings = clubRatings(state.world);
  let calendar = state.calendar;
  // Si simula in ordine: per il ritorno di una sfida serve il risultato dell'andata.
  calendar = calendar.map((f) => {
    if (f.week !== state.week || f.result) return f;
    const result = quickResult(
      ratings.get(f.homeId) ?? 0,
      ratings.get(f.awayId) ?? 0,
      rng,
      ctx.config.match.quickSim,
      f.cup?.neutral ?? false,
    );
    return settleKnockout({ ...f, result }, state.calendar, ratings, rng, ctx);
  });
  const cupsProgress = progressCups({ ...state, calendar }, rng, ctx);
  calendar = [...calendar, ...cupsProgress.fixtures];

  const clubId = state.player.clubId;
  const groupId = state.world.clubs.find((c) => c.id === clubId)?.groupId;
  const results = calendar.filter((f) => f.week === state.week && f.groupId === groupId);
  const playerCups = new Set(
    state.cups.filter((c) => clubId && c.participants.includes(clubId)).map((c) => c.competitionId),
  );
  const cupResults = calendar.filter(
    (f) => f.week === state.week && f.cup && playerCups.has(f.cup.competitionId),
  );
  const { player, finance } = applyWeeklyFinances(
    weeklyRecovery(state.player, ctx),
    state.world.npcs,
    ctx,
  );
  const wealthStep = applyWeeklyWealth({ ...state, player }, rng, ctx);
  const privateStep = applyWeeklyPrivate(wealthStep.state, rng, ctx);
  let next: GameState = {
    ...privateStep.state,
    calendar,
    cups: cupsProgress.cups,
    week: state.week + 1,
    rngState: rng.getState(),
  };
  // Il mercato della settimana nuova; a stagione finita ci pensa endSeason.
  if (!isSeasonOver(next, ctx)) next = refreshMarket(next, ctx);
  return {
    state: next,
    report: {
      week: state.week,
      results,
      cupResults,
      finance,
      wealth: wealthStep.wealth,
      private: privateStep.week,
    },
  };
}
