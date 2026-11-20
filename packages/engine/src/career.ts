import { defaultContext, type GameContext } from './context';
import { createPlayer, type NewPlayerOptions } from './player/create';
import { Rng } from './rng';
import { CURRENT_SAVE_VERSION } from './save/serialize';
import { setupSeasonCups } from './cups/cups';
import { createFinance } from './finance/finance';
import { createPrivateLife } from './private/private';
import { createMedia } from './media/media';
import { blankChapter, createChapter } from './season/director';
import { buildSeasonCalendar } from './season/schedule';
import type { Difficulty, GameState, Interest, Player, World } from './types';
import { generateWorld, groupId, IdGen } from './world/generate';
import { getGroup, getLeagueByLevel } from './world/queries';

export interface NewCareerOptions extends NewPlayerOptions {
  /** Livello di campionato in cui inizia la carriera (uno di `config.world.startLevels`). */
  startLevel?: number;
  /** Difficoltà della carriera (predefinita: `config.difficulty.default`). */
  difficulty?: Difficulty;
  /** Da chi è attratto il giocatore (predefinito: `config.private.defaultInterest`). */
  interest?: Interest;
}

/** Trova la città dei contenuti corrispondente a quella natale del giocatore (senza distinguere maiuscole). */
function resolveHometown(hometown: string, ctx: GameContext) {
  const wanted = hometown.trim().toLocaleLowerCase('it');
  const city = ctx.content.cities.find((c) => c.name.toLocaleLowerCase('it') === wanted);
  if (!city) throw new Error(`Unknown hometown "${hometown}"`);
  return city;
}

/**
 * Sceglie il primo club: una squadra del livello iniziale nell'area del giocatore, preferibilmente
 * della sua stessa città natale.
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

/** Avvia una nuova carriera. Stesse opzioni + stesso seme producono sempre lo stesso stato. */
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
  const leagueFixtures = buildSeasonCalendar(world, season, rng, ctx.config.calendar);
  // Prima stagione: senza una classifica precedente, alle coppe europee vanno i club più forti.
  const rating = new Map(world.clubs.map((c) => [c.id, c.rating]));
  const ranking = getLeagueByLevel(world, 1)
    .groups.flatMap((g) => g.clubIds)
    .sort((a, b) => rating.get(b)! - rating.get(a)! || (a < b ? -1 : 1));
  const cups = setupSeasonCups(world, season, ranking, undefined, rng, ctx);

  const base: GameState = {
    saveVersion: CURRENT_SAVE_VERSION,
    seed: normalizedSeed,
    rngState: rng.getState(),
    week,
    season,
    player,
    world,
    calendar: [...leagueFixtures, ...cups.fixtures],
    cups: cups.cups,
    eventLog: [],
    cooldowns: {},
    scheduled: [],
    pendingEvents: [],
    eventsWeek: -1,
    transferRequests: [],
    plannedWeek: -1,
    offers: [],
    sponsorOffers: [],
    marketWeek: -1,
    nextId: ids.next,
    difficulty: options.difficulty ?? ctx.config.difficulty.default,
    finance: createFinance(ctx),
    privateLife: createPrivateLife(options.interest, ctx),
    media: createMedia(),
    chapter: blankChapter('preseason'),
    chapterPlan: null,
    seasonLoadWeeks: { rest: 0, balanced: 0, push: 0 },
  };
  return { ...base, chapter: createChapter(base, ctx) };
}
