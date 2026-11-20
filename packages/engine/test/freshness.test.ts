import { describe, expect, it } from 'vitest';
import { defaultContext as ctx } from '../src/index';
import {
  endOfWeekFreshness,
  growthFreshnessFactor,
  injuryFreshnessFactor,
  momentFreshnessModifier,
  selectionFreshnessPenalty,
} from '../src/player/freshness';

describe('freschezza', () => {
  it('fattore di crescita lineare da atZero a 1', () => {
    expect(growthFreshnessFactor(0, ctx)).toBeCloseTo(0.6);
    expect(growthFreshnessFactor(100, ctx)).toBeCloseTo(1);
    expect(growthFreshnessFactor(50, ctx)).toBeCloseTo(0.8);
  });
  it('fattore infortuni continuo da at0 a at100', () => {
    expect(injuryFreshnessFactor(100, ctx)).toBeCloseTo(0.6);
    expect(injuryFreshnessFactor(0, ctx)).toBeCloseTo(2);
    expect(Math.abs(injuryFreshnessFactor(29, ctx) - injuryFreshnessFactor(31, ctx))).toBeLessThan(
      0.03,
    );
  });
  it('penalità di selezione solo sotto la soglia', () => {
    expect(selectionFreshnessPenalty(30, ctx)).toBeCloseTo(3);
    expect(selectionFreshnessPenalty(70, ctx)).toBeCloseTo(0);
  });
  it('modificatore dei momenti', () => {
    expect(momentFreshnessModifier(100, ctx)).toBeCloseTo(0.06);
    expect(momentFreshnessModifier(50, ctx)).toBeCloseTo(0);
  });
  it('freschezza di fine settimana con un solo clamp', () => {
    expect(endOfWeekFreshness(95, 0, 70)).toBe(70);
    expect(endOfWeekFreshness(10, -30, 90)).toBe(0);
    expect(endOfWeekFreshness(50, 10, 90)).toBe(60);
  });
});
