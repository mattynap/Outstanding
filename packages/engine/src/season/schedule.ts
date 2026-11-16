import type { CalendarConfig } from '@outstanding/config';
import type { Rng } from '../rng';
import { seasonStartWeek } from '../time';
import type { Fixture, World } from '../types';

/**
 * Girone di sola andata con il metodo del cerchio: n-1 giornate di n/2 coppie [casa, trasferta].
 * La squadra fissa alterna casa e trasferta per bilanciare le partite in casa.
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
      // La squadra fissa alterna casa e trasferta; le altre giocano in casa quando sono nella riga
      // superiore, che ogni squadra che ruota occupa circa metà delle volte.
      pairs.push(i > 0 || r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    rotating = [rotating[rotating.length - 1]!, ...rotating.slice(0, -1)];
  }
  return rounds;
}

/** Settimane assolute per il numero di giornate dato, saltando la sosta invernale. */
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

/** Calendario di andata e ritorno per ogni girone di ogni campionato. */
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
