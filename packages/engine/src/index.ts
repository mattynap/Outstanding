/** API pubblica del motore di gioco. */
export const ENGINE_VERSION = '0.1.0';

export type * from './types';
export { Rng, type RngState } from './rng';
export { defaultContext, type GameContext } from './context';
export { newCareer, type NewCareerOptions } from './career';
export { careerDifficulty, difficultyMods } from './difficulty';
export {
  APPEARANCE_LISTS,
  APPEARANCE_PARTS,
  FIXED_PARTS,
  STYLE_PARTS,
  appearanceSizes,
  changeLook,
  completeAppearance,
  getTattoo,
  lookChangeCost,
  tattooUnlocked,
  type AppearancePart,
} from './player/look';
export { TATTOO_ZONES } from '@outstanding/content';
export {
  annuityPayment,
  applyWeeklyWealth,
  businessValue,
  buyInstrument,
  buyProperty,
  createFinance,
  depositCash,
  financeOf,
  loanQuote,
  mainBusiness,
  netWorth,
  openBusiness,
  repayLoan,
  sellBusiness,
  sellInstrument,
  sellProperty,
  takePersonalLoan,
  updateMarket,
  withdrawCash,
  type LoanKind,
  type LoanQuote,
  type WealthWeek,
} from './finance/finance';
export { DIFFICULTIES, INTERESTS, TONES } from '@outstanding/config';
export {
  answerInterview,
  answerPress,
  applyWeeklyMedia,
  bigMatchKind,
  createMedia,
  followersBonus,
  getInterview,
  getPostOptions,
  getPressConference,
  interviewContext,
  mediaOf,
  naturalFollowers,
  pressBonus,
  publishPost,
  type InterviewView,
  type MediaWeek,
  type PostOption,
  type PostReport,
  type PressKind,
  type PressReport,
  type PressView,
  type Tone,
} from './media/media';
export {
  applyParty,
  applyWeeklyPrivate,
  breakUp,
  createPrivateLife,
  doPrivateAction,
  endAffair,
  getPrivateActions,
  privateOf,
  relationshipState,
  scaledCost,
  setInterest,
  type BreakupReport,
  type PartyReport,
  type PrivateActionReport,
  type PrivateActionView,
  type PrivateOutcome,
  type PrivateWeek,
  type RelationshipState,
} from './private/private';
export {
  careerScore,
  careerTotals,
  isLegend,
  type CareerScore,
  type CareerTotals,
} from './career/score';
export { computeOvr, SKILLS, ROLES } from './player/ratings';
export { ageAt, weekOfSeason, seasonStartWeek } from './time';
export { computeStandings, type StandingRow } from './season/standings';
export { roundRobin, matchdayWeeks } from './season/schedule';
export {
  advanceWeek,
  getTransferWindow,
  isSeasonOver,
  playerFixture,
  playerFixtures,
  type TransferWindow,
  type WeekReport,
} from './season/week';
export { endSeason, type SeasonReport, type ClubMovement } from './season/endSeason';
export {
  autoDecider,
  beginMatch,
  decideMoment,
  getPendingMoment,
  playMatch,
  simulateMatch,
  type KeyMomentDecider,
  type MatchDecision,
  type MatchReport,
  type MatchStep,
} from './match/match';
export { optionChance, type KeyMoment, type KeyMomentOption } from './match/moments';
export {
  checkConditions,
  drawWeekEvents,
  getPendingEvents,
  resolveEvent,
  type EventChange,
  type EventReport,
  type EventView,
} from './events/events';
export { getStat } from './events/stats';
export {
  fastForward,
  prudentChoice,
  repeatPlan,
  type FastForwardReport,
  type FastForwardStop,
  type FastForwardTarget,
} from './season/fastForward';
export {
  getWeekOptions,
  planWeek,
  skipToNextMatch,
  type WeekChoice,
  type WeekOption,
  type WeekPlanReport,
} from './season/plan';
export { applyGrowth, applyDecline, growthMultiplier } from './player/progression';
export {
  acceptOffer,
  clubLevel,
  getOffers,
  marketSalary,
  negotiateOffer,
  perceivedOvr,
  refreshMarket,
  rejectOffer,
  type NegotiationResult,
  type OfferView,
} from './market/offers';
export {
  acceptSponsor,
  applyWeeklyFinances,
  fireAgent,
  getAgentCandidates,
  getSponsorOffers,
  hireAgent,
  rejectSponsor,
  retire,
  setLifestyle,
  type WeekFinance,
} from './market/life';
export {
  clubCups,
  continentalQualifiers,
  cupGroupTables,
  settleKnockout,
  stageFor,
  tieWinner,
} from './cups/cups';
export {
  clubRatings,
  getAnyClub,
  getClub,
  getGroup,
  getLeagueByLevel,
  levelOfClub,
  playerClub,
} from './world/queries';
export {
  clubLook,
  competitionIds,
  editClub,
  editCount,
  editPerson,
  emptyEdits,
  originalClubLook,
  originalPersonName,
  pruneEdits,
  resetAllEdits,
  resetClub,
  resetPerson,
  setCompetitionName,
  worldPeople,
  type PersonKind,
  type PersonRef,
} from './world/edits';
export { KIT_PATTERNS } from './world/club';
export {
  serialize,
  deserialize,
  migrate,
  CURRENT_SAVE_VERSION,
  type Migration,
} from './save/serialize';
