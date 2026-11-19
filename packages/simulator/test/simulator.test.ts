import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  advanceWeek,
  defaultContext,
  endSeason,
  getOffers,
  isSeasonOver,
  newCareer,
  playerFixture,
  simulateMatch,
  Rng,
  type KeyMoment,
  type MatchDecision,
} from '@outstanding/engine';
import {
  careerSeeds,
  estimateSeconds,
  formatTable,
  getStrategy,
  randomCareerOptions,
  runCareer,
  simulate,
  STRATEGIES,
  summarize,
} from '../src/index';

// Carriere complete (20 stagioni ciascuna): sotto carico superano i 5 s predefiniti.
const CAREER_TIMEOUT = 60_000;

describe('simulatore', () => {
  it('ricava semi diversi e riproducibili dal seme principale', () => {
    const a = careerSeeds(42, 50);
    expect(new Set(a).size).toBe(50);
    expect(careerSeeds(42, 50)).toEqual(a);
    expect(careerSeeds(43, 50)).not.toEqual(a);
  });

  it.each(STRATEGIES)(
    'gioca una carriera completa con la strategia %s',
    (strategy) => {
      const r = runCareer(11, strategy);
      expect(r.retirement.age).toBeGreaterThanOrEqual(
        defaultContext.config.economy.retirement.minAge,
      );
      expect(r.totals.seasons).toBeGreaterThan(10);
      expect(r.totals.appearances).toBeGreaterThan(0);
      expect(r.decisions.weeks).toBeGreaterThan(0);
      expect(r.playMinutes).toBeGreaterThan(0);
      expect(runCareer(11, strategy)).toEqual(r);
    },
    CAREER_TIMEOUT,
  );

  it(
    'riassume le carriere in metriche e tabella',
    async () => {
      const results = await simulate(careerSeeds(1, 3), 'cautious', 1);
      expect(results.map((r) => r.seed)).toEqual(careerSeeds(1, 3));
      const summary = summarize(results, 'cautious', 1, defaultContext);
      expect(summary.overall.careers).toBe(3);
      const tiers = Object.values(summary.overall.tiersPct).reduce((a, b) => a + b, 0);
      expect(tiers).toBeCloseTo(100, 0);
      const roles = Object.values(summary.byRole).reduce((n, m) => n + m.careers, 0);
      expect(roles).toBe(3);
      expect(formatTable(summary)).toContain('Arrivano in massima serie');
    },
    CAREER_TIMEOUT,
  );
});

const moment: KeyMoment = {
  momentId: 'test',
  minute: 85,
  textKey: 'test',
  params: {},
  score: { home: 0, away: 1 },
  dyn: { coachTrust: 0, nerves: 0, fatigue: 0, marking: 0 },
  pressure: 0,
  options: [
    {
      id: 'safe',
      textKey: 'safe',
      chance: 0.9,
      chanceBand: 'high',
      risk: 'safe',
      value: 1,
      onSuccess: 'rating',
      onFailure: 'lost',
      onFail: 'none',
    },
    {
      id: 'balanced',
      textKey: 'balanced',
      chance: 0.2,
      chanceBand: 'low',
      risk: 'balanced',
      value: 3,
      onSuccess: 'rating',
      onFailure: 'lost',
      onFail: 'none',
    },
    {
      id: 'risky',
      textKey: 'risky',
      chance: 0.6,
      chanceBand: 'mid',
      risk: 'risky',
      value: 2,
      onSuccess: 'rating',
      onFailure: 'lost',
      onFail: 'none',
    },
  ],
};
const indexOf = (decision: number | MatchDecision) =>
  typeof decision === 'number' ? decision : decision.optionIndex;

describe('match strategies', () => {
  it('contextual selects maximum value, then chance, then lowest index', () => {
    const strategy = getStrategy('contextual');
    const decide = (m: KeyMoment) => indexOf(strategy.decideMoment(m, Rng.fromSeed(1)));
    expect(decide(moment)).toBe(1);
    const tied = {
      ...moment,
      options: moment.options.map((o, i) => ({ ...o, value: i === 0 ? 1 : 3 })),
    };
    expect(decide(tied)).toBe(2);
    expect(decide({ ...tied, options: tied.options.map((o) => ({ ...o, chance: 0.5 })) })).toBe(1);
  });

  it('aggressive selects highest risk, then chance, then lowest index', () => {
    const strategy = getStrategy('aggressive');
    const decide = (m: KeyMoment) => indexOf(strategy.decideMoment(m, Rng.fromSeed(1)));
    expect(decide(moment)).toBe(2);
    const tied = {
      ...moment,
      options: moment.options.map((o, i) => ({
        ...o,
        risk: i === 0 ? ('safe' as const) : ('risky' as const),
      })),
    };
    expect(decide(tied)).toBe(2);
    expect(decide({ ...tied, options: tied.options.map((o) => ({ ...o, chance: 0.5 })) })).toBe(1);
    expect(decide({ ...moment, options: moment.options.slice(0, 2) })).toBe(1);
  });

  it.each(['cautious', 'aggressive', 'contextual'] as const)(
    '%s uses neutral gesture quality',
    (id) => {
      expect(getStrategy(id).decideMoment(moment, Rng.fromSeed(1))).toMatchObject({ quality: 0.5 });
    },
  );

  it.each(STRATEGIES)('quality overrides %s without changing its choice', (id) => {
    const normal = getStrategy(id).decideMoment(moment, Rng.fromSeed(1));
    expect(getStrategy(id, { quality: 1 }).decideMoment(moment, Rng.fromSeed(1))).toEqual({
      optionIndex: indexOf(normal),
      quality: 1,
    });
  });

  it(
    'passes isolation and quality through simulate to the career',
    async () => {
      const options = { isolate: true, quality: 1 };
      const results = await simulate([11], 'random', 1, undefined, undefined, options);
      expect(results).toEqual([runCareer(11, 'random', defaultContext, undefined, options)]);
    },
    CAREER_TIMEOUT,
  );

  it(
    'isolated careers are deterministic per seed and strategy',
    () => {
      const options = { isolate: true };
      const a = runCareer(7, 'contextual', defaultContext, undefined, options);
      expect(runCareer(7, 'contextual', defaultContext, undefined, options)).toEqual(a);
    },
    CAREER_TIMEOUT,
  );

  it('with isolate, strategies differ only in match decisions', () => {
    const ctx = defaultContext;
    const state = newCareer(randomCareerOptions(Rng.fromSeed(11), ctx), 11, ctx);
    const offers = [
      {
        id: 'low',
        kind: 'transfer' as const,
        clubId: 'low',
        clubName: 'Low',
        level: 5,
        salaryWeekly: 10,
        seasons: 1,
        signingBonus: 0,
        expiresWeek: 10,
      },
      {
        id: 'high',
        kind: 'transfer' as const,
        clubId: 'high',
        clubName: 'High',
        level: 1,
        salaryWeekly: 100,
        seasons: 1,
        signingBonus: 0,
        expiresWeek: 10,
      },
    ];
    const fixture = {
      id: 'test',
      season: 1,
      week: 1,
      matchday: 1,
      leagueId: 'test',
      groupId: 'test',
      homeId: 'low',
      awayId: 'high',
    };
    const decisions = (id: (typeof STRATEGIES)[number]) => {
      const strategy = getStrategy(id, { isolate: true });
      const rng = Rng.fromSeed(42);
      return Array.from({ length: 10 }, () => ({
        plan: strategy.planWeek(state, rng, ctx),
        manual: strategy.playsManually(state, fixture, rng),
        event: strategy.chooseEvent(4, rng),
        offer: strategy.pickOffer(state, offers, rng, ctx),
      }));
    };
    for (const id of STRATEGIES) expect(decisions(id)).toEqual(decisions('cautious'));
    // Le scelte fuori campo sono le stesse funzioni della prudente, non copie che per ora coincidono.
    const base = getStrategy('cautious', { isolate: true });
    for (const id of STRATEGIES) {
      const iso = getStrategy(id, { isolate: true });
      expect(iso.planWeek).toBe(base.planWeek);
      expect(iso.playsManually).toBe(base.playsManually);
      expect(iso.chooseEvent).toBe(base.chooseEvent);
      expect(iso.pickOffer).toBe(base.pickOffer);
    }
    // Senza isolamento le scelte fuori campo dell'aggressiva cambiano: il confronto è significativo.
    const free = getStrategy('aggressive');
    const rngFree = Rng.fromSeed(42);
    const freeOffer = free.pickOffer(state, offers, rngFree, ctx);
    const cautiousOffer = getStrategy('cautious').pickOffer(state, offers, Rng.fromSeed(42), ctx);
    expect(freeOffer).not.toEqual(cautiousOffer);
    expect(
      indexOf(getStrategy('cautious', { isolate: true }).decideMoment(moment, Rng.fromSeed(1))),
    ).toBe(0);
    expect(
      indexOf(getStrategy('contextual', { isolate: true }).decideMoment(moment, Rng.fromSeed(1))),
    ).toBe(1);
    expect(
      indexOf(getStrategy('aggressive', { isolate: true }).decideMoment(moment, Rng.fromSeed(1))),
    ).toBe(2);
  });

  it(
    'with isolate, the strategies take the same off-pitch decisions on the same states over three simulated seasons, and differ without it',
    () => {
      const ctx = defaultContext;
      let state = newCareer(randomCareerOptions(Rng.fromSeed(5), ctx), 5, ctx);
      const trace = (id: (typeof STRATEGIES)[number], isolate: boolean, st: typeof state) => {
        const strategy = getStrategy(id, { isolate });
        const rng = Rng.fromSeed(9);
        return {
          plan: strategy.planWeek(st, rng, ctx),
          event: strategy.chooseEvent(3, rng),
          offer: strategy.pickOffer(st, getOffers(st), rng, ctx),
        };
      };
      let freeDiffers = false;
      // Stati reali di tre stagioni (partite simulate, uguali per tutti): non è una carriera giocata
      // con le strategie, perché le decisioni in partita ne farebbero divergere gli stati.
      for (let week = 0; week < 150 && !state.retired; week++) {
        for (const id of STRATEGIES) {
          expect(trace(id, true, state)).toEqual(trace('cautious', true, state));
        }
        if (
          JSON.stringify(trace('aggressive', false, state)) !==
          JSON.stringify(trace('cautious', false, state))
        ) {
          freeDiffers = true;
        }
        for (let f = playerFixture(state); f; f = playerFixture(state)) {
          state = simulateMatch(state, ctx).state;
        }
        state = isSeasonOver(state, ctx)
          ? endSeason(state, ctx).state
          : advanceWeek(state, ctx).state;
      }
      expect(freeDiffers).toBe(true);
    },
    CAREER_TIMEOUT,
  );

  it.each(['-0.1', '1.1', 'NaN', 'Infinity', 'abc', ''])(
    'CLI rejects invalid quality %s',
    (quality) => {
      const result = spawnSync(
        process.execPath,
        ['--import', 'tsx', 'packages/simulator/src/cli.ts', '--quality', quality],
        { encoding: 'utf8' },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/--quality.*0.*1/);
    },
  );
});

describe('CLI', () => {
  it(
    'puts isolate and quality in the report name and content',
    () => {
      const out = mkdtempSync(join(tmpdir(), 'sim-cli-'));
      const run = (extra: string[]) =>
        spawnSync(
          process.execPath,
          [
            '--import',
            'tsx',
            'packages/simulator/src/cli.ts',
            ...['--careers', '1', '--workers', '1', '--seed', '3', '--out', out, ...extra],
          ],
          { encoding: 'utf8' },
        );
      expect(run([]).status).toBe(0);
      expect(run(['--isolate', '--quality', '0.7']).status).toBe(0);
      const files = readdirSync(out).sort();
      expect(files).toEqual([
        'sim-cautious-normal-3-1-isolate-q0.7.json',
        'sim-cautious-normal-3-1.json',
      ]);
      const read = (f: string) => JSON.parse(readFileSync(join(out, f), 'utf8'));
      expect(read(files[0]!)).toMatchObject({ isolate: true, quality: 0.7 });
      expect(read(files[1]!)).not.toHaveProperty('isolate');
    },
    CAREER_TIMEOUT,
  );
});

describe.runIf(process.env.SIM_CRITERION === '1')('isolated rating criterion', () => {
  it('contextual beats cautious and aggressive over 2000 careers', () => {
    // Il CLI usa i worker thread, che vitest non sa caricare dai sorgenti TypeScript.
    const out = mkdtempSync(join(tmpdir(), 'sim-criterion-'));
    const rating = (id: 'cautious' | 'aggressive' | 'contextual') => {
      const result = spawnSync(
        process.execPath,
        [
          '--import',
          'tsx',
          'packages/simulator/src/cli.ts',
          ...['--careers', '2000', '--strategy', id, '--seed', '42', '--isolate', '--out', out],
        ],
        { encoding: 'utf8' },
      );
      expect(result.status, result.stderr).toBe(0);
      const file = readdirSync(out).find((f) => f.startsWith(`sim-${id}-`))!;
      const summary = JSON.parse(readFileSync(join(out, file), 'utf8')) as {
        overall: { averageRatingExact: number };
      };
      return summary.overall.averageRatingExact;
    };
    const cautious = rating('cautious');
    const aggressive = rating('aggressive');
    const contextual = rating('contextual');
    console.log('criterion', { cautious, aggressive, contextual });
    expect(contextual).toBeGreaterThan(cautious);
    expect(contextual).toBeGreaterThan(aggressive);
    expect(Math.abs(cautious - aggressive)).toBeLessThanOrEqual(0.2 + 1e-9);
  }, 3_600_000);
});

describe('stima del tempo', () => {
  const sp = defaultContext.config.simulator.secondsPer;

  it('uses the configured values', () => {
    expect(sp).toEqual({
      week: 4,
      event: 15,
      momentStep: 8,
      chainStep: 5,
      fullMatch: 150,
      quickMatch: 25,
      simulatedMatch: 3,
      offer: 10,
    });
  });

  it('time estimate counts chain steps separately', () => {
    const base = {
      weeks: 0,
      events: 0,
      moments: 0,
      chainSteps: 0,
      matches: 0,
      quickMatches: 0,
      simulatedMatches: 0,
      offers: 0,
    };
    expect(estimateSeconds({ ...base, moments: 1 }, sp)).toBe(sp.momentStep);
    expect(estimateSeconds({ ...base, chainSteps: 1 }, sp)).toBe(sp.chainStep);
    expect(
      estimateSeconds(
        { ...base, matches: 2, quickMatches: 3, simulatedMatches: 4, moments: 5, chainSteps: 6 },
        sp,
      ),
    ).toBe(
      2 * sp.fullMatch +
        3 * sp.quickMatch +
        4 * sp.simulatedMatch +
        5 * sp.momentStep +
        6 * sp.chainStep,
    );
  });

  it(
    'mode quick switches manual matches to quick',
    () => {
      const r = runCareer(11, 'cautious', defaultContext, undefined, { mode: 'quick' });
      expect(r.decisions.matches).toBe(0);
      expect(r.decisions.quickMatches).toBeGreaterThan(0);
      expect(r.decisions.moments + r.decisions.chainSteps).toBeLessThanOrEqual(
        2 * r.decisions.quickMatches,
      );
      const full = runCareer(11, 'cautious');
      expect(full.decisions.quickMatches).toBe(0);
      expect(full.decisions.matches).toBeGreaterThan(0);
      expect(r.playMinutes).toBeLessThan(full.playMinutes);
    },
    CAREER_TIMEOUT,
  );
});
