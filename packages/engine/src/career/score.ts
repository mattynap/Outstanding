import { defaultContext, type GameContext } from '../context';
import type { SeasonRecord } from '../types';

/** Punteggio di carriera diviso per voce, per mostrarlo a fine carriera. */
export interface CareerScore {
  total: number;
  parts: {
    appearances: number;
    goals: number;
    assists: number;
    cleanSheets: number;
    ratings: number;
    trophies: number;
  };
  /** Id della fascia di giudizio (config/career.json); l'ultima è la "leggenda". */
  tierId: string;
  tierKey: string;
}

/** Totali di carriera utili alle schermate e al simulatore. */
export interface CareerTotals {
  seasons: number;
  appearances: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  /** Media voto in carriera (null se nessun voto). */
  averageRating: number | null;
  /** Stagioni con almeno una presenza in massima serie. */
  topLevelSeasons: number;
  /** Età della prima stagione con presenze in massima serie. */
  topLevelDebutAge: number | null;
  trophies: string[];
}

export function careerTotals(history: readonly SeasonRecord[]): CareerTotals {
  let ratingSum = 0;
  let ratingCount = 0;
  const t: CareerTotals = {
    seasons: history.length,
    appearances: 0,
    goals: 0,
    assists: 0,
    cleanSheets: 0,
    averageRating: null,
    topLevelSeasons: 0,
    topLevelDebutAge: null,
    trophies: [],
  };
  for (const r of history) {
    t.appearances += r.stats.appearances;
    t.goals += r.stats.goals;
    t.assists += r.stats.assists;
    t.cleanSheets += r.stats.cleanSheets;
    ratingSum += r.stats.ratingSum;
    ratingCount += r.stats.ratingCount;
    t.trophies.push(...r.trophies);
    if (r.leagueLevel === 1 && r.stats.appearances > 0) {
      t.topLevelSeasons++;
      t.topLevelDebutAge ??= r.age;
    }
  }
  t.averageRating = ratingCount > 0 ? ratingSum / ratingCount : null;
  return t;
}

/**
 * Punteggio di fine carriera: presenze, gol, assist, porte inviolate e voti valgono di più nei
 * campionati più alti; i trofei hanno un valore fisso. Pesi e fasce in config/career.json.
 */
export function careerScore(
  history: readonly SeasonRecord[],
  ctx: GameContext = defaultContext,
): CareerScore {
  const cfg = ctx.config.career;
  const parts = { appearances: 0, goals: 0, assists: 0, cleanSheets: 0, ratings: 0, trophies: 0 };
  for (const r of history) {
    for (const id of r.trophies) parts.trophies += cfg.score.trophies[id] ?? 0;
    if (r.leagueLevel === null) continue;
    const w = cfg.score.perLevel[r.leagueLevel - 1] ?? cfg.score.perLevel.at(-1)!;
    const s = r.stats;
    parts.appearances += s.appearances * w.appearance;
    parts.goals += s.goals * w.goal;
    parts.assists += s.assists * w.assist;
    parts.cleanSheets += s.cleanSheets * w.cleanSheet;
    parts.ratings += (s.ratingSum - cfg.score.baseRating * s.ratingCount) * w.ratingPoint;
  }
  for (const k of Object.keys(parts) as (keyof typeof parts)[]) parts[k] = Math.round(parts[k]);
  const total = Math.max(
    0,
    Object.values(parts).reduce((a, b) => a + b, 0),
  );
  const tier = [...cfg.tiers].reverse().find((t) => total >= t.min) ?? cfg.tiers[0]!;
  return { total, parts, tierId: tier.id, tierKey: `career.tiers.${tier.id}` };
}

/** Vero se il punteggio rientra nella fascia più alta ("leggenda"). */
export function isLegend(score: CareerScore, ctx: GameContext = defaultContext): boolean {
  return score.tierId === ctx.config.career.tiers.at(-1)!.id;
}
