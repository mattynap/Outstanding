import { describe, expect, it } from 'vitest';
import type { MomentOptionConfig } from '@outstanding/config';
import {
  advanceWeek,
  beginMatch,
  chanceBandOf,
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
});
