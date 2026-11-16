/** Riepiloghi di carriera condivisi da "Carriera" e "Fine carriera" (funzioni pure). */
import {
  careerScore,
  careerTotals,
  type CareerScore,
  type CareerTotals,
  type GameContext,
  type GameState,
} from '@outstanding/engine';

/** Chiave del nome di un trofeo: "L1" -> nome del campionato, altrimenti nome della coppa. */
export const trophyKey = (id: string): string =>
  /^L\d+$/.test(id) ? `leagues.${id.slice(1)}.name` : `competitions.${id}.name`;

export interface CareerSummary {
  score: CareerScore;
  totals: CareerTotals;
  /** Trofei raggruppati: id e numero di vittorie. */
  cabinet: { id: string; count: number }[];
}

export function careerSummary(s: GameState, ctx: GameContext): CareerSummary {
  const history = s.player.history;
  const totals = careerTotals(history);
  const counts = new Map<string, number>();
  for (const t of totals.trophies) counts.set(t, (counts.get(t) ?? 0) + 1);
  // Prima le coppe europee, poi la coppa nazionale e i campionati dal più importante.
  const order = (id: string) =>
    id.startsWith('continental') ? 0 : /^L\d+$/.test(id) ? Number(id.slice(1)) : 0.5;
  return {
    score: careerScore(history, s.player.role, ctx),
    totals,
    cabinet: [...counts.entries()]
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => order(a.id) - order(b.id)),
  };
}
