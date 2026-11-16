import { parentPort, workerData } from 'node:worker_threads';
import { runCareer } from './run';
import type { StrategyId } from './strategies';

/** Thread di lavoro: gioca le carriere dei semi ricevuti e restituisce i risultati. */
const { seeds, strategy } = workerData as { seeds: number[]; strategy: StrategyId };
for (const seed of seeds) parentPort!.postMessage(runCareer(seed, strategy));
