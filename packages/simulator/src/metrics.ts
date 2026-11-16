import type { GameContext, Role } from '@outstanding/engine';
import type { CareerResult } from './run';

export interface GroupMetrics {
  careers: number;
  /** % di carriere con almeno una presenza in massima serie. */
  reachedTopPct: number;
  /** Età media dell'esordio in massima serie (solo chi ci arriva). */
  topDebutAge: number | null;
  topLevelSeasons: number;
  appearances: number;
  goals: number;
  assists: number;
  averageRating: number | null;
  peakOvr: number;
  /** Trofei medi per carriera e % di carriere con almeno un trofeo. */
  trophies: number;
  withTrophyPct: number;
  /** Trofei medi per carriera, per tipo (id del campionato o della coppa). */
  trophiesById: Record<string, number>;
  retirementAge: number;
  retirementReasonsPct: Record<string, number>;
  score: number;
  /** % di carriere per fascia di giudizio (l'ultima è la leggenda). */
  tiersPct: Record<string, number>;
  legendPct: number;
  /** Minuti di gioco stimati per carriera. */
  playMinutes: number;
  seasons: number;
}

export interface SimSummary {
  strategy: string;
  seed: number;
  careers: number;
  overall: GroupMetrics;
  byRole: Record<Role, GroupMetrics>;
}

const avg = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (n: number, total: number) => (total ? (100 * n) / total : 0);
const round = (x: number, digits = 1) => Math.round(x * 10 ** digits) / 10 ** digits;

function countBy(keys: readonly string[], total: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of keys) out[k] = (out[k] ?? 0) + 1;
  for (const k of Object.keys(out)) out[k] = round(pct(out[k]!, total));
  return out;
}

export function groupMetrics(results: readonly CareerResult[], ctx: GameContext): GroupMetrics {
  const n = results.length;
  const top = results.filter((r) => r.totals.topLevelDebutAge !== null);
  const ratings = results.flatMap((r) =>
    r.totals.averageRating === null ? [] : [r.totals.averageRating],
  );
  const trophiesById: Record<string, number> = {};
  for (const r of results) {
    for (const t of r.totals.trophies) trophiesById[t] = (trophiesById[t] ?? 0) + 1;
  }
  for (const k of Object.keys(trophiesById)) trophiesById[k] = round(trophiesById[k]! / n, 2);
  const tiersPct = countBy(
    results.map((r) => r.score.tierId),
    n,
  );
  for (const t of ctx.config.career.tiers) tiersPct[t.id] ??= 0;
  return {
    careers: n,
    reachedTopPct: round(pct(top.length, n)),
    topDebutAge: top.length ? round(avg(top.map((r) => r.totals.topLevelDebutAge!))) : null,
    topLevelSeasons: round(avg(results.map((r) => r.totals.topLevelSeasons))),
    appearances: round(avg(results.map((r) => r.totals.appearances))),
    goals: round(avg(results.map((r) => r.totals.goals))),
    assists: round(avg(results.map((r) => r.totals.assists))),
    averageRating: ratings.length ? round(avg(ratings), 2) : null,
    peakOvr: round(avg(results.map((r) => r.peakOvr))),
    trophies: round(avg(results.map((r) => r.totals.trophies.length)), 2),
    withTrophyPct: round(pct(results.filter((r) => r.totals.trophies.length > 0).length, n)),
    trophiesById,
    retirementAge: round(avg(results.map((r) => r.retirement.age))),
    retirementReasonsPct: countBy(
      results.map((r) => r.retirement.reason),
      n,
    ),
    score: Math.round(avg(results.map((r) => r.score.total))),
    tiersPct,
    legendPct: round(pct(results.filter((r) => r.legend).length, n), 2),
    playMinutes: Math.round(avg(results.map((r) => r.playMinutes))),
    seasons: round(avg(results.map((r) => r.totals.seasons))),
  };
}

export function summarize(
  results: readonly CareerResult[],
  strategy: string,
  seed: number,
  ctx: GameContext,
): SimSummary {
  const byRole = {} as Record<Role, GroupMetrics>;
  for (const role of ['GK', 'DEF', 'MID', 'ATT'] as const) {
    byRole[role] = groupMetrics(
      results.filter((r) => r.role === role),
      ctx,
    );
  }
  return {
    strategy,
    seed,
    careers: results.length,
    overall: groupMetrics(results, ctx),
    byRole,
  };
}

/** Tabella leggibile in console: una colonna per il totale e una per ruolo. */
export function formatTable(summary: SimSummary): string {
  const cols: [string, GroupMetrics][] = [
    ['Totale', summary.overall],
    ...(Object.entries(summary.byRole) as [string, GroupMetrics][]),
  ];
  const fmt = (v: number | null, suffix = '') => (v === null ? '–' : `${v}${suffix}`);
  const rows: [string, (m: GroupMetrics) => string][] = [
    ['Carriere', (m) => fmt(m.careers)],
    ['Arrivano in massima serie', (m) => fmt(m.reachedTopPct, '%')],
    ['Età esordio in massima serie', (m) => fmt(m.topDebutAge)],
    ['Stagioni in massima serie', (m) => fmt(m.topLevelSeasons)],
    ['Presenze', (m) => fmt(m.appearances)],
    ['Gol', (m) => fmt(m.goals)],
    ['Assist', (m) => fmt(m.assists)],
    ['Media voto', (m) => fmt(m.averageRating)],
    ['OVR massimo', (m) => fmt(m.peakOvr)],
    ['Trofei', (m) => fmt(m.trophies)],
    ['Con almeno un trofeo', (m) => fmt(m.withTrophyPct, '%')],
    ['Età di ritiro', (m) => fmt(m.retirementAge)],
    ['Punteggio medio', (m) => fmt(m.score)],
    ['Leggende', (m) => fmt(m.legendPct, '%')],
    ['Tempo di gioco (min)', (m) => fmt(m.playMinutes)],
  ];
  const width = Math.max(...rows.map(([label]) => label.length)) + 2;
  const colWidth = 9;
  const line = (label: string, cells: string[]) =>
    label.padEnd(width) + cells.map((c) => c.padStart(colWidth)).join('');
  const out = [
    `Strategia: ${summary.strategy} · seme ${summary.seed} · ${summary.careers} carriere`,
    line(
      '',
      cols.map(([name]) => name),
    ),
    ...rows.map(([label, f]) =>
      line(
        label,
        cols.map(([, m]) => f(m)),
      ),
    ),
  ];
  const tiers = Object.entries(summary.overall.tiersPct)
    .map(([id, p]) => `${id} ${p}%`)
    .join(' · ');
  const trophies = Object.entries(summary.overall.trophiesById)
    .sort()
    .map(([id, v]) => `${id} ${v}`)
    .join(' · ');
  out.push('', `Fasce: ${tiers}`, `Trofei per carriera: ${trophies || 'nessuno'}`);
  return out.join('\n');
}
