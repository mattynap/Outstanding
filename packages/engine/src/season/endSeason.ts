import type { LevelConfig } from '@outstanding/config';
import { defaultContext, type GameContext } from '../context';
import { emptySeasonStats } from '../player/create';
import { applyDecline } from '../player/progression';
import { computeOvr } from '../player/ratings';
import { Rng } from '../rng';
import { ageAt } from '../time';
import type { Area, Club, GameState, League, RosterPlayer, SeasonRecord } from '../types';
import { clamp } from '../util';
import { clubRatingFromRoster } from '../world/club';
import { IdGen } from '../world/generate';
import { buildSeasonCalendar } from './schedule';
import { computeStandings, type StandingRow } from './standings';
import { isSeasonOver } from './week';

export interface ClubMovement {
  clubId: string;
  fromGroupId: string;
  toGroupId: string;
  kind: 'promoted' | 'relegated';
}

export interface SeasonReport {
  season: number;
  /** La stagione del giocatore, aggiunta anche a player.history. */
  record: SeasonRecord;
  /** Classifica finale del girone del giocatore (vuota se il giocatore era senza club). */
  standings: StandingRow[];
  /** Vincitrice di ogni girone. */
  champions: { leagueId: string; groupId: string; clubId: string }[];
  movements: ClubMovement[];
}

/** Aree ordinate per vicinanza geografica, usate quando un girone è pieno. */
const AREA_ORDER: readonly Area[] = ['N', 'C', 'S'];

/**
 * Suddivide i club di un livello nei suoi gironi: chi resta mantiene il proprio girone, gli altri
 * vanno nel girone della propria area o, se pieno, nel girone più vicino con posti liberi.
 */
function assignGroups(
  league: League,
  levelCfg: LevelConfig,
  stayers: Map<string, string>,
  incoming: Club[],
): Map<string, string> {
  const result = new Map<string, string>();
  const counts = new Map(league.groups.map((g) => [g.id, 0]));
  for (const [clubId, gid] of stayers) {
    result.set(clubId, gid);
    counts.set(gid, (counts.get(gid) ?? 0) + 1);
  }
  for (const club of incoming) {
    const byDistance = [...league.groups].sort((a, b) => {
      const d = (g: typeof a) =>
        g.area ? Math.abs(AREA_ORDER.indexOf(g.area) - AREA_ORDER.indexOf(club.area)) : 0;
      return d(a) - d(b);
    });
    const target = byDistance.find((g) => (counts.get(g.id) ?? 0) < levelCfg.clubsPerGroup);
    if (!target) throw new Error(`No room in level ${league.level} for club ${club.id}`);
    result.set(club.id, target.id);
    counts.set(target.id, (counts.get(target.id) ?? 0) + 1);
  }
  return result;
}

/** Invecchia le rose: crescita/declino per età, ritirati sostituiti da giovani, avvicinamento al livello. */
function evolveRoster(
  club: Club,
  levelCfg: LevelConfig,
  week: number,
  rng: Rng,
  ids: IdGen,
  ctx: GameContext,
): Club {
  const { rosterAging: aging, roster: rosterCfg, formation } = ctx.config.world;
  const { names } = ctx.content;
  const weeksPerYear = ctx.config.calendar.weeksPerSeason;
  const mid = (levelCfg.ratingRange[0] + levelCfg.ratingRange[1]) / 2;
  const pull = aging.levelPull * (mid - club.rating);

  const roster: RosterPlayer[] = club.roster.map((p) => {
    const age = ageAt(p.birthWeek, week, ctx.config.calendar);
    if (age > aging.retireAge) {
      const youthAge = rng.int(aging.youthAgeRange[0], aging.youthAgeRange[1]);
      return {
        id: ids.make('r'),
        firstName: rng.pick(names.firstNames),
        lastName: rng.pick(names.lastNames),
        role: p.role,
        birthWeek: week - youthAge * weeksPerYear - rng.int(0, weeksPerYear - 1),
        ovr: Math.round(clamp(rng.normal(mid, rosterCfg.ovrSpread), 1, 99)),
      };
    }
    const band = aging.growthByAge.find((b) => age <= b.maxAge) ?? aging.growthByAge.at(-1)!;
    const ovr = p.ovr + band.delta + pull + rng.normal(0, aging.noise);
    return { ...p, ovr: Math.round(clamp(ovr, 1, 99)) };
  });
  return { ...club, roster, rating: clubRatingFromRoster(roster, formation) };
}

/**
 * Chiude la stagione: classifiche finali, promozioni e retrocessioni, evoluzione delle rose,
 * storico del giocatore e calendario della stagione successiva.
 */
export function endSeason(
  state: GameState,
  ctx: GameContext = defaultContext,
): { state: GameState; seasonReport: SeasonReport } {
  if (!isSeasonOver(state, ctx)) throw new Error('The season is not over yet');
  const cfg = ctx.config;
  const rng = Rng.fromState(state.rngState);
  const ids = new IdGen(state.nextId);
  const clubsById = new Map(state.world.clubs.map((c) => [c.id, c]));
  const seasonFixtures = state.calendar.filter((f) => f.season === state.season);

  // 1. Classifiche finali.
  const tables = new Map<string, StandingRow[]>();
  const champions: SeasonReport['champions'] = [];
  for (const league of state.world.leagues) {
    for (const group of league.groups) {
      const table = computeStandings(
        seasonFixtures.filter((f) => f.groupId === group.id),
        group.clubIds,
        cfg.world.points,
      );
      tables.set(group.id, table);
      champions.push({ leagueId: league.id, groupId: group.id, clubId: table[0]!.clubId });
    }
  }

  // 2. Promozioni e retrocessioni.
  const movements: ClubMovement[] = [];
  const moving = new Map<string, number>(); // clubId -> nuovo livello
  for (const league of state.world.leagues) {
    const levelCfg = cfg.world.levels.find((l) => l.level === league.level)!;
    for (const group of league.groups) {
      const table = tables.get(group.id)!;
      table.slice(0, levelCfg.promotePerGroup).forEach((row) => {
        moving.set(row.clubId, league.level - 1);
        movements.push({
          clubId: row.clubId,
          fromGroupId: group.id,
          toGroupId: '',
          kind: 'promoted',
        });
      });
      if (levelCfg.relegatePerGroup > 0) {
        table.slice(-levelCfg.relegatePerGroup).forEach((row) => {
          moving.set(row.clubId, league.level + 1);
          movements.push({
            clubId: row.clubId,
            fromGroupId: group.id,
            toGroupId: '',
            kind: 'relegated',
          });
        });
      }
    }
  }

  // 3. Nuova composizione dei gironi, livello per livello.
  const newGroupOf = new Map<string, string>();
  for (const league of state.world.leagues) {
    const levelCfg = cfg.world.levels.find((l) => l.level === league.level)!;
    const stayers = new Map<string, string>();
    for (const group of league.groups) {
      for (const id of group.clubIds) if (!moving.has(id)) stayers.set(id, group.id);
    }
    const incoming = [...moving.entries()]
      .filter(([, level]) => level === league.level)
      .map(([id]) => clubsById.get(id)!);
    for (const [clubId, gid] of assignGroups(league, levelCfg, stayers, incoming)) {
      newGroupOf.set(clubId, gid);
    }
  }
  for (const m of movements) m.toGroupId = newGroupOf.get(m.clubId)!;

  const leagues: League[] = state.world.leagues.map((league) => ({
    ...league,
    groups: league.groups.map((g) => ({
      ...g,
      clubIds: state.world.clubs.filter((c) => newGroupOf.get(c.id) === g.id).map((c) => c.id),
    })),
  }));
  const levelOfGroup = new Map(leagues.flatMap((l) => l.groups.map((g) => [g.id, l.level])));

  // 4. Le rose cambiano durante l'estate.
  const clubs = state.world.clubs.map((club) => {
    const gid = newGroupOf.get(club.id)!;
    const levelCfg = cfg.world.levels.find((l) => l.level === levelOfGroup.get(gid))!;
    return evolveRoster({ ...club, groupId: gid }, levelCfg, state.week, rng, ids, ctx);
  });

  // 5. Riepilogo stagionale del giocatore.
  const p = state.player;
  const oldClub = p.clubId ? clubsById.get(p.clubId) : undefined;
  const oldTable = oldClub ? tables.get(oldClub.groupId) : undefined;
  const position = oldClub && oldTable ? oldTable.findIndex((r) => r.clubId === oldClub.id) + 1 : 0;
  const move = movements.find((m) => m.clubId === oldClub?.id);
  const record: SeasonRecord = {
    season: state.season,
    age: ageAt(p.birthWeek, state.week - 1, cfg.calendar),
    clubId: oldClub?.id ?? null,
    leagueLevel: oldClub
      ? (state.world.leagues.find((l) => l.groups.some((g) => g.id === oldClub.groupId))?.level ??
        null)
      : null,
    ovr: computeOvr(p.skills, p.role, cfg.ratings),
    stats: p.seasonStats,
    leaguePosition: position || null,
    promoted: move?.kind === 'promoted',
    relegated: move?.kind === 'relegated',
  };
  // Regola temporanea finché i contratti non si negoziano (M7): quelli in scadenza si rinnovano da soli.
  let contract = p.contract;
  if (contract && p.clubId) {
    const newLevel = levelOfGroup.get(newGroupOf.get(p.clubId)!)!;
    const professional = cfg.world.levels.find((l) => l.level === newLevel)!.professional;
    contract = {
      ...contract,
      untilSeason: Math.max(contract.untilSeason, state.season + 1),
      amateur: !professional,
    };
  }

  const world = { ...state.world, leagues, clubs };
  const nextSeason = state.season + 1;
  const calendar = buildSeasonCalendar(world, nextSeason, rng, cfg.calendar);

  const next: GameState = {
    ...state,
    season: nextSeason,
    world,
    calendar,
    player: {
      ...applyDecline(p, record.age, ctx),
      ...(contract ? { contract } : {}),
      seasonStats: emptySeasonStats(),
      history: [...p.history, record],
    },
    rngState: rng.getState(),
    nextId: ids.next,
  };

  return {
    state: next,
    seasonReport: {
      season: state.season,
      record,
      standings: oldTable ?? [],
      champions,
      movements,
    },
  };
}
