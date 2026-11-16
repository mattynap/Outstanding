import { describe, expect, it } from 'vitest';
import { Rng } from '../src/rng';

const take = (rng: Rng, n: number) => Array.from({ length: n }, () => rng.nextUint32());

describe('Rng', () => {
  it('is deterministic for the same seed', () => {
    expect(take(Rng.fromSeed(42), 20)).toEqual(take(Rng.fromSeed(42), 20));
  });

  it('produces different sequences for different seeds', () => {
    expect(take(Rng.fromSeed(1), 10)).not.toEqual(take(Rng.fromSeed(2), 10));
  });

  it('matches a frozen reference sequence (guards against accidental changes)', () => {
    const rng = Rng.fromSeed(12345);
    const seq = take(rng, 5);
    // If this fails, saved games would replay differently: only change it on purpose.
    expect(seq).toMatchInlineSnapshot(`
      [
        518667457,
        440444462,
        4232892992,
        3757857622,
        3939018813,
      ]
    `);
  });

  it('resumes exactly from a saved state', () => {
    const a = Rng.fromSeed(7);
    take(a, 13);
    const b = Rng.fromState(a.getState());
    expect(take(a, 10)).toEqual(take(b, 10));
  });

  it('int stays in range and covers both ends', () => {
    const rng = Rng.fromSeed(99);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = rng.int(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6, 7]);
  });

  it('next() is roughly uniform', () => {
    const rng = Rng.fromSeed(5);
    const n = 20000;
    let total = 0;
    for (let i = 0; i < n; i++) total += rng.next();
    expect(total / n).toBeGreaterThan(0.48);
    expect(total / n).toBeLessThan(0.52);
  });

  it('normal() has the requested mean and spread', () => {
    const rng = Rng.fromSeed(11);
    const n = 20000;
    const xs = Array.from({ length: n }, () => rng.normal(70, 8));
    const mean = xs.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
    expect(mean).toBeGreaterThan(69.5);
    expect(mean).toBeLessThan(70.5);
    expect(sd).toBeGreaterThan(7.5);
    expect(sd).toBeLessThan(8.5);
  });

  it('weighted() respects weights and never picks zero weights', () => {
    const rng = Rng.fromSeed(3);
    const counts = { a: 0, b: 0, c: 0 };
    const weights = { a: 1, b: 3, c: 0 };
    for (let i = 0; i < 8000; i++) {
      counts[rng.weighted(['a', 'b', 'c'] as const, (k) => weights[k])]++;
    }
    expect(counts.c).toBe(0);
    expect(counts.b / counts.a).toBeGreaterThan(2.6);
    expect(counts.b / counts.a).toBeLessThan(3.4);
  });

  it('shuffle returns a permutation without mutating the input', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = Rng.fromSeed(8).shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...out].sort()).toEqual(input);
  });

  it('poisson() has the requested mean', () => {
    const rng = Rng.fromSeed(21);
    const n = 20000;
    let total = 0;
    for (let i = 0; i < n; i++) total += rng.poisson(1.4);
    expect(total / n).toBeGreaterThan(1.35);
    expect(total / n).toBeLessThan(1.45);
  });
});
