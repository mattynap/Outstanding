import { describe, expect, it, vi } from 'vitest';
import type { MomentOptionConfig, MomentTypeConfig } from '@outstanding/config';
import { Rng } from '../src/rng';
import {
  advanceWeek,
  beginMatch,
  chanceBandOf,
  decideMoment,
  type GameContext,
  defaultContext,
  getPendingMoment,
  newCareer,
  optionValue,
  playerFixture,
  riskBonus,
  type GameState,
} from '../src/index';
import { baseOptions } from './fixtures';

const ctx = defaultContext;
const cfg = ctx.config.match;
const risk = cfg.risk;

function pendingState(): GameState {
  for (let seed = 1; seed < 200; seed++) {
    let s = newCareer(baseOptions, seed, ctx);
    while (!playerFixture(s)) s = advanceWeek(s, ctx).state;
    const r = beginMatch(s, ctx);
    if (r.step.kind === 'moment') return r.state;
  }
  throw new Error('no pending moment');
}

function withScore(s: GameState, minute: number, mine: number, theirs: number): GameState {
  const m = s.currentMatch!;
  const score = m.side === 'home' ? { home: mine, away: theirs } : { home: theirs, away: mine };
  return { ...s, currentMatch: { ...m, score, pending: { ...m.pending!, minute } } };
}

describe('rischio contestuale', () => {
  it('riskBonus only late and by score', () => {
    const late = risk.lateFrom;
    expect(riskBonus('risky', -1, late, risk)).toBe(risk.behindBonus);
    expect(riskBonus('safe', 1, late, risk)).toBe(risk.aheadSafeBonus);
    expect(riskBonus('risky', -1, late - 1, risk)).toBe(0);
    expect(riskBonus('safe', 1, late - 1, risk)).toBe(0);
    expect(riskBonus('risky', 1, 85, risk)).toBe(0);
    expect(riskBonus('safe', -1, 85, risk)).toBe(0);
    expect(riskBonus('balanced', -1, 85, risk)).toBe(0);
    expect(riskBonus('balanced', 1, 85, risk)).toBe(0);
    expect(riskBonus('risky', 0, 85, risk)).toBe(0);
  });

  it('option value prefers risky when behind late', () => {
    const outcome = (rating: number, goalFor?: number) => ({
      rating,
      ...(goalFor ? { goalFor, by: 'team' as const } : {}),
    });
    const safe = {
      risk: 'safe',
      success: outcome(0.1),
      failure: outcome(0),
    } as MomentOptionConfig;
    const risky = {
      risk: 'risky',
      success: outcome(0.2, 0.9),
      failure: outcome(-0.2),
    } as MomentOptionConfig;
    // Sotto di un gol (bilico, peso massimo) il rischioso vale di più, a pari probabilità...
    expect(optionValue(risky, 0.5, -1, cfg)).toBeGreaterThan(optionValue(safe, 0.9, -1, cfg));
    // ...e con tre gol di scarto, dove il gol pesa poco, no.
    expect(optionValue(risky, 0.5, -3, cfg)).toBeLessThan(optionValue(safe, 0.9, -3, cfg));
  });

  it('shown chance and band include the risk bonus', () => {
    const base = pendingState();
    const tied = getPendingMoment(withScore(base, risk.lateFrom + 5, 0, 0), ctx)!;
    const behind = getPendingMoment(withScore(base, risk.lateFrom + 5, 0, 1), ctx)!;
    const ahead = getPendingMoment(withScore(base, risk.lateFrom + 5, 1, 0), ctx)!;
    const early = getPendingMoment(withScore(base, risk.lateFrom - 5, 0, 1), ctx)!;
    tied.options.forEach((o, i) => {
      if (o.closes) return;
      const delta = (m: typeof tied) => m.options[i]!.chance - o.chance;
      const bonus = o.risk === 'risky' ? risk.behindBonus : 0;
      const dClamped = delta(behind);
      if (bonus > 0) expect(dClamped).toBeGreaterThanOrEqual(0);
      else expect(dClamped).toBeCloseTo(0, 12);
      if (o.risk === 'safe') expect(delta(ahead)).toBeGreaterThanOrEqual(0);
      expect(delta(early)).toBeCloseTo(0, 12);
      for (const m of [tied, behind, ahead]) {
        const x = m.options[i]!;
        expect(x.chanceBand).toBe(chanceBandOf(x.chance, cfg.chanceBands));
      }
    });
    const rising = behind.options.some(
      (o, i) => o.risk === 'risky' && o.chance > tied.options[i]!.chance,
    );
    expect(rising).toBe(true);
  });

  it('safe option gains the bonus when ahead late; shown chance is the one drawn', () => {
    const zero = { rating: 0 };
    const o = (id: string, r: 'safe' | 'risky'): MomentOptionConfig => ({
      id,
      skills: { shooting: 1 },
      difficulty: 0,
      risk: r,
      success: zero,
      failure: zero,
    });
    const type: MomentTypeConfig = {
      id: 'r_test',
      phase: 'attack',
      chainOnly: true,
      weights: {},
      textVariants: 1,
      options: [o('safe', 'safe'), o('risky', 'risky')],
    };
    const c: GameContext = {
      ...ctx,
      config: {
        ...ctx.config,
        match: {
          ...cfg,
          moments: {
            ...cfg.moments,
            types: [...cfg.moments.types, type],
            minChance: 0,
            maxChance: 1,
          },
        },
      },
    };
    const base = pendingState();
    const at = (minute: number, mine: number, theirs: number): GameState => {
      const m = withScore(base, minute, mine, theirs).currentMatch!;
      return {
        ...base,
        currentMatch: {
          ...m,
          pending: { momentId: 'r_test', minute, textVariant: 1, options: [0, 1] },
        },
      };
    };
    const late = risk.lateFrom + 5;
    const tied = getPendingMoment(at(late, 0, 0), c)!;
    const ahead = getPendingMoment(at(late, 1, 0), c)!;
    const behind = getPendingMoment(at(late, 0, 1), c)!;
    expect(ahead.options[0]!.chance).toBeCloseTo(tied.options[0]!.chance + risk.aheadSafeBonus, 12);
    expect(behind.options[1]!.chance).toBeCloseTo(tied.options[1]!.chance + risk.behindBonus, 12);
    expect(ahead.options[1]!.chance).toBeCloseTo(tied.options[1]!.chance, 12);

    for (const [state, moment] of [
      [at(late, 1, 0), ahead],
      [at(late, 0, 1), behind],
    ] as const) {
      moment.options.forEach((opt, i) => {
        const spy = vi.spyOn(Rng.prototype, 'chance');
        decideMoment(state, i, c);
        expect(spy.mock.calls[0]![0]).toBe(opt.chance);
        spy.mockRestore();
      });
    }
  });

  it('value follows the chain continuation and counts the legend bonus', () => {
    const base = {
      risk: 'balanced',
      success: { rating: 0.1, goalFor: 1, by: 'self', next: { momentId: 'x', chance: 0.5 } },
      failure: { rating: 0 },
    } as MomentOptionConfig;
    const plain = {
      ...base,
      success: { rating: 0.1, goalFor: 1, by: 'self' },
    } as MomentOptionConfig;
    // Seguito a probabilità 1: i gol dell'esito non contano, vale il seguito.
    const sure = {
      ...base,
      success: { rating: 0.1, goalFor: 1, by: 'self', next: { momentId: 'x' } },
    } as MomentOptionConfig;
    expect(optionValue(sure, 1, 0, cfg, () => 0.7)).toBeCloseTo(0.1 + 0.7, 12);
    // Con c = 0,5 i gol valgono la metà e il seguito l'altra metà.
    const goals = optionValue(plain, 1, 0, cfg) - 0.1;
    expect(optionValue(base, 1, 0, cfg, () => 0.7)).toBeCloseTo(0.1 + 0.5 * goals + 0.35, 12);
    const legend = { ...plain, legend: { id: 'l', minTension: 0, skills: { shooting: 1 } } };
    expect(optionValue(legend, 0.4, 0, cfg)).toBeCloseTo(
      optionValue(plain, 0.4, 0, cfg) + 0.4 * cfg.legends.ratingBonus,
      12,
    );
  });

  describe('valore del seguito di una catena', () => {
    const o = (
      id: string,
      success: MomentOptionConfig['success'],
      extra: Partial<MomentOptionConfig> = {},
    ): MomentOptionConfig => ({
      id,
      skills: { shooting: 1 },
      difficulty: -1000,
      risk: 'balanced',
      success,
      failure: { rating: 0 },
      ...extra,
    });
    const legend = { id: 'v_gesto', minTension: 0, skills: { shooting: 1 } };

    function build(opts: { effects?: boolean; weak?: boolean }): GameContext {
      const goEffects = opts.effects ? { effects: { nerves: 1 } } : {};
      const types: MomentTypeConfig[] = [
        {
          id: 'v_root',
          phase: 'attack',
          weights: {},
          textVariants: 1,
          options: [o('go', { rating: 0, next: { momentId: 'v_next' }, ...goEffects })],
        },
        {
          id: 'v_next',
          phase: 'attack',
          chainOnly: true,
          weights: {},
          textVariants: 1,
          options: [
            o('plain', { rating: opts.weak ? 1 : 0.1 }, opts.weak ? { difficulty: 0 } : {}),
            o('legend', { rating: 5 }, { risk: 'risky', legend }),
            o('keep', { rating: 0.1 }, { risk: 'safe', closes: true }),
          ],
        },
      ];
      return {
        ...ctx,
        config: {
          ...ctx.config,
          match: {
            ...cfg,
            dyn: {
              ...cfg.dyn,
              chanceWeight: { coachTrust: 0, nerves: 0.4, fatigue: 0, marking: 0 },
            },
            moments: {
              ...cfg.moments,
              types: [...cfg.moments.types, ...types],
              minChance: 0,
              maxChance: 1,
              formWeight: 0,
              moraleWeight: 0,
              freshnessWeight: 0,
              qualityMaxBonus: 0,
            },
          },
        },
      };
    }

    const goValue = (c: GameContext, legendsUsed: number): number => {
      const base = pendingState();
      const m = base.currentMatch!;
      const state: GameState = {
        ...base,
        currentMatch: {
          ...m,
          dyn: { coachTrust: 0, nerves: 0, fatigue: 0, marking: 0 },
          director: { ...m.director, legendsUsed },
          pending: { momentId: 'v_root', minute: 30, textVariant: 1, options: [0] },
        },
      };
      return getPendingMoment(state, c)!.options[0]!.value;
    };

    it('ignores legend options when the match quota is exhausted', () => {
      const c = build({});
      const perMatch = c.config.match.legends.perMatch;
      expect(goValue(c, 0)).toBeGreaterThan(5);
      expect(goValue(c, perMatch)).toBeLessThan(1);
    });

    it('applies the outcome effects before valuing the continuation', () => {
      const plain = build({ weak: true });
      const withEffects = build({ weak: true, effects: true });
      // Il tipo con "chiudi" e il gesto resta fuori quota: conta solo "plain", che dipende da nerves.
      const used = plain.config.match.legends.perMatch;
      expect(goValue(withEffects, used)).toBeGreaterThan(goValue(plain, used) + 0.05);
    });
  });
});

describe('injuryChance e freschezza', () => {
  const player = newCareer(baseOptions, 7).player;
  const at = (energy: number, injuryRisk = 50) => ({
    ...player,
    condition: { ...player.condition, energy, injuryRisk },
  });

  it('segue la curva: 0.6x a freschezza 100, 2x a 0', async () => {
    const { injuryChance } = await import('../src/player/progression');
    expect(injuryChance(0.025, at(100), defaultContext)).toBeCloseTo(0.015);
    expect(injuryChance(0.025, at(0), defaultContext)).toBeCloseTo(0.05);
  });

  it('ignora injuryRisk', async () => {
    const { injuryChance } = await import('../src/player/progression');
    expect(injuryChance(0.025, at(60, 0), defaultContext)).toBe(
      injuryChance(0.025, at(60, 100), defaultContext),
    );
  });
});
