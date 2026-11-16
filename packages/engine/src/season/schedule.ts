import type { CalendarConfig } from '@outstanding/config';
import type { Rng } from '../rng';
import { seasonStartWeek } from '../time';
import type { Fixture, World } from '../types';

/**
 * Single round robin with the circle method: n-1 rounds of n/2 [home, away] pairs.
 * Home/away of the fixed team alternates to keep home games balanced.
 */
export function roundRobin(ids: readonly string[]): [string, string][][] {
  const n = ids.length;
  if (n < 2 || n % 2 !== 0) throw new Error('roundRobin needs an even number of teams');
  const fixed = ids[0]!;
  let rotating = ids.slice(1);
  const rounds: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const lineup = [fixed, ...rotating];
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = lineup[i]!;
      const b = lineup[n - 1 - i]!;
      // The fixed team alternates home and away; the others are home when in the top row,
      // which every rotating team occupies about half of the time.
      pairs.push(i > 0 || r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    rotating = [rotating[rotating.length - 1]!, ...rotating.slice(0, -1)];
  }
  return rounds;
}

/** Absolute weeks of the given number of matchdays, skipping the winter break. */
export function matchdayWeeks(count: number, season: number, cal: CalendarConfig): number[] {
  const start = seasonStartWeek(season, cal);
  const weeks: number[] = [];
  for (let w = cal.firstMatchWeek; weeks.length < count; w++) {
    if (w >= cal.weeksPerSeason) {
      throw new Error(`${count} matchdays do not fit in a ${cal.weeksPerSeason}-week season`);
    }
    if (!cal.winterBreakWeeks.includes(w)) weeks.push(start + w);
  }
  return weeks;
}

/** Double round robin (andata e ritorno) for every group of every league. */
export function buildSeasonCalendar(
  world: World,
  season: number,
  rng: Rng,
  cal: CalendarConfig,
): Fixture[] {
  const fixtures: Fixture[] = [];
  for (const league of world.leagues) {
    for (const group of league.groups) {
      const firstLeg = roundRobin(rng.shuffle(group.clubIds));
      const rounds = [
        ...firstLeg,
        ...firstLeg.map((round) => round.map(([h, a]) => [a, h] as [string, string])),
      ];
      const weeks = matchdayWeeks(rounds.length, season, cal);
      rounds.forEach((round, md) => {
        round.forEach(([homeId, awayId], i) => {
          fixtures.push({
            id: `f${season}-${group.id}-${md + 1}-${i}`,
            season,
            week: weeks[md]!,
            matchday: md + 1,
            leagueId: league.id,
            groupId: group.id,
            homeId,
            awayId,
          });
        });
      });
    }
  }
  return fixtures;
}
