import type { City } from '@outstanding/content';
import type { GameContext } from '../context';
import type { Rng } from '../rng';
import type { Club, Competition, League, LeagueGroup, Npc, World } from '../types';
import { clubRatingFromRoster, clubVisuals, generateRoster, pickClubName } from './club';

export const leagueId = (level: number) => `L${level}`;
export const groupId = (level: number, area: string | null) => `L${level}${area ?? ''}`;

export const COMPETITIONS: readonly Competition[] = [
  { id: 'national_cup', nameKey: 'competitions.national_cup.name', kind: 'nationalCup' },
  {
    id: 'continental_major',
    nameKey: 'competitions.continental_major.name',
    kind: 'continentalCup',
  },
  {
    id: 'continental_minor',
    nameKey: 'competitions.continental_minor.name',
    kind: 'continentalCup',
  },
];

/** Generatore di id crescenti basato su GameState.nextId. */
export class IdGen {
  constructor(public next: number) {}
  make(prefix: string): string {
    return `${prefix}${this.next++}`;
  }
}

/**
 * Genera la piramide calcistica italiana fittizia: campionati, gironi per area, club con città reali
 * e nomi inventati, rose, allenatori e procuratori.
 */
export function generateWorld(rng: Rng, ids: IdGen, week: number, ctx: GameContext): World {
  const { world: cfg, calendar } = ctx.config;
  const { cities, clubs: clubsData, names } = ctx.content;
  const usedNames = new Set<string>();
  const usedShortNames = new Set<string>();

  const clubs: Club[] = [];
  const leagues: League[] = [];
  const npcs: Npc[] = [];

  for (const levelCfg of cfg.levels) {
    const groups: LeagueGroup[] = [];
    for (let g = 0; g < levelCfg.groups; g++) {
      const area = levelCfg.areas[g] ?? null;
      const gid = groupId(levelCfg.level, area);
      const candidates = cities.filter((c) => area === null || c.area === area);
      const perCity = new Map<string, number>();
      const group: LeagueGroup = {
        id: gid,
        nameKey: area ? `groups.${area}` : 'groups.single',
        area,
        clubIds: [],
      };

      for (let i = 0; i < levelCfg.clubsPerGroup; i++) {
        const weightOf = (c: City) =>
          (perCity.get(c.name) ?? 0) >= cfg.maxClubsPerCityPerGroup
            ? 0
            : (levelCfg.citySizeWeights[c.size - 1] ?? 0);
        const city = candidates.some((c) => weightOf(c) > 0)
          ? rng.weighted(candidates, weightOf)
          : rng.pick(candidates);
        perCity.set(city.name, (perCity.get(city.name) ?? 0) + 1);

        const { name, shortName, initials } = pickClubName(
          city,
          clubsData,
          usedNames,
          usedShortNames,
          rng,
        );
        const seed = rng.nextUint32();
        const { crest, kit } = clubVisuals(seed, initials, clubsData, cfg.kitPatternWeights);
        const target = rng.float(levelCfg.ratingRange[0], levelCfg.ratingRange[1]);
        const roster = generateRoster(
          target,
          cfg,
          names.firstNames,
          names.lastNames,
          calendar.weeksPerSeason,
          week,
          rng,
          () => ids.make('r'),
        );
        const clubId = ids.make('c');
        const coach: Npc = {
          id: ids.make('n'),
          role: 'coach',
          firstName: rng.pick(names.firstNames),
          lastName: rng.pick(names.lastNames),
          clubId,
        };
        npcs.push(coach);
        clubs.push({
          id: clubId,
          name,
          shortName,
          city: city.name,
          area: city.area,
          seed,
          crest,
          kit,
          rating: clubRatingFromRoster(roster, cfg.formation),
          roster,
          coachId: coach.id,
          groupId: gid,
        });
        group.clubIds.push(clubId);
      }
      groups.push(group);
    }
    leagues.push({
      id: leagueId(levelCfg.level),
      level: levelCfg.level,
      nameKey: `leagues.${levelCfg.level}.name`,
      professional: levelCfg.professional,
      groups,
    });
  }

  for (let i = 0; i < cfg.agents; i++) {
    npcs.push({
      id: ids.make('n'),
      role: 'agent',
      firstName: rng.pick(names.firstNames),
      lastName: rng.pick(names.lastNames),
    });
  }

  return { clubs, leagues, competitions: [...COMPETITIONS], npcs };
}
