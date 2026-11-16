import { defaultContext, type GameContext } from './context';
import { createPlayer, type NewPlayerOptions } from './player/create';
import { Rng } from './rng';
import { CURRENT_SAVE_VERSION } from './save/serialize';
import type { GameState, Player, World } from './types';
import { generateWorld, groupId, IdGen } from './world/generate';
import { getGroup } from './world/queries';

export interface NewCareerOptions extends NewPlayerOptions {
  /** League level where the career starts (one of `config.world.startLevels`). */
  startLevel?: number;
}

/** Finds the content city matching the player's hometown (case-insensitive). */
function resolveHometown(hometown: string, ctx: GameContext) {
  const wanted = hometown.trim().toLocaleLowerCase('it');
  const city = ctx.content.cities.find((c) => c.name.toLocaleLowerCase('it') === wanted);
  if (!city) throw new Error(`Unknown hometown "${hometown}"`);
  return city;
}

/**
 * Picks the first club: a team of the start level in the player's area, preferably from the
 * hometown itself.
 */
function signFirstClub(
  player: Player,
  world: World,
  startLevel: number,
  season: number,
  rng: Rng,
  ctx: GameContext,
): Player {
  const levelCfg = ctx.config.world.levels.find((l) => l.level === startLevel);
  if (!levelCfg) throw new Error(`Unknown start level ${startLevel}`);
  const city = resolveHometown(player.hometown, ctx);
  const area = levelCfg.areas.includes(city.area) ? city.area : (levelCfg.areas[0] ?? null);
  const { group } = getGroup(world, groupId(startLevel, area));
  const clubs = group.clubIds.map((id) => world.clubs.find((c) => c.id === id)!);
  const local = clubs.filter((c) => c.city === city.name);
  const club = rng.pick(local.length > 0 ? local : clubs);

  const eco = ctx.config.economy.startContract;
  const salaryWeekly = rng.int(eco.salaryWeekly[0], eco.salaryWeekly[1]);
  return {
    ...player,
    hometown: city.name,
    clubId: club.id,
    contract: {
      clubId: club.id,
      salaryWeekly,
      untilSeason: season + eco.seasons - 1,
      amateur: !levelCfg.professional,
    },
    money: { ...player.money, salaryWeekly },
    relationships: {
      ...player.relationships,
      [club.coachId]: ctx.config.economy.initialCoachRelationship,
    },
  };
}

/** Starts a new career. Same options + same seed always produce the same state. */
export function newCareer(
  options: NewCareerOptions,
  seed: number,
  ctx: GameContext = defaultContext,
): GameState {
  const startLevel = options.startLevel ?? ctx.config.world.defaultStartLevel;
  if (!ctx.config.world.startLevels.includes(startLevel)) {
    throw new Error(`Start level ${startLevel} is not allowed`);
  }
  resolveHometown(options.hometown, ctx);

  const normalizedSeed = seed >>> 0;
  const rng = Rng.fromSeed(normalizedSeed);
  const ids = new IdGen(1);
  const week = 0;
  const season = 1;

  let player = createPlayer(options, 'p0', rng, ctx);
  const world = generateWorld(rng, ids, week, ctx);
  player = signFirstClub(player, world, startLevel, season, rng, ctx);

  return {
    saveVersion: CURRENT_SAVE_VERSION,
    seed: normalizedSeed,
    rngState: rng.getState(),
    week,
    season,
    player,
    world,
    calendar: [],
    eventLog: [],
    cooldowns: {},
    scheduled: [],
    nextId: ids.next,
  };
}
