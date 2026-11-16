/**
 * Generatore di numeri pseudo-casuali con seme (xoshiro128**).
 *
 * Il motore non usa mai Math.random: ogni estrazione passa da un Rng il cui stato (4 parole) è
 * salvato in GameState.rngState, così una carriera è interamente riproducibile da seme e scelte.
 * Il generatore usa solo operazioni intere, quindi le sequenze sono identiche su ogni motore JS.
 */
export type RngState = [number, number, number, number];

/** splitmix32: espande un seme a 32 bit in parole di stato ben mescolate. */
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
    if (this.s.every((w) => w === 0)) this.s[0] = 1; // lo stato di xoshiro non può essere tutto zero
  }

  /** Crea un generatore da un seme intero. */
  static fromSeed(seed: number): Rng {
    const next = splitmix32(seed);
    return new Rng([next(), next(), next(), next()]);
  }

  /** Ripristina un generatore da uno stato salvato. */
  static fromState(state: readonly number[]): Rng {
    if (state.length !== 4) throw new Error('Rng state must have 4 words');
    return new Rng(state.map((w) => w >>> 0) as RngState);
  }

  /** Stato corrente, da risalvare in GameState. */
  getState(): RngState {
    return [...this.s] as RngState;
  }

  /** Deriva un generatore indipendente (es. uno per club) senza alterare troppo le sequenze. */
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

  /** Numero decimale in [0, 1). */
  next(): number {
    return this.nextUint32() / 4294967296;
  }

  /** Intero in [min, max] (estremi inclusi). */
  int(min: number, max: number): number {
    if (max < min) throw new Error(`Rng.int: max (${max}) < min (${min})`);
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Numero decimale in [min, max). */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Vero con probabilità p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Valore approssimativamente normale (Irwin–Hall con 12 uniformi: nessuna funzione trascendente). */
  normal(mean = 0, sd = 1): number {
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += this.next();
    return mean + (sum - 6) * sd;
  }

  /** Elemento casuale di un array non vuoto. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: empty array');
    return items[this.int(0, items.length - 1)] as T;
  }

  /** Scelta pesata; gli elementi con peso <= 0 non vengono mai scelti. */
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
    // Ripiego per errori di arrotondamento: ultimo elemento con peso positivo.
    for (let i = items.length - 1; i >= 0; i--) {
      if (weight(items[i] as T) > 0) return items[i] as T;
    }
    throw new Error('unreachable');
  }

  /** Restituisce una copia mescolata (Fisher–Yates). */
  shuffle<T>(items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [out[i], out[j]] = [out[j] as T, out[i] as T];
    }
    return out;
  }

  /** Intero con distribuzione di Poisson (Knuth; adatto ai lambda piccoli della simulazione partite). */
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

/** Esegue `fn` con un Rng ripristinato da `state` e restituisce il risultato più il nuovo stato. */
export function withRng<T>(state: readonly number[], fn: (rng: Rng) => T): [T, RngState] {
  const rng = Rng.fromState(state);
  const value = fn(rng);
  return [value, rng.getState()];
}
