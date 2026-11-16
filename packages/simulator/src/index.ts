/** Simulatore di carriere: gioca carriere complete senza interfaccia per il bilanciamento. */
export {
  runCareer,
  randomCareerOptions,
  SECONDS_PER,
  type CareerResult,
  type Decisions,
} from './run';
export { careerSeeds, simulate } from './simulate';
export {
  formatTable,
  groupMetrics,
  summarize,
  type GroupMetrics,
  type SimSummary,
} from './metrics';
export { getStrategy, STRATEGIES, type Strategy, type StrategyId } from './strategies';
