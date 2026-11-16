import { parentPort, workerData } from 'node:worker_threads';
import type { Difficulty } from '@outstanding/engine';
import { runCareer } from './run';
import type { StrategyId } from './strategies';

/** Thread di lavoro: gioca le carriere dei semi ricevuti e restituisce i risultati. */
const { seeds, strategy, difficulty } = workerData as {
  seeds: number[];
  strategy: StrategyId;
  difficulty?: Difficulty;
};
for (const seed of seeds) parentPort!.postMessage(runCareer(seed, strategy, undefined, difficulty));
