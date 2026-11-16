import type { Difficulty } from '@outstanding/config';
import type { RngState } from './rng';

export type { Difficulty };

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
  /** Trofei vinti con il club: id del campionato (titolo del girone) o della coppa. */
  trophies: string[];
}

/** Aspetto dell'avatar: indici nelle tavolozze di content/avatar.json. */
export interface Appearance {
  skin: number;
  hairColor: number;
  hairStyle: number;
  face: number;
  beard: number;
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
  appearance: Appearance;
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
  /** Club in cui gioca: quello del contratto, o quello del prestito. */
  clubId?: string;
  /** Prestito in corso: il contratto resta con il club proprietario. */
  loan?: { parentClubId: string; untilSeason: number };
  agentId?: string;
  /** Tenore di vita (id da config/economy.json). */
  lifestyle: string;
  sponsors: SponsorDeal[];
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

/** Dati comuni a tutti i club, italiani e stranieri. */
export interface ClubBase {
  id: string;
  name: string;
  shortName: string;
  city: string;
  /** Seme deterministico per la grafica procedurale. */
  seed: number;
  crest: Crest;
  kit: Kit;
  /** Forza della squadra 0–100, ricavata dalla rosa. */
  rating: number;
  roster: RosterPlayer[];
}

/** Club della piramide italiana. */
export interface Club extends ClubBase {
  area: Area;
  coachId: string;
  /** Id del girone di campionato attuale. */
  groupId: string;
}

/** Club straniero: esiste solo per le coppe europee. */
export interface ForeignClub extends ClubBase {
  /** Id del paese in content/foreign.json. */
  country: string;
  /** Fascia di forza (indice in config/cups.json foreign.tiers). */
  tier: number;
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
  /** Solo procuratori: qualità da 1 a 5 stelle e commissione sugli incassi. */
  quality?: number;
  commission?: number;
}

/** Contratto di sponsorizzazione attivo. */
export interface SponsorDeal {
  sponsorId: string;
  weeklyIncome: number;
  untilSeason: number;
}

export interface SponsorOffer extends SponsorDeal {
  id: string;
  expiresWeek: number;
}

/** Offerta di contratto da un club (trasferimento, prestito o rinnovo). */
export interface ContractOffer {
  id: string;
  kind: 'transfer' | 'loan' | 'renewal';
  clubId: string;
  salaryWeekly: number;
  seasons: number;
  signingBonus: number;
  expiresWeek: number;
  /** Stipendio massimo che il club è disposto a pagare: nascosto al giocatore. */
  maxSalary: number;
  /** Rilanci rimasti prima che il club ritiri l'offerta. */
  roundsLeft: number;
}

export interface Retirement {
  season: number;
  week: number;
  age: number;
  reason: 'age' | 'no_offers' | 'choice';
}

export interface Score {
  home: number;
  away: number;
}

/** Fase di una coppa: preliminari, gironi o turni a eliminazione diretta. */
export type CupStage = 'r1' | 'r2' | 'r3' | 'group' | 'last32' | 'last16' | 'qf' | 'sf' | 'final';

/** Dati di una partita di coppa. */
export interface CupInfo {
  competitionId: string;
  stage: CupStage;
  /** Turno da 1 (0 = fase a gironi). */
  round: number;
  /** Sfida a eliminazione diretta (le due gare di andata e ritorno hanno lo stesso id). */
  tieId?: string;
  leg: 1 | 2;
  legs: 1 | 2;
  /** Campo neutro (finali): nessun vantaggio casalingo. */
  neutral: boolean;
}

export interface Fixture {
  id: string;
  season: number;
  /** Settimana assoluta. */
  week: number;
  matchday: number;
  /** Id del campionato o, per le coppe, della competizione. */
  leagueId: string;
  /** Id del girone (di campionato, di coppa, o del turno a eliminazione diretta). */
  groupId: string;
  homeId: string;
  awayId: string;
  /** Presente per le partite di coppa. */
  cup?: CupInfo;
  /** Risultato dei 90 minuti. */
  result?: Score;
  /** Gol dei tempi supplementari (solo gare decisive finite in parità). */
  extraTime?: Score;
  penalties?: Score;
}

/** Stato di una coppa nella stagione corrente. */
export interface CupState {
  competitionId: string;
  season: number;
  /** Partecipanti dal più forte al più debole. */
  participants: string[];
  /** Gironi (solo coppe europee). */
  groups: { id: string; letter: string; clubIds: string[] }[];
  /** Indice (in config) del prossimo turno a eliminazione diretta da sorteggiare. */
  nextRound: number;
  winnerId?: string;
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
  /** Club stranieri delle coppe europee (fuori dalla piramide e dal mercato). */
  foreignClubs: ForeignClub[];
  leagues: League[];
  competitions: Competition[];
  npcs: Npc[];
}

/** Aspetto di un club modificabile dall'editor. */
export interface ClubLook {
  name: string;
  shortName: string;
  initials: string;
  primary: string;
  secondary: string;
  pattern: KitPattern;
}

export interface PersonName {
  firstName: string;
  lastName: string;
}

/**
 * Modifiche dell'editor per questa carriera. Il mondo contiene i valori scelti dal giocatore; qui
 * restano i valori generati in origine, per ripristinarli e per riconoscere i club e le persone
 * quando si importa un file di modifiche.
 */
export interface WorldEdits {
  /** clubId -> aspetto generato in origine. */
  clubs: Record<string, ClubLook>;
  /** id di un calciatore delle rose, di un allenatore o di un procuratore -> nome originale. */
  people: Record<string, PersonName>;
  /** id del campionato (L1…L6) o della coppa -> nome scelto dal giocatore. */
  competitions: Record<string, string>;
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
  /** Coppe della stagione corrente. */
  cups: CupState[];
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
  /** Settimana per cui le azioni sono già state scelte (-1 = mai). */
  plannedWeek: number;
  offers: ContractOffer[];
  sponsorOffers: SponsorOffer[];
  /** Settimana in cui il mercato è già stato aggiornato (-1 = mai). */
  marketWeek: number;
  /** Presente quando la carriera è finita. */
  retired?: Retirement;
  /** Contatore crescente usato per creare id univoci. */
  nextId: number;
  /** Partita del giocatore iniziata e non ancora finita. */
  currentMatch?: MatchState;
  /** Modifiche dell'editor (assente finché il giocatore non cambia nulla). */
  edits?: WorldEdits;
  /** Difficoltà scelta alla creazione (assente nei salvataggi precedenti: vale quella predefinita). */
  difficulty?: Difficulty;
}
