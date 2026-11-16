/**
 * Viste di sola lettura sullo stato del gioco per le schermate. Funzioni pure: niente Angular,
 * così si testano con Vitest.
 */
import {
  ageAt,
  computeStandings,
  getAnyClub,
  playerFixtures,
  weekOfSeason,
  type ClubBase,
  type Fixture,
  type GameContext,
  type GameState,
  type Side,
  type StandingRow,
} from '@outstanding/engine';

export const playerAge = (s: GameState, ctx: GameContext): number =>
  ageAt(s.player.birthWeek, s.week, ctx.config.calendar);

/** Settimana della stagione da 1 (più leggibile della settimana assoluta). */
export const seasonWeekNumber = (s: GameState, ctx: GameContext): number =>
  weekOfSeason(s.week, ctx.config.calendar) + 1;

export interface ClubInfo {
  club: ClubBase;
  level: number;
  leagueKey: string;
  groupKey: string;
  groupId: string;
  /** Posizione attuale nel girone (1 = primo). */
  position: number;
  table: StandingRow[];
}

/** Classifica attuale di un girone di campionato. */
export function groupTable(s: GameState, groupId: string, ctx: GameContext): StandingRow[] {
  for (const league of s.world.leagues) {
    const group = league.groups.find((g) => g.id === groupId);
    if (group) {
      return computeStandings(
        s.calendar.filter((f) => f.season === s.season && f.groupId === groupId),
        group.clubIds,
        ctx.config.world.points,
      );
    }
  }
  return [];
}

/** Club del giocatore con campionato, girone e posizione; undefined da svincolato. */
export function clubInfo(
  s: GameState,
  ctx: GameContext,
  clubId = s.player.clubId,
): ClubInfo | null {
  if (!clubId) return null;
  const club = s.world.clubs.find((c) => c.id === clubId);
  if (!club) return null;
  const league = s.world.leagues.find((l) => l.groups.some((g) => g.id === club.groupId))!;
  const group = league.groups.find((g) => g.id === club.groupId)!;
  const table = groupTable(s, group.id, ctx);
  return {
    club,
    level: league.level,
    leagueKey: league.nameKey,
    groupKey: group.nameKey,
    groupId: group.id,
    position: table.findIndex((r) => r.clubId === club.id) + 1,
    table,
  };
}

export interface FixtureView {
  fixture: Fixture;
  home: ClubBase;
  away: ClubBase;
  /** Lato del club del giocatore. */
  side: Side;
  opponent: ClubBase;
  /** Chiave del nome della competizione (campionato o coppa). */
  competitionKey: string;
  /** Chiave della fase di coppa, se è una partita di coppa. */
  stageKey: string | null;
  /** Posizione in classifica dell'avversario (solo campionato). */
  opponentPosition: number | null;
  /** Settimane che mancano (0 = questa settimana). */
  inWeeks: number;
}

export function fixtureView(s: GameState, f: Fixture, ctx: GameContext): FixtureView {
  const own = s.player.clubId;
  const side: Side = f.homeId === own ? 'home' : 'away';
  const home = getAnyClub(s.world, f.homeId);
  const away = getAnyClub(s.world, f.awayId);
  const opponent = side === 'home' ? away : home;
  let competitionKey: string;
  let opponentPosition: number | null = null;
  if (f.cup) {
    competitionKey = `competitions.${f.cup.competitionId}.name`;
  } else {
    competitionKey = s.world.leagues.find((l) => l.id === f.leagueId)?.nameKey ?? f.leagueId;
    const table = groupTable(s, f.groupId, ctx);
    const pos = table.findIndex((r) => r.clubId === opponent.id);
    opponentPosition = pos >= 0 ? pos + 1 : null;
  }
  return {
    fixture: f,
    home,
    away,
    side,
    opponent,
    competitionKey,
    stageKey: f.cup ? `cups.stages.${f.cup.stage}` : null,
    opponentPosition,
    inWeeks: f.week - s.week,
  };
}

/** Prossima partita da giocare del club del giocatore (questa settimana o più avanti). */
export function upcomingFixture(s: GameState): Fixture | undefined {
  const own = s.player.clubId;
  if (!own) return undefined;
  const thisWeek = playerFixtures(s).find((f) => !f.result);
  if (thisWeek) return thisWeek;
  return s.calendar
    .filter((f) => f.week > s.week && !f.result && (f.homeId === own || f.awayId === own))
    .sort((a, b) => a.week - b.week)[0];
}

/** Risultato dal punto di vista del giocatore, contando supplementari e rigori nelle coppe. */
export function outcomeFor(f: Fixture, clubId: string): 'win' | 'draw' | 'loss' | null {
  if (!f.result) return null;
  const mine = f.homeId === clubId ? 'home' : 'away';
  const theirs = mine === 'home' ? 'away' : 'home';
  const goals = (x: 'home' | 'away') => f.result![x] + (f.extraTime?.[x] ?? 0);
  if (goals(mine) !== goals(theirs)) return goals(mine) > goals(theirs) ? 'win' : 'loss';
  if (f.penalties) return f.penalties[mine] > f.penalties[theirs] ? 'win' : 'loss';
  return 'draw';
}
