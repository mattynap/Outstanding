import { describe, expect, it } from 'vitest';
import { defaultContext, Rng } from '../src/index';
import { goalChancePerMinute, pushFor, stepPressure } from '../src/match/pressure';

const cfg = defaultContext.config.match.pressure;

describe('stepPressure', () => {
  it('resta sempre in [-1, 1]', () => {
    const rng = Rng.fromSeed(7);
    for (const push of [-5, 0, 5]) {
      let p = 0;
      for (let i = 0; i < 1000; i++) {
        p = stepPressure(p, push, push, rng, cfg);
        expect(p).toBeGreaterThanOrEqual(-1);
        expect(p).toBeLessThanOrEqual(1);
      }
    }
  });

  it('il lato più forte ha pressione media positiva su 10k minuti', () => {
    const rng = Rng.fromSeed(11);
    const push = pushFor({ home: 70, away: 60 }, 'home', false, cfg);
    let p = 0;
    let sum = 0;
    for (let i = 0; i < 10000; i++) {
      p = stepPressure(p, push, 0, rng, cfg);
      sum += p;
    }
    expect(sum / 10000).toBeGreaterThan(0);
    expect(pushFor({ home: 70, away: 60 }, 'away', false, cfg)).toBeLessThan(0);
  });

  it('a pari rating il campo di casa spinge, quello neutro no', () => {
    const r = { home: 60, away: 60 };
    expect(pushFor(r, 'home', false, cfg)).toBeGreaterThan(0);
    expect(pushFor(r, 'home', true, cfg)).toBe(0);
  });

  it('stesso seme, stessa serie', () => {
    const run = () => {
      const rng = Rng.fromSeed(5);
      let p = 0;
      return Array.from({ length: 50 }, () => (p = stepPressure(p, 0.01, 0, rng, cfg)));
    };
    expect(run()).toEqual(run());
  });
});

describe('goalChancePerMinute', () => {
  it('cresce con la pressione ed è normalizzata', () => {
    expect(goalChancePerMinute(1.4, 0.5, 90, cfg)).toBeGreaterThan(
      goalChancePerMinute(1.4, -0.5, 90, cfg),
    );
    const norm = Math.exp((cfg.goalBoost * cfg.sigma) ** 2 / 2);
    expect(goalChancePerMinute(1.4, 0, 90, cfg)).toBeCloseTo(1.4 / 90 / norm, 10);
  });
});
