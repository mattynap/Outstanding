import { describe, expect, it } from 'vitest';
import {
  advanceWeek,
  ageAt,
  computeStandings,
  defaultContext,
  deserialize,
  endSeason,
  getTransferWindow,
  isSeasonOver,
  matchdayWeeks,
  newCareer,
  planWeek,
  playerFixture,
  roundRobin,
  serialize,
  simulateMatch,
  type Fixture,
  type GameState,
} from '../src/index';
import { baseOptions } from './fixtures';

const ctx = defaultContext;
const cal = ctx.config.calendar;

/** Gioca le settimane fino a fine stagione; le partite del giocatore finiscono sempre 1-1. */
function playSeason(state: GameState): GameState {
  let s = state;
  while (!isSeasonOver(s)) {
    const own = playerFixture(s);
    if (own && !own.result) {
      s = {
        ...s,
        calendar: s.calendar.map((f) =>
          f.id === own.id ? { ...f, result: { home: 1, away: 1 } } : f,
        ),
      };
    }
    s = advanceWeek(s).state;
  }
  return s;
}

describe('roundRobin', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
  const rounds = roundRobin(ids);

  it('makes every pair meet exactly once, everyone playing each round', () => {
    expect(rounds).toHaveLength(ids.length - 1);
    const pairs = new Set<string>();
    for (const round of rounds) {
      const playing = round.flat();
      expect(new Set(playing).size).toBe(ids.length);
      for (const [h, a] of round) pairs.add([h, a].sort().join('-'));
    }
    expect(pairs.size).toBe((ids.length * (ids.length - 1)) / 2);
  });

  it('balances home games', () => {
    for (const id of ids) {
      const home = rounds.flat().filter(([h]) => h === id).length;
      expect(Math.abs(home - (ids.length - 1 - home))).toBeLessThanOrEqual(1);
    }
  });
});

describe('season calendar', () => {
  const state = newCareer(baseOptions, 31);

  it('schedules a double round robin for every group, skipping the winter break', () => {
    for (const league of state.world.leagues) {
      for (const group of league.groups) {
        const fx = state.calendar.filter((f) => f.groupId === group.id);
        const n = group.clubIds.length;
        expect(fx).toHaveLength(n * (n - 1));
        const counts = new Map<string, number>();
        for (const f of fx)
          counts.set(`${f.homeId}>${f.awayId}`, (counts.get(`${f.homeId}>${f.awayId}`) ?? 0) + 1);
        expect([...counts.values()].every((c) => c === 1)).toBe(true);
        for (const f of fx) {
          expect(cal.winterBreakWeeks).not.toContain(f.week % cal.weeksPerSeason);
          expect(f.week).toBeLessThan(cal.weeksPerSeason);
        }
      }
    }
  });

  it('rejects leagues that do not fit in a season', () => {
    expect(() => matchdayWeeks(60, 1, cal)).toThrow(/do not fit/);
  });

  it('opens the transfer windows on the configured weeks', () => {
    expect(getTransferWindow({ ...state, week: cal.transferWindows.summer.fromWeek })).toBe(
      'summer',
    );
    expect(getTransferWindow({ ...state, week: cal.transferWindows.winter.toWeek })).toBe('winter');
    expect(getTransferWindow({ ...state, week: cal.transferWindows.summer.toWeek + 1 })).toBeNull();
  });
});

describe('standings', () => {
  it('ranks by points, goal difference and goals scored', () => {
    const f = (homeId: string, awayId: string, home: number, away: number): Fixture => ({
      id: `${homeId}${awayId}`,
      season: 1,
      week: 0,
      matchday: 1,
      leagueId: 'L',
      groupId: 'G',
      homeId,
      awayId,
      result: { home, away },
    });
    const table = computeStandings(
      [f('a', 'b', 2, 0), f('c', 'd', 1, 1), f('b', 'c', 3, 0), f('d', 'a', 0, 0)],
      ['a', 'b', 'c', 'd'],
      ctx.config.world.points,
    );
    expect(table.map((r) => r.clubId)).toEqual(['a', 'b', 'd', 'c']);
    expect(table[0]).toMatchObject({ played: 2, won: 1, drawn: 1, points: 4, goalsFor: 2 });
  });
});

describe('weeks and season end', () => {
  const start = newCareer(baseOptions, 77);

  it('requires playMatch when the player has a fixture', () => {
    let s = start;
    while (!playerFixture(s)) s = advanceWeek(s).state;
    expect(() => advanceWeek(s)).toThrow(/playMatch/);
  });

  it('plays all fixtures of a week and advances', () => {
    const s = {
      ...start,
      week: cal.firstMatchWeek,
      player: { ...start.player, clubId: undefined },
    };
    const { state: next } = advanceWeek(s);
    expect(next.week).toBe(s.week + 1);
    const played = next.calendar.filter((f) => f.week === s.week);
    expect(played.length).toBeGreaterThan(0);
    expect(played.every((f) => f.result)).toBe(true);
  });

  const played = playSeason(start);
  const { state: s2, seasonReport } = endSeason(played);

  it('refuses to end a season that is not over', () => {
    expect(() => endSeason(start)).toThrow(/not over/);
  });

  it('keeps every group at its configured size after promotions and relegations', () => {
    for (const levelCfg of ctx.config.world.levels) {
      const league = s2.world.leagues.find((l) => l.level === levelCfg.level)!;
      for (const g of league.groups) {
        expect(g.clubIds).toHaveLength(levelCfg.clubsPerGroup);
        for (const id of g.clubIds)
          expect(s2.world.clubs.find((c) => c.id === id)!.groupId).toBe(g.id);
      }
    }
  });

  it('promotes the top clubs and relegates the bottom ones', () => {
    const levels = ctx.config.world.levels;
    const promoted = seasonReport.movements.filter((m) => m.kind === 'promoted');
    const relegated = seasonReport.movements.filter((m) => m.kind === 'relegated');
    expect(promoted).toHaveLength(levels.reduce((a, l) => a + l.groups * l.promotePerGroup, 0));
    expect(relegated).toHaveLength(levels.reduce((a, l) => a + l.groups * l.relegatePerGroup, 0));
    const l2Champion = seasonReport.champions.find((c) => c.groupId === 'L2')!;
    expect(s2.world.clubs.find((c) => c.id === l2Champion.clubId)!.groupId).toBe('L1');
  });

  it('records the player season and resets the stats', () => {
    expect(s2.season).toBe(2);
    expect(s2.player.history).toHaveLength(1);
    const rec = s2.player.history[0]!;
    expect(rec.clubId).toBe(start.player.clubId);
    expect(rec.leagueLevel).toBe(ctx.config.world.defaultStartLevel);
    expect(rec.leaguePosition).toBeGreaterThan(0);
    expect(seasonReport.standings).toHaveLength(16);
    expect(s2.player.seasonStats.appearances).toBe(0);
  });

  it('builds the next calendar and lets old players retire', () => {
    expect(s2.calendar.every((f) => f.season === 2 && !f.result)).toBe(true);
    const retireAge = ctx.config.world.rosterAging.retireAge;
    const tooOld = s2.world.clubs
      .flatMap((c) => c.roster)
      .filter((r) => ageAt(r.birthWeek, s2.week, cal) > retireAge + 1);
    expect(tooOld).toHaveLength(0);
  });

  it('is deterministic and survives a save/load in the middle of the season', () => {
    const mid: GameState = { ...start, player: { ...start.player, clubId: undefined } };
    let a = mid;
    for (let i = 0; i < 20; i++) a = advanceWeek(a).state;
    let b = deserialize(serialize(a));
    for (let i = 0; i < 10; i++) {
      a = advanceWeek(a).state;
      b = advanceWeek(b).state;
    }
    expect(b).toEqual(a);
  });

  it('stesso seme e stesso WeekPlan: stessa stagione, anche dopo un salvataggio', () => {
    const plan = { load: 'push', focus: 'pace', life: 'leisure' } as const;
    const week = (s: GameState) => {
      let m = planWeek(s, plan).state;
      while (playerFixture(m)) m = simulateMatch(m).state;
      return advanceWeek(m).state;
    };
    let a = start;
    for (let i = 0; i < 15; i++) a = week(a);
    let b = deserialize(serialize(a));
    for (let i = 0; i < 15; i++) {
      a = week(a);
      b = week(b);
    }
    expect(b).toEqual(a);
    expect(a.seasonLoadWeeks.push).toBeGreaterThan(0);
    expect(a.seasonLoadWeeks.rest + a.seasonLoadWeeks.balanced).toBe(0);
    expect(a.lastPlan).toEqual(plan);
  });
});
