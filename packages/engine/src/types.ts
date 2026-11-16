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
  /** Numero della stagione (inclusa) in cui scade il contratto. */
  untilSeason: number;
  amateur: boolean;
}

/** Statistiche di una stagione (o di quella in corso). */
export interface SeasonStats {
  appearances: number;
  starts: number;
  minutes: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  /** Somma e numero dei voti in pagella, per la media (le partite "senza voto" sono escluse). */
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
  /** Posizione finale in campionato del club del giocatore, se presente. */
  leaguePosition: number | null;
  promoted: boolean;
  relegated: boolean;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  /** Settimana assoluta di nascita (può essere negativa: la settimana 0 è l'inizio della prima stagione). */
  birthWeek: number;
  /** Città italiana reale. */
  hometown: string;
  role: Role;
  skills: Skills;
  /** Tetto nascosto della crescita (60–95). Mai mostrato direttamente al giocatore. */
  potential: number;
  condition: { form: number; energy: number; morale: number; injuryRisk: number };
  persona: { discipline: number; temperament: number; happiness: number };
  image: { popularity: number; reputation: number; followers: number };
  money: { cash: number; salaryWeekly: number; assets: number };
  /** Id dei tratti da content/traits.json. */
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

/** Dati per disegnare lo stemma del club in SVG. */
export interface Crest {
  shape: CrestShape;
  primary: string;
  secondary: string;
  symbol: string;
  initials: string;
}

/** Dati per disegnare la maglia del club in SVG. */
export interface Kit {
  primary: string;
  secondary: string;
  pattern: KitPattern;
}

/** Un calciatore non giocabile nella rosa di un club (compatto apposta: sono migliaia). */
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
  /** Seme deterministico per la grafica procedurale. */
  seed: number;
  crest: Crest;
  kit: Kit;
  /** Forza della squadra 0–100, ricavata dalla rosa. */
  rating: number;
  roster: RosterPlayer[];
  coachId: string;
  /** Id del girone di campionato attuale. */
  groupId: string;
}

export interface LeagueGroup {
  id: string;
  /** Chiave di testo del nome del girone (es. "Girone A"). */
  nameKey: string;
  area: Area | null;
  clubIds: string[];
}

export interface League {
  id: string;
  /** 1 = massima serie. */
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
  /** Settimana assoluta. */
  week: number;
  matchday: number;
  leagueId: string;
  groupId: string;
  homeId: string;
  awayId: string;
  result?: { home: number; away: number };
}

/** Esito della convocazione: titolare, in panchina o fuori dai convocati. */
export type Selection = 'starter' | 'bench' | 'out';
export type Side = 'home' | 'away';

/** Un fatto della cronaca di una partita. */
export type MatchEvent =
  | {
      kind: 'goal';
      minute: number;
      side: Side;
      scorerName: string;
      assistName?: string;
      /** Vero se ha segnato il giocatore. */
      byPlayer: boolean;
      /** Vero se l'assist è del giocatore. */
      assistByPlayer: boolean;
    }
  | { kind: 'subIn' | 'subOut'; minute: number }
  | { kind: 'moment'; minute: number; momentId: string; optionId: string; success: boolean };

/** Momento chiave in attesa della scelta del giocatore. */
export interface PendingMoment {
  momentId: string;
  minute: number;
  /** Variante di testo, da 1. */
  textVariant: number;
}

/**
 * Partita del giocatore in corso. Viene salvata in GameState così si può interrompere e riprendere
 * a metà (anche durante un momento chiave).
 */
export interface MatchState {
  fixtureId: string;
  /** Lato del club del giocatore. */
  side: Side;
  opponentId: string;
  selection: Selection;
  /** Minuto di ingresso (0 per i titolari), null se il giocatore non entra. */
  minuteIn: number | null;
  /** Minuto di uscita (fine partita se resta in campo). */
  minuteOut: number;
  blocksDone: number;
  score: { home: number; away: number };
  events: MatchEvent[];
  /** Minuti dei momenti chiave ancora da giocare, in ordine. */
  momentMinutes: number[];
  pending: PendingMoment | null;
  /** Somma delle variazioni di voto dovute ai momenti chiave. */
  ratingDelta: number;
  goals: number;
  assists: number;
}

/** Evento estratto per la settimana, in attesa della scelta del giocatore. */
export interface PendingEvent {
  eventId: string;
  /** Variante di testo, da 1. */
  textVariant: number;
}

/** Richiesta di trasferimento nata da un evento; la gestisce il mercato (M7). */
export interface TransferRequest {
  to: 'higher_level' | 'same_level' | 'lower_level';
  week: number;
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
  /** Settimana assoluta (0 = prima settimana della prima stagione). */
  week: number;
  /** Numero della stagione corrente, a partire da 1. */
  season: number;
  player: Player;
  world: World;
  calendar: Fixture[];
  eventLog: { eventId: string; week: number; choice: number }[];
  /** eventId -> settimana assoluta in cui l'evento torna disponibile. */
  cooldowns: Record<string, number>;
  /** Catene di eventi. */
  scheduled: { eventId: string; atWeek: number }[];
  /** Eventi della settimana in attesa di risposta. */
  pendingEvents: PendingEvent[];
  /** Settimana per cui gli eventi sono già stati estratti (-1 = mai). */
  eventsWeek: number;
  transferRequests: TransferRequest[];
  /** Contatore crescente usato per creare id univoci. */
  nextId: number;
  /** Partita del giocatore iniziata e non ancora finita. */
  currentMatch?: MatchState;
}
