import { Worker } from 'node:worker_threads';
import type { Difficulty } from '@outstanding/engine';
import { runCareer, type CareerResult } from './run';
import type { StrategyId, StrategyOptions } from './strategies';

/** Semi delle carriere ricavati dal seme principale: la stessa esecuzione dà sempre gli stessi numeri. */
export function careerSeeds(seed: number, careers: number): number[] {
  return Array.from(
    { length: careers },
    (_, i) => (Math.imul(seed >>> 0, 1_000_003) + i + 1) >>> 0,
  );
}

/**
 * Gioca le carriere, in parallelo su `workers` thread (1 = nello stesso thread). I risultati
 * tornano nell'ordine dei semi, qualunque sia il numero di thread.
 */
export async function simulate(
  seeds: readonly number[],
  strategy: StrategyId,
  workers: number,
  onProgress?: (done: number) => void,
  difficulty?: Difficulty,
  options: StrategyOptions = {},
): Promise<CareerResult[]> {
  const order = new Map(seeds.map((s, i) => [s, i]));
  const results: CareerResult[] = new Array(seeds.length);
  let done = 0;
  const collect = (r: CareerResult) => {
    results[order.get(r.seed)!] = r;
    onProgress?.(++done);
  };
  if (workers <= 1) {
    for (const seed of seeds) collect(runCareer(seed, strategy, undefined, difficulty, options));
    return results;
  }
  const chunks: number[][] = Array.from({ length: workers }, () => []);
  seeds.forEach((s, i) => chunks[i % workers]!.push(s));
  await Promise.all(
    chunks
      .filter((c) => c.length > 0)
      .map(
        (chunk) =>
          new Promise<void>((resolve, reject) => {
            const worker = new Worker(new URL('./worker.ts', import.meta.url), {
              workerData: { seeds: chunk, strategy, difficulty, options },
            });
            worker.on('message', collect);
            worker.on('error', reject);
            worker.on('exit', (code) =>
              code === 0 ? resolve() : reject(new Error(`Worker exited with code ${code}`)),
            );
          }),
      ),
  );
  return results;
}
