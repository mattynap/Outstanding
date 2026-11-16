import type { Club, ClubBase, GameState, League, LeagueGroup, World } from '../types';

export function getClub(world: World, clubId: string): Club {
  const club = world.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error(`Unknown club "${clubId}"`);
  return club;
}

/** Un club qualsiasi, italiano o straniero (per le partite di coppa). */
export function getAnyClub(world: World, clubId: string): ClubBase {
  const club =
    world.clubs.find((c) => c.id === clubId) ?? world.foreignClubs.find((c) => c.id === clubId);
  if (!club) throw new Error(`Unknown club "${clubId}"`);
  return club;
}

/** Forza di tutti i club, italiani e stranieri, indicizzata per id. */
export function clubRatings(world: World): Map<string, number> {
  return new Map([...world.clubs, ...world.foreignClubs].map((c) => [c.id, c.rating]));
}

/** Livello di campionato di un club italiano (undefined per i club stranieri). */
export function levelOfClub(world: World, clubId: string): number | undefined {
  const club = world.clubs.find((c) => c.id === clubId);
  if (!club) return undefined;
  return world.leagues.find((l) => l.groups.some((g) => g.id === club.groupId))?.level;
}

export function getGroup(world: World, groupId: string): { league: League; group: LeagueGroup } {
  for (const league of world.leagues) {
    const group = league.groups.find((g) => g.id === groupId);
    if (group) return { league, group };
  }
  throw new Error(`Unknown group "${groupId}"`);
}

export function getLeagueByLevel(world: World, level: number): League {
  const league = world.leagues.find((l) => l.level === level);
  if (!league) throw new Error(`Unknown league level ${level}`);
  return league;
}

/** Il club del giocatore umano, se sotto contratto. */
export function playerClub(state: GameState): Club | undefined {
  return state.player.clubId ? getClub(state.world, state.player.clubId) : undefined;
}

/** Sostituisce un club senza mutare lo stato. */
export function updateClub(world: World, clubId: string, fn: (c: Club) => Club): World {
  return { ...world, clubs: world.clubs.map((c) => (c.id === clubId ? fn(c) : c)) };
}
