import type { WorldConfig } from '@outstanding/config';
import type { Fixture } from '../types';

export interface StandingRow {
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

/**
 * Classifica di un girone a partire dalle partite giocate.
 * Ordine: punti, differenza reti, gol fatti, poi id del club (stabile e deterministico).
 */
export function computeStandings(
  fixtures: readonly Fixture[],
  clubIds: readonly string[],
  points: WorldConfig['points'],
): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    clubIds.map((clubId) => [
      clubId,
      { clubId, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 },
    ]),
  );
  for (const f of fixtures) {
    if (!f.result) continue;
    const home = rows.get(f.homeId);
    const away = rows.get(f.awayId);
    if (!home || !away) continue;
    const { home: hg, away: ag } = f.result;
    home.played++;
    away.played++;
    home.goalsFor += hg;
    home.goalsAgainst += ag;
    away.goalsFor += ag;
    away.goalsAgainst += hg;
    if (hg > ag) {
      home.won++;
      away.lost++;
      home.points += points.win;
    } else if (hg < ag) {
      away.won++;
      home.lost++;
      away.points += points.win;
    } else {
      home.drawn++;
      away.drawn++;
      home.points += points.draw;
      away.points += points.draw;
    }
  }
  return [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
      b.goalsFor - a.goalsFor ||
      (a.clubId < b.clubId ? -1 : a.clubId > b.clubId ? 1 : 0),
  );
}
