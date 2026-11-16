import type { Club, GameState, League, LeagueGroup, World } from '../types';

export function getClub(world: World, clubId: string): Club {
  const club = world.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error(`Unknown club "${clubId}"`);
  return club;
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

/** The club of the human player, if under contract. */
export function playerClub(state: GameState): Club | undefined {
  return state.player.clubId ? getClub(state.world, state.player.clubId) : undefined;
}

/** Replaces one club immutably. */
export function updateClub(world: World, clubId: string, fn: (c: Club) => Club): World {
  return { ...world, clubs: world.clubs.map((c) => (c.id === clubId ? fn(c) : c)) };
}
