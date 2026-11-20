import type { SimulatorConfig } from '@outstanding/config';
import type { LifeAction, Load } from '@outstanding/engine';
import type { CareerResult } from './run';

/** Le misure di un gruppo di carriere che servono ai criteri (punteggio = `score.total`, non arrotondato). */
export interface RunAggregate {
  careers: number;
  score: number;
  reachedTopPct: number;
  peakOvr: number;
  appearances: number;
  legendPct: number;
}

export interface Criterion {
  id: 1 | 2 | 3 | 4 | 5;
  pass: boolean;
  detail: string;
}

export interface CriteriaInput {
  contextual: RunAggregate;
  /** La prudente, se misurata: anche lei deve restare vicina alla baseline. */
  cautious?: RunAggregate;
  /** Piani fissi per chiave `carico+vita` (`push+none`, `balanced+family`...). */
  fixed: Record<string, RunAggregate>;
}

/** Tutti i piani fissi che i criteri 1–3 confrontano: ogni carico con nessuna vita e con ogni azione. */
export const FIXED_PLAN_GRID: readonly string[] = (['rest', 'balanced', 'push'] as Load[]).flatMap(
  (load) =>
    (['none', 'family', 'leisure', 'sponsor', 'party'] as (LifeAction | 'none')[]).map(
      (life) => `${load}+${life}`,
    ),
);

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function aggregate(results: readonly CareerResult[]): RunAggregate {
  const top = results.filter((r) => r.totals.topLevelDebutAge !== null).length;
  const n = results.length;
  return {
    careers: n,
    score: mean(results.map((r) => r.score.total)),
    reachedTopPct: n ? (100 * top) / n : 0,
    peakOvr: mean(results.map((r) => r.peakOvr)),
    appearances: mean(results.map((r) => r.totals.appearances)),
    legendPct: n ? (100 * results.filter((r) => r.legend).length) / n : 0,
  };
}

const EQUILIBRIUM = 'balanced+family';
const f = (x: number, d = 0) => x.toFixed(d);

/**
 * I cinque criteri della spec §5.10 su risultati già aggregati. Il criterio 4 non si misura con una
 * corsa del simulatore ma con i 4 test mirati: qui vale `scenariosVerified` (vero solo se il
 * chiamante li ha eseguiti); senza, torna non superato con "vedi test".
 */
export function criteria(
  input: CriteriaInput,
  config: SimulatorConfig,
  scenariosVerified?: boolean,
): Criterion[] {
  const c = config.criteria;
  const { contextual, fixed } = input;
  const out: Criterion[] = [];

  const entries = Object.entries(fixed);
  const best = entries.reduce<[string, RunAggregate] | undefined>(
    (b, e) => (!b || e[1].score > b[1].score ? e : b),
    undefined,
  );
  out.push({
    id: 1,
    pass: best !== undefined && best[1].score <= contextual.score,
    detail: best
      ? `contextual ${f(contextual.score)}; miglior piano fisso ${best[0]} ${f(best[1].score)} (${f((100 * best[1].score) / contextual.score, 1)}%)`
      : 'nessun piano fisso misurato',
  });

  const pushes = entries.filter(([k]) => k.startsWith('push+'));
  const pushBest = pushes.reduce<[string, RunAggregate] | undefined>(
    (b, e) => (!b || e[1].score > b[1].score ? e : b),
    undefined,
  );
  out.push({
    id: 2,
    pass: pushBest !== undefined && pushBest[1].score <= c.pushMaxShare * contextual.score,
    detail: pushBest
      ? `miglior Spinta fissa ${pushBest[0]} ${f(pushBest[1].score)} = ${f((100 * pushBest[1].score) / contextual.score, 1)}% di contextual (max ${f(100 * c.pushMaxShare)}%)`
      : 'nessuna Spinta fissa misurata',
  });

  const eq = fixed[EQUILIBRIUM];
  const traps = ['rest+family', 'balanced+none'];
  const missing = [EQUILIBRIUM, ...traps].filter((k) => !fixed[k]);
  if (missing.length > 0 || !eq) {
    out.push({ id: 3, pass: false, detail: `piani mancanti: ${missing.join(', ')}` });
  } else {
    const rows = traps.map((k) => {
      const share = fixed[k]!.score / eq.score;
      return { k, share, ok: share < 1 && share >= c.trapFloorShare };
    });
    out.push({
      id: 3,
      pass: rows.every((r) => r.ok),
      detail: `${EQUILIBRIUM} ${f(eq.score)}; ${rows.map((r) => `${r.k} ${f(100 * r.share, 1)}%`).join('; ')} (devono stare fra ${f(100 * c.trapFloorShare)}% e 100% escluso)`,
    });
  }

  out.push({
    id: 4,
    pass: scenariosVerified === true,
    detail:
      scenariosVerified === true
        ? 'verificato dai 4 test mirati (simulator.test.ts, "criterio 4")'
        : 'non misurato da questo comando: vedi test mirati (simulator.test.ts, "criterio 4")',
  });

  const checks = Object.entries({
    contextual,
    ...(input.cautious ? { cautious: input.cautious } : {}),
  }).flatMap(([name, a]) => {
    const base = c.baseline[name];
    if (!base) return [{ ok: false, text: `${name}: baseline mancante` }];
    const near = (label: string, v: number, ref: number) => ({
      ok: Math.abs(v - ref) <= c.baselineTolerance * ref,
      text: `${name} ${label} ${f(v, 1)} (rif. ${f(ref, 1)})`,
    });
    return [
      near('massima serie %', a.reachedTopPct, base.reachedTopPct),
      near('OVR massimo', a.peakOvr, base.peakOvr),
      near('presenze', a.appearances, base.appearances),
      {
        ok: a.legendPct >= c.legendMinPct && a.legendPct <= c.legendMaxPct,
        text: `${name} leggende ${f(a.legendPct, 2)}% (${c.legendMinPct}-${c.legendMaxPct}%)`,
      },
    ];
  });
  out.push({
    id: 5,
    pass: checks.every((x) => x.ok),
    detail: checks.map((x) => `${x.ok ? 'ok' : 'FUORI'} ${x.text}`).join('; '),
  });
  return out;
}
