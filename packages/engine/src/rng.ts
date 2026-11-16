/**
 * Seeded pseudo-random number generator (xoshiro128**).
 *
 * The engine never uses Math.random: every random draw goes through an Rng whose 4-word state is
 * stored in GameState.rngState, so a career is fully reproducible from its seed and choices.
 * Only integer ops are used for the core generator, so sequences are identical on every JS engine.
 */
export type RngState = [number, number, number, number];

/** splitmix32: expands a 32-bit seed into well-mixed state words. */
function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
}

const rotl = (x: number, k: number) => ((x << k) | (x >>> (32 - k))) >>> 0;

export class Rng {
  private s: RngState;

  private constructor(state: RngState) {
    this.s = [...state] as RngState;
    if (this.s.every((w) => w === 0)) this.s[0] = 1; // xoshiro must not be all zero
  }

  /** Creates a generator from an integer seed. */
  static fromSeed(seed: number): Rng {
    const next = splitmix32(seed);
    return new Rng([next(), next(), next(), next()]);
  }

  /** Restores a generator from a saved state. */
  static fromState(state: readonly number[]): Rng {
    if (state.length !== 4) throw new Error('Rng state must have 4 words');
    return new Rng(state.map((w) => w >>> 0) as RngState);
  }

  /** Current state, to be stored back into GameState. */
  getState(): RngState {
    return [...this.s] as RngState;
  }

  /** Derives an independent generator (e.g. one per club) without disturbing sequences much. */
  fork(): Rng {
    return Rng.fromSeed(this.nextUint32());
  }

  nextUint32(): number {
    const s = this.s;
    const result = Math.imul(rotl(Math.imul(s[1], 5) >>> 0, 7), 9) >>> 0;
    const t = (s[1] << 9) >>> 0;
    s[2] = (s[2] ^ s[0]) >>> 0;
    s[3] = (s[3] ^ s[1]) >>> 0;
    s[1] = (s[1] ^ s[2]) >>> 0;
    s[0] = (s[0] ^ s[3]) >>> 0;
    s[2] = (s[2] ^ t) >>> 0;
    s[3] = rotl(s[3], 11);
    return result;
  }

  /** Float in [0, 1). */
  next(): number {
    return this.nextUint32() / 4294967296;
  }

  /** Integer in [min, max] (both inclusive). */
  int(min: number, max: number): number {
    if (max < min) throw new Error(`Rng.int: max (${max}) < min (${min})`);
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Float in [min, max). */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Approximately normal value (Irwin–Hall with 12 uniforms: no transcendental functions). */
  normal(mean = 0, sd = 1): number {
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += this.next();
    return mean + (sum - 6) * sd;
  }

  /** Random element of a non-empty array. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: empty array');
    return items[this.int(0, items.length - 1)] as T;
  }

  /** Weighted pick; items with weight <= 0 are never chosen. */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T {
    let total = 0;
    for (const it of items) total += Math.max(0, weight(it));
    if (total <= 0) throw new Error('Rng.weighted: no positive weights');
    let r = this.next() * total;
    for (const it of items) {
      const w = Math.max(0, weight(it));
      if (r < w) return it;
      r -= w;
    }
    // Floating point fallback: last item with positive weight.
    for (let i = items.length - 1; i >= 0; i--) {
      if (weight(items[i] as T) > 0) return items[i] as T;
    }
    throw new Error('unreachable');
  }

  /** Returns a shuffled copy (Fisher–Yates). */
  shuffle<T>(items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [out[i], out[j]] = [out[j] as T, out[i] as T];
    }
    return out;
  }

  /** Poisson-distributed integer (Knuth; fine for the small lambdas used in match simulation). */
  poisson(lambda: number): number {
    if (lambda <= 0) return 0;
    const limit = Math.exp(-lambda);
    let k = 0;
    let p = this.next();
    while (p > limit) {
      k++;
      p *= this.next();
    }
    return k;
  }
}

/** Runs `fn` with an Rng restored from `state` and returns its result plus the new state. */
export function withRng<T>(state: readonly number[], fn: (rng: Rng) => T): [T, RngState] {
  const rng = Rng.fromState(state);
  const value = fn(rng);
  return [value, rng.getState()];
}
