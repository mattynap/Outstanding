import { parentPort, workerData } from 'node:worker_threads';
import type { Difficulty } from '@outstanding/engine';
import { runCareer } from './run';
import type { StrategyId, StrategyOptions } from './strategies';

/** Thread di lavoro: gioca le carriere dei semi ricevuti e restituisce i risultati. */
const { seeds, strategy, difficulty, options } = workerData as {
  seeds: number[];
  strategy: StrategyId;
  difficulty?: Difficulty;
  options?: StrategyOptions;
};
for (const seed of seeds)
  parentPort!.postMessage(runCareer(seed, strategy, undefined, difficulty, options));
