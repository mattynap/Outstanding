/** API pubblica del motore di gioco. */
export const ENGINE_VERSION = '0.1.0';

export type * from './types';
export { Rng, type RngState } from './rng';
export { defaultContext, type GameContext } from './context';
export { newCareer, type NewCareerOptions } from './career';
export { computeOvr, SKILLS, ROLES } from './player/ratings';
export { ageAt, weekOfSeason, seasonStartWeek } from './time';
export { computeStandings, type StandingRow } from './season/standings';
export { roundRobin, matchdayWeeks } from './season/schedule';
export {
  advanceWeek,
  getTransferWindow,
  isSeasonOver,
  playerFixture,
  type TransferWindow,
  type WeekReport,
} from './season/week';
export { endSeason, type SeasonReport, type ClubMovement } from './season/endSeason';
export { getClub, getGroup, getLeagueByLevel, playerClub } from './world/queries';
export {
  serialize,
  deserialize,
  migrate,
  CURRENT_SAVE_VERSION,
  type Migration,
} from './save/serialize';
