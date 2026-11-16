/** Public API of the game engine. */
export const ENGINE_VERSION = '0.1.0';

export type * from './types';
export { Rng, type RngState } from './rng';
export { defaultContext, type GameContext } from './context';
export { newCareer, type NewCareerOptions } from './career';
export { computeOvr, SKILLS, ROLES } from './player/ratings';
export { ageAt, weekOfSeason, seasonStartWeek } from './time';
export {
  serialize,
  deserialize,
  migrate,
  CURRENT_SAVE_VERSION,
  type Migration,
} from './save/serialize';
