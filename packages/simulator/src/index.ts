/** Simulatore di carriere: gioca carriere complete senza interfaccia per il bilanciamento. */
export {
  runCareer,
  randomCareerOptions,
  estimateSeconds,
  type CareerResult,
  type ChapterStats,
  type Decisions,
} from './run';
export { careerSeeds, simulate } from './simulate';
export {
  formatTable,
  groupMetrics,
  timeMetrics,
  summarize,
  type Distribution,
  type GroupMetrics,
  type TimeMetrics,
  type SimSummary,
} from './metrics';
export {
  getStrategy,
  STRATEGIES,
  type Strategy,
  type StrategyId,
  type StrategyOptions,
} from './strategies';
