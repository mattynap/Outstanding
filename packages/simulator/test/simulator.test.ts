import { describe, expect, it } from 'vitest';
import { defaultContext } from '@outstanding/engine';
import { careerSeeds, formatTable, runCareer, simulate, STRATEGIES, summarize } from '../src/index';

describe('simulatore', () => {
  it('ricava semi diversi e riproducibili dal seme principale', () => {
    const a = careerSeeds(42, 50);
    expect(new Set(a).size).toBe(50);
    expect(careerSeeds(42, 50)).toEqual(a);
    expect(careerSeeds(43, 50)).not.toEqual(a);
  });

  it.each(STRATEGIES)('gioca una carriera completa con la strategia %s', (strategy) => {
    const r = runCareer(11, strategy);
    expect(r.retirement.age).toBeGreaterThanOrEqual(
      defaultContext.config.economy.retirement.minAge,
    );
    expect(r.totals.seasons).toBeGreaterThan(10);
    expect(r.totals.appearances).toBeGreaterThan(0);
    expect(r.decisions.weeks).toBeGreaterThan(0);
    expect(r.playMinutes).toBeGreaterThan(0);
    expect(runCareer(11, strategy)).toEqual(r);
  });

  it('riassume le carriere in metriche e tabella', async () => {
    const results = await simulate(careerSeeds(1, 3), 'cautious', 1);
    expect(results.map((r) => r.seed)).toEqual(careerSeeds(1, 3));
    const summary = summarize(results, 'cautious', 1, defaultContext);
    expect(summary.overall.careers).toBe(3);
    const tiers = Object.values(summary.overall.tiersPct).reduce((a, b) => a + b, 0);
    expect(tiers).toBeCloseTo(100, 0);
    const roles = Object.values(summary.byRole).reduce((n, m) => n + m.careers, 0);
    expect(roles).toBe(3);
    expect(formatTable(summary)).toContain('Arrivano in massima serie');
  });
});
