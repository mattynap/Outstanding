import type { RngState } from './rng';

export type Role = 'GK' | 'DEF' | 'MID' | 'ATT';
export type Skill =
  | 'pace'
  | 'shooting'
  | 'passing'
  | 'dribbling'
  | 'defending'
  | 'physical'
  | 'vision'
  | 'goalkeeping';

export type Skills = Record<Skill, number>;

export interface Contract {
  clubId: string;
  salaryWeekly: number;
  /** Season number (inclusive) in which the contract expires. */
  untilSeason: number;
  amateur: boolean;
}

/** Statistics of one season (or of the season in progress). */
export interface SeasonStats {
  appearances: number;
  starts: number;
  minutes: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  /** Sum and count of match ratings, for the average (matches "senza voto" are excluded). */
  ratingSum: number;
  ratingCount: number;
}

export interface SeasonRecord {
  season: number;
  age: number;
  clubId: string | null;
  leagueLevel: number | null;
  ovr: number;
  stats: SeasonStats;
  /** Final league position of the player's club, if any. */
  leaguePosition: number | null;
  promoted: boolean;
  relegated: boolean;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  /** Absolute week of birth (can be negative: week 0 is the start of the first season). */
  birthWeek: number;
  /** Real Italian city. */
  hometown: string;
  role: Role;
  skills: Skills;
  /** Hidden ceiling for growth (60–95). Never shown directly to the player. */
  potential: number;
  condition: { form: number; energy: number; morale: number; injuryRisk: number };
  persona: { discipline: number; temperament: number; happiness: number };
  image: { popularity: number; reputation: number; followers: number };
  money: { cash: number; salaryWeekly: number; assets: number };
  /** Trait ids from content/traits.json. */
  traits: string[];
  injury?: { type: string; weeksLeft: number };
  contract?: Contract;
  clubId?: string;
  /** npcId -> -100..100 */
  relationships: Record<string, number>;
  flags: Record<string, number | boolean | string>;
  seasonStats: SeasonStats;
  history: SeasonRecord[];
}

export type CrestShape = 'shield' | 'circle' | 'oval';
export type KitPattern = 'solid' | 'vstripes' | 'hstripes' | 'sash';

/** Data needed to draw the club crest as SVG. */
export interface Crest {
  shape: CrestShape;
  primary: string;
  secondary: string;
  symbol: string;
  initials: string;
}

/** Data needed to draw the club kit as SVG. */
export interface Kit {
  primary: string;
  secondary: string;
  pattern: KitPattern;
}

/** A non-playable footballer in a club roster (compact on purpose: there are thousands). */
export interface RosterPlayer {
  id: string;
  firstName: string;
  lastName: string;
  role: Role;
  birthWeek: number;
  ovr: number;
}

export type Area = 'N' | 'C' | 'S';

export interface Club {
  id: string;
  name: string;
  shortName: string;
  city: string;
  area: Area;
  /** Deterministic seed for procedural graphics. */
  seed: number;
  crest: Crest;
  kit: Kit;
  /** Team strength 0–100, derived from the roster. */
  rating: number;
  roster: RosterPlayer[];
  coachId: string;
  /** Current league group id. */
  groupId: string;
}

export interface LeagueGroup {
  id: string;
  /** Group name text key (e.g. "Girone A"). */
  nameKey: string;
  area: Area | null;
  clubIds: string[];
}

export interface League {
  id: string;
  /** 1 = top flight. */
  level: number;
  nameKey: string;
  professional: boolean;
  groups: LeagueGroup[];
}

export interface Competition {
  id: string;
  nameKey: string;
  kind: 'nationalCup' | 'continentalCup';
}

export type NpcRole = 'coach' | 'agent';

export interface Npc {
  id: string;
  role: NpcRole;
  firstName: string;
  lastName: string;
  clubId?: string;
}

export interface Fixture {
  id: string;
  season: number;
  /** Absolute week. */
  week: number;
  matchday: number;
  leagueId: string;
  groupId: string;
  homeId: string;
  awayId: string;
  result?: { home: number; away: number };
}

export interface World {
  clubs: Club[];
  leagues: League[];
  competitions: Competition[];
  npcs: Npc[];
}

export interface GameState {
  saveVersion: number;
  seed: number;
  rngState: RngState;
  /** Absolute week (0 = first week of the first season). */
  week: number;
  /** Current season number, starting at 1. */
  season: number;
  player: Player;
  world: World;
  calendar: Fixture[];
  eventLog: { eventId: string; week: number; choice: number }[];
  /** eventId -> absolute week when the event becomes available again. */
  cooldowns: Record<string, number>;
  /** Event chains. */
  scheduled: { eventId: string; atWeek: number }[];
  /** Monotonic counter used to build unique ids. */
  nextId: number;
}
