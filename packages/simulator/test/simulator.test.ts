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
  advanceToStop,
  skipToNextMatch,
  getPendingEvents,
  getPlanOptions,
  playMatch,
  prudentMomentChoice,
  resolveEvent,
  setChapterPlan,
  type GameState,
  type KeyMoment,
  type LifeAction,
  type NewCareerOptions,
  type MatchDecision,
  type WeekPlan,
} from '@outstanding/engine';
import { applyMatchAftermath } from '../../engine/src/player/condition';
import { recordChapterMatch } from '../../engine/src/season/director';
import {
  careerSeeds,
  contextualStrategy,
  criteria,
  estimateSeconds,
  fixedPlanStrategy,
  formatPlan,
  formatTable,
  getStrategy,
  parsePlan,
  randomCareerOptions,
  runCareer,
  simulate,
  STRATEGIES,
  summarize,
  timeMetrics,
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
      expect(run(['--loop', 'weeks']).status).toBe(0);
      expect(readdirSync(out)).toContain('sim-cautious-normal-3-1-weeks.json');
      expect(run(['--loop', 'x']).status).toBe(1);
      const read = (f: string) => JSON.parse(readFileSync(join(out, f), 'utf8'));
      expect(read(files[0]!)).toMatchObject({ isolate: true, quality: 0.7 });
      expect(read(files[1]!)).not.toHaveProperty('isolate');
    },
    CAREER_TIMEOUT,
  );
});

describe.runIf(process.env.SIM_CRITERION === '1')('isolated rating criterion', () => {
  it('contextual beats cautious and aggressive over 2000 careers', () => {
    // Fissato al ciclo a settimane: il criterio misura la qualità della decisione per partita, che i capitoli diluiscono.
    // Il CLI usa i worker thread, che vitest non sa caricare dai sorgenti TypeScript.
    const out = mkdtempSync(join(tmpdir(), 'sim-criterion-'));
    const rating = (id: 'cautious' | 'aggressive' | 'contextual') => {
      const result = spawnSync(
        process.execPath,
        [
          '--import',
          'tsx',
          'packages/simulator/src/cli.ts',
          ...[
            '--careers',
            '2000',
            '--strategy',
            id,
            '--seed',
            '42',
            '--isolate',
            '--loop',
            'weeks',
            '--out',
            out,
          ],
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

describe('chapter loop', () => {
  it(
    'career loop plays only picked matches manually',
    () => {
      const r = runCareer(11, 'cautious');
      const d = r.decisions;
      const stats = r.chapterStats!;
      // Una partita completa e le altre rapide: le giocate di persona sono esattamente le scelte.
      expect(d.matches + d.quickMatches).toBe(stats.picks);
      expect(d.matches).toBeGreaterThan(0);
      expect(d.quickMatches).toBeGreaterThan(0);
      expect(d.matches).toBeLessThanOrEqual(stats.chapters);
      // La maggior parte delle partite è simulata e i passi sono quelli delle modalità.
      expect(d.simulatedMatches).toBeGreaterThan(d.matches + d.quickMatches);
      expect(d.weeks).toBe(stats.chapters);
      expect(runCareer(11, 'cautious')).toEqual(r);
      // Il ciclo a capitoli ignora --mode: le scelte decidono la modalità.
      expect(runCareer(11, 'cautious', defaultContext, undefined, { mode: 'quick' })).toEqual(r);
    },
    CAREER_TIMEOUT,
  );

  it(
    'reports minutes per season and hours per career',
    () => {
      const results = ['cautious', 'contextual'].map((s) => runCareer(5, s as 'cautious'));
      for (const r of results) {
        const total = r.seasonSeconds!.reduce((a, b) => a + b, 0);
        expect(r.seasonSeconds!.length).toBeGreaterThanOrEqual(r.totals.seasons);
        expect(Math.round(total / 60)).toBe(r.playMinutes);
      }
      const t = timeMetrics(results)!;
      expect(t.minutesPerSeason.p10).toBeLessThanOrEqual(t.minutesPerSeason.median);
      expect(t.minutesPerSeason.median).toBeLessThanOrEqual(t.minutesPerSeason.p90);
      expect(t.hoursPerCareer.median).toBeGreaterThan(0);
      const summary = summarize(results, 'cautious', 5, defaultContext);
      expect(summary.overall.time).toEqual(t);
      expect(formatTable(summary)).toContain('Tempo a stagione (min)');
      expect(formatTable(summary)).toContain('Tempo a carriera (ore)');
    },
    CAREER_TIMEOUT,
  );

  it(
    'weeks loop is unchanged from Part A',
    () => {
      // Valori misurati prima del ciclo a capitoli (HEAD 46b48e6), ri-misurati con crescita continua e
      // freschezza nella crescita (task 3) e in partita/convocazione/infortuni (task 6), con gli
      // 8 effetti del rischio convertiti in freschezza (task 8), poi col piano a due binari e le
      // strategie nuove (task 7), poi con un solo clamp della freschezza e il recupero nel declino.
      const weeks = { loop: 'weeks' } as const;
      const run = (seed: number, id: 'cautious' | 'contextual' | 'random') =>
        runCareer(seed, id, defaultContext, undefined, weeks);
      const a = run(11, 'cautious');
      expect(a.decisions).toEqual({
        weeks: 1152,
        events: 263,
        moments: 2417,
        chainSteps: 109,
        autoSteps: 0,
        matches: 646,
        quickMatches: 0,
        simulatedMatches: 205,
        offers: 26,
      });
      expect([a.playMinutes, a.totals.appearances, a.score.total, a.retirement.age]).toEqual([
        2103, 763, 2953, 38,
      ]);
      const b = run(11, 'contextual');
      expect(b.decisions.moments).toBe(2080);
      expect([b.playMinutes, b.score.total]).toEqual([1982, 4151]);
      const c = run(7, 'random');
      expect(c.decisions.offers).toBe(55);
      expect([c.playMinutes, c.score.total]).toEqual([1283, 691]);
      expect(a).not.toHaveProperty('seasonSeconds');
    },
    CAREER_TIMEOUT,
  );
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
      planPreview: 6,
    });
  });

  it('time estimate counts chain steps separately', () => {
    const base = {
      weeks: 0,
      events: 0,
      moments: 0,
      chainSteps: 0,
      autoSteps: 0,
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
      const weeks = { loop: 'weeks' } as const;
      const r = runCareer(11, 'cautious', defaultContext, undefined, { ...weeks, mode: 'quick' });
      expect(r.decisions.matches).toBe(0);
      expect(r.decisions.quickMatches).toBeGreaterThan(0);
      expect(r.decisions.moments + r.decisions.chainSteps).toBeLessThanOrEqual(
        2 * r.decisions.quickMatches,
      );
      const full = runCareer(11, 'cautious', defaultContext, undefined, weeks);
      expect(full.decisions.quickMatches).toBe(0);
      expect(full.decisions.matches).toBeGreaterThan(0);
      expect(r.playMinutes).toBeLessThan(full.playMinutes);
    },
    CAREER_TIMEOUT,
  );
});

describe('piani fissi', () => {
  it('parsePlan e formatPlan: carico, vita o none, focus facoltativo', () => {
    expect(parsePlan('push+none')).toEqual({ load: 'push' });
    expect(parsePlan('balanced+family')).toEqual({ load: 'balanced', life: 'family' });
    expect(parsePlan('rest+party+vision')).toEqual({
      load: 'rest',
      life: 'party',
      focus: 'vision',
    });
    expect(formatPlan({ load: 'push' })).toBe('push+none');
    expect(formatPlan({ load: 'rest', life: 'party', focus: 'vision' })).toBe('rest+party+vision');
    for (const bad of ['push', 'sprint+none', 'push+disco', 'push+none+x', 'a+b+c+d'])
      expect(() => parsePlan(bad), bad).toThrow();
  });

  it(
    '--plan push+none gioca sempre Spinta senza vita, e il report lo conta',
    () => {
      const r = runCareer(5, 'contextual', defaultContext, undefined, {
        plan: parsePlan('push+none'),
      });
      expect(r.fixedPlan).toEqual({
        plan: 'push+none',
        chapters: r.chapterStats!.chapters,
        lifeFallbacks: 0,
      });
      expect(r.decisions.weeks).toBe(r.chapterStats!.chapters);
      // Una carriera con Spinta fissa non è quella di contextual.
      expect(r.score.total).not.toBe(runCareer(5, 'contextual').score.total);
    },
    CAREER_TIMEOUT,
  );

  it(
    'se la vita non è disponibile si gioca lo stesso piano senza vita, e si conta',
    () => {
      // Sponsor senza ingaggi non è disponibile: ogni capitolo ricade sul piano senza vita.
      const r = runCareer(5, 'contextual', defaultContext, undefined, {
        plan: parsePlan('balanced+sponsor'),
      });
      expect(r.fixedPlan!.lifeFallbacks).toBeGreaterThan(0);
      expect(r.fixedPlan!.lifeFallbacks).toBeLessThanOrEqual(r.fixedPlan!.chapters);
    },
    CAREER_TIMEOUT,
  );

  it('a parità di stato sceglie nei momenti, nelle offerte e negli eventi come contextual', () => {
    const contextual = contextualStrategy;
    const fixed = fixedPlanStrategy({ load: 'push' });
    expect(fixed.decideMoment).toBe(contextual.decideMoment);
    expect(fixed.pickOffer).toBe(contextual.pickOffer);
    expect(fixed.chooseEvent).toBe(contextual.chooseEvent);
    expect(fixed.playsManually).toBe(contextual.playsManually);
    const moment: KeyMoment = {
      options: [
        { value: 1, chance: 0.5, risk: 'safe' },
        { value: 3, chance: 0.4, risk: 'risky' },
        { value: 2, chance: 0.9, risk: 'balanced' },
      ],
    } as unknown as KeyMoment;
    expect(fixed.decideMoment(moment, Rng.fromSeed(1))).toBe(
      contextual.decideMoment(moment, Rng.fromSeed(1)),
    );
    const state = newCareer(
      { firstName: 'A', lastName: 'B', hometown: 'Bergamo', role: 'ATT', traits: [] },
      3,
    );
    expect(fixed.planWeek(state, Rng.fromSeed(1), defaultContext)).toEqual({ load: 'push' });
  });
});

describe('criteri', () => {
  const agg = (score: number, over: Partial<Record<string, number>> = {}) => ({
    careers: 100,
    score,
    reachedTopPct: 57,
    peakOvr: 67.8,
    appearances: 638,
    legendPct: 3,
    ...over,
  });
  const base = () => ({
    contextual: agg(1600),
    cautious: agg(1500),
    fixed: {
      'balanced+family': agg(1500),
      'rest+family': agg(1200),
      'balanced+none': agg(1300),
      'push+family': agg(1400),
      'push+none': agg(1300),
    },
  });
  const byId = (input: ReturnType<typeof base>, scenarios?: boolean) =>
    Object.fromEntries(
      criteria(input, defaultContext.config.simulator, scenarios).map((c) => [c.id, c]),
    );

  it('tutti verdi su dati sani; il criterio 4 non è misurato qui', () => {
    const c = byId(base());
    expect([1, 2, 3, 5].every((id) => c[id]!.pass)).toBe(true);
    expect(c[4]!.pass).toBe(false);
    expect(c[4]!.detail).toContain('vedi test');
    expect(byId(base(), true)[4]!.pass).toBe(true);
  });

  it('1: un piano fisso sopra contextual fa fallire', () => {
    const i = base();
    i.fixed['push+family'] = agg(1601);
    expect(byId(i)[1]!.pass).toBe(false);
    expect(byId(i)[1]!.detail).toContain('push+family');
  });

  it('2: Spinta fissa al 95% di contextual passa, oltre fallisce', () => {
    const i = base();
    i.fixed['push+family'] = agg(1520);
    expect(byId(i)[2]!.pass).toBe(true);
    i.fixed['push+family'] = agg(1521);
    expect(byId(i)[2]!.pass).toBe(false);
  });

  it('3: Scarico e nessuna vita peggiori di Equilibrio ma non sotto il 50%', () => {
    const i = base();
    i.fixed['rest+family'] = agg(1500);
    expect(byId(i)[3]!.pass).toBe(false);
    i.fixed['rest+family'] = agg(749);
    expect(byId(i)[3]!.pass).toBe(false);
    i.fixed['rest+family'] = agg(750);
    expect(byId(i)[3]!.pass).toBe(true);
    i.fixed['balanced+none'] = agg(1600);
    expect(byId(i)[3]!.pass).toBe(false);
  });

  it('5: metriche entro il 10% della baseline e leggende fra 1% e 5%', () => {
    const i = base();
    expect(byId(i)[5]!.pass).toBe(true);
    i.contextual = agg(1600, { reachedTopPct: 63 });
    expect(byId(i)[5]!.pass).toBe(false);
    i.contextual = agg(1600, { legendPct: 5.5 });
    expect(byId(i)[5]!.pass).toBe(false);
    i.contextual = agg(1600, { legendPct: 0.5 });
    expect(byId(i)[5]!.pass).toBe(false);
  });

  it('piani mancanti: i criteri che li usano falliscono e lo dicono', () => {
    const i = base();
    delete (i.fixed as Record<string, unknown>)['rest+family'];
    expect(byId(i)[3]!.pass).toBe(false);
    expect(byId(i)[3]!.detail).toContain('rest+family');
  });
});

/**
 * Criterio 4: per ogni azione della vita uno scenario costruito in cui, su 200 carriere, è la
 * migliore fra le cinque scelte (le quattro azioni e nessuna) nel valore che deve muovere, misurato
 * alla fine del capitolo. Stesso carico (Equilibrio) e stessi semi per tutte le scelte.
 */
describe('criterio 4: ogni azione della vita è la migliore da qualche parte', () => {
  const SEEDS = 200;
  const ctx = defaultContext;
  const CHOICES: (LifeAction | 'none')[] = ['none', 'family', 'leisure', 'sponsor', 'party'];
  const options: NewCareerOptions = {
    firstName: 'A',
    lastName: 'B',
    hometown: 'Bergamo',
    role: 'ATT',
    traits: [],
  };

  /** Gioca un capitolo con il piano dato fino al suo termine: eventi al primo ramo, partite scelte prudenti. */
  function playChapter(s0: GameState, plan: WeekPlan): GameState {
    let s = setChapterPlan(s0, plan, ctx);
    const id = s.chapter.id;
    const season = s.season;
    for (let guard = 0; guard < 500; guard++) {
      const out = advanceToStop(s, ctx);
      s = out.state;
      if (out.report.stop === 'chapterEnd' || out.report.stop === 'seasonEnd' || s.retired)
        return s;
      if (s.chapter.id !== id || s.season !== season) return s;
      for (const e of getPendingEvents(s, ctx)) s = resolveEvent(s, e.eventId, 0, ctx).state;
      if (out.report.stop === 'pick') {
        const mode =
          s.chapter.picks.find((p) => p.fixtureId === playerFixtureId(s))?.mode ?? 'full';
        s = playMatch(s, (m) => prudentMomentChoice(m), ctx, { mode }).state;
      }
    }
    throw new Error('chapter did not end');
  }
  const playerFixtureId = (s: GameState) => playerFixture(s)!.id;

  /** Un capitolo di partenza per seme, giocato una volta sola e condiviso dagli scenari. */
  const starts = new Map<number, GameState>();
  function startOf(seed: number): GameState {
    let s = starts.get(seed);
    if (!s) {
      s = playChapter(newCareer(options, seed, ctx), { load: 'balanced' });
      starts.set(seed, s);
    }
    return s;
  }

  /** Media su `SEEDS` carriere del valore per ciascuna scelta; la migliore e il distacco dalla seconda. */
  function measure(setup: (s: GameState) => GameState, value: (s: GameState) => number) {
    const sums: Record<string, number> = {};
    for (let seed = 1; seed <= SEEDS; seed++) {
      const base = setup(startOf(seed));
      const open = getPlanOptions(base, ctx)
        .life.filter((l) => l.available)
        .map((l) => l.id);
      for (const c of CHOICES) {
        // Senza ingaggi lo Sponsor non è una scelta possibile: non entra nel confronto.
        if (c !== 'none' && !open.includes(c)) continue;
        const plan: WeekPlan = c === 'none' ? { load: 'balanced' } : { load: 'balanced', life: c };
        sums[c] = (sums[c] ?? 0) + value(playChapter(base, plan));
      }
    }
    const means = Object.fromEntries(Object.entries(sums).map(([k, v]) => [k, v / SEEDS]));
    const ranked = Object.entries(means).sort((a, b) => b[1] - a[1]);
    return { means, best: ranked[0]![0] };
  }

  const THRESHOLD_TIMEOUT = 120_000;

  /** Tre sconfitte registrate dal percorso vero (dopopartita e registro del capitolo), poi morale 35. */
  function afterThreeLosses(s: GameState): GameState {
    const probe = simulateMatch(skipToNextMatch(s, ctx).state, ctx).matchReport;
    const forced = { ...probe, result: 'loss' as const, rating: 4 };
    let state = s;
    for (let i = 0; i < 3; i++) {
      const after = applyMatchAftermath(
        state.player,
        undefined,
        { selection: 'starter', minutesPlayed: 90, rating: 4, result: 'loss' },
        state.week,
        Rng.fromSeed(i + 1),
        ctx,
      );
      state = recordChapterMatch({ ...state, player: after.player }, forced, {
        freshness: state.player.condition.energy,
        moraleProtected: after.moraleProtected,
        startSkills: state.player.skills,
      });
    }
    // Il morale parte da un valore fisso, uguale per tutti i semi.
    return {
      ...state,
      player: { ...state.player, condition: { ...state.player.condition, morale: 35 } },
    };
  }

  it(
    'Svago: morale 35 dopo tre sconfitte registrate, vince il morale a fine capitolo',
    () => {
      const r = measure(afterThreeLosses, (s) => s.player.condition.morale);
      console.log('svago', r.means);
      expect(r.best).toBe('leisure');
    },
    THRESHOLD_TIMEOUT,
  );

  it(
    'Famiglia: partner con affinità 30, vince l affinità a fine capitolo',
    () => {
      const r = measure(
        (s) => ({
          ...s,
          privateLife: {
            ...s.privateLife!,
            partner: {
              firstName: 'Giulia',
              lastName: 'Rinaldi',
              gender: 'f',
              job: 'architect',
              skin: 0,
              hairColor: 0,
              hair: 'long',
              stage: 'dating',
              sinceWeek: -100,
              stageWeek: -100,
              affinity: 30,
            },
          },
        }),
        (s) => s.privateLife?.partner?.affinity ?? 0,
      );
      console.log('famiglia', r.means);
      expect(r.best).toBe('family');
    },
    THRESHOLD_TIMEOUT,
  );

  it(
    'Sponsor: cassa 0 con uno sponsor, vince la cassa a fine capitolo',
    () => {
      const r = measure(
        (s) => ({
          ...s,
          player: {
            ...s.player,
            money: { ...s.player.money, cash: 0 },
            sponsors: [
              {
                sponsorId: ctx.content.sponsors[0]!.id,
                weeklyIncome: 400,
                untilSeason: s.season + 3,
              },
            ],
          },
        }),
        (s) => s.player.money.cash,
      );
      console.log('sponsor', r.means);
      expect(r.best).toBe('sponsor');
    },
    THRESHOLD_TIMEOUT,
  );

  it(
    'Serata: popolarità a 2 punti dalla soglia degli sponsor, vince la quota che la supera',
    () => {
      const min = ctx.config.economy.sponsors.minPopularity;
      const r = measure(
        (s) => ({
          ...s,
          sponsorOffers: [],
          player: { ...s.player, sponsors: [], image: { ...s.player.image, popularity: min - 2 } },
        }),
        (s) => (s.player.image.popularity >= min ? 1 : 0) + s.player.image.popularity / 1000,
      );
      console.log('serata', r.means);
      expect(r.best).toBe('party');
    },
    THRESHOLD_TIMEOUT,
  );
});
