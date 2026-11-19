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
  /** Media voto non arrotondata, per i confronti fra strategie. */
  averageRatingExact: number | null;
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
  /** Passi per partita giocata di persona: visibili (decisi dal giocatore) e totali (con gli automatici). */
  stepsPerMatch: { visible: number; total: number };
  seasons: number;
  time?: TimeMetrics;
}

/** Distribuzione di una misura di tempo: mediana, media e decili estremi. */
export interface Distribution {
  median: number;
  mean: number;
  p10: number;
  p90: number;
}

/** Tempo di gioco stimato dal ciclo a capitoli (assente nel ciclo a settimane). */
export interface TimeMetrics {
  /** Minuti per stagione, su tutte le stagioni di tutte le carriere. */
  minutesPerSeason: Distribution;
  /** Ore per carriera. */
  hoursPerCareer: Distribution;
  /** Medie per stagione: capitoli, stop per notizie e offerte, partite scelte. */
  perSeason: { chapters: number; newsStops: number; offerStops: number; picks: number };
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

/** Percentile per interpolazione lineare su un campione ordinato. */
function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

function distribution(xs: readonly number[], digits: number): Distribution {
  const sorted = [...xs].sort((a, b) => a - b);
  return {
    median: round(quantile(sorted, 0.5), digits),
    mean: round(avg(xs), digits),
    p10: round(quantile(sorted, 0.1), digits),
    p90: round(quantile(sorted, 0.9), digits),
  };
}

/** Minuti a stagione e ore a carriera dai secondi grezzi; assenti se nessuna carriera li ha. */
export function timeMetrics(results: readonly CareerResult[]): TimeMetrics | undefined {
  const timed = results.filter((r) => r.seasonSeconds && r.chapterStats);
  if (timed.length === 0) return undefined;
  const seasons = timed.flatMap((r) => r.seasonSeconds!);
  const sum = (f: (r: CareerResult) => number) =>
    timed.reduce((n, r) => n + f(r), 0) / seasons.length;
  return {
    minutesPerSeason: distribution(
      seasons.map((x) => x / 60),
      1,
    ),
    hoursPerCareer: distribution(
      timed.map((r) => r.seasonSeconds!.reduce((a, b) => a + b, 0) / 3600),
      2,
    ),
    perSeason: {
      chapters: round(
        sum((r) => r.chapterStats!.chapters),
        2,
      ),
      newsStops: round(
        sum((r) => r.chapterStats!.newsStops),
        2,
      ),
      offerStops: round(
        sum((r) => r.chapterStats!.offerStops),
        2,
      ),
      picks: round(
        sum((r) => r.chapterStats!.picks),
        2,
      ),
    },
  };
}

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
    averageRatingExact: ratings.length ? avg(ratings) : null,
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
    stepsPerMatch: stepsPerMatch(results),
    seasons: round(avg(results.map((r) => r.totals.seasons))),
    ...(timeMetrics(results) ? { time: timeMetrics(results) } : {}),
  };
}

function stepsPerMatch(results: readonly CareerResult[]): { visible: number; total: number } {
  let visible = 0;
  let auto = 0;
  let matches = 0;
  for (const r of results) {
    const d = r.decisions;
    visible += d.moments + d.chainSteps;
    auto += d.autoSteps;
    matches += d.matches + d.quickMatches;
  }
  return matches
    ? { visible: round(visible / matches, 2), total: round((visible + auto) / matches, 2) }
    : { visible: 0, total: 0 };
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
    ['Passi a partita, visibili', (m) => fmt(m.stepsPerMatch.visible)],
    ['Passi a partita, totali', (m) => fmt(m.stepsPerMatch.total)],
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
  const t = summary.overall.time;
  if (t) {
    out.push(
      '',
      `Tempo a stagione (min): mediana ${t.minutesPerSeason.median} · media ${t.minutesPerSeason.mean} · p10 ${t.minutesPerSeason.p10} · p90 ${t.minutesPerSeason.p90}`,
      `Tempo a carriera (ore): mediana ${t.hoursPerCareer.median} · media ${t.hoursPerCareer.mean} · p10 ${t.hoursPerCareer.p10} · p90 ${t.hoursPerCareer.p90}`,
      `Per stagione: ${t.perSeason.chapters} capitoli · ${t.perSeason.picks} partite scelte · ${t.perSeason.newsStops} stop notizie · ${t.perSeason.offerStops} stop offerte`,
    );
  }
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
