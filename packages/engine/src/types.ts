import type { ChapterId, Difficulty, Interest, InterviewContext } from '@outstanding/config';
import type { PartnerHair, TattooZone } from '@outstanding/content';
import type { RngState } from './rng';

export type { ChapterId };

export type { Difficulty, Interest, InterviewContext, PartnerHair, TattooZone };

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

/** Carico settimanale scelto dal giocatore; `recovery` vale solo per chi è infortunato. */
export type Load = 'rest' | 'balanced' | 'push';
export type EffectiveLoad = Load | 'recovery';

export interface WeekInProgress {
  /** Carico effettivo applicato da `planWeek`; assente se la settimana non è ancora pianificata. */
  load?: EffectiveLoad;
  life?: LifeAction;
  freshnessDelta: number;
}

/** Azione facoltativa fuori dal campo del piano settimanale. */
export type LifeAction = 'family' | 'leisure' | 'sponsor' | 'party';

/** Piano di una settimana: carico obbligatorio, focus e azione fuori dal campo facoltativi. */
export interface WeekPlan {
  load: Load;
  focus?: Skill;
  life?: LifeAction;
}

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

/** Parti dell'avatar scelte per indice nelle liste di content/avatar.json. */
export interface AppearanceIndices {
  skin: number;
  hairColor: number;
  hairStyle: number;
  face: number;
  beard: number;
  body: number;
  eyes: number;
  eyeColor: number;
  brows: number;
  nose: number;
  earring: number;
  necklace: number;
  headband: number;
}

/** Aspetto dell'avatar: parti per indice, tatuaggi per zona e invecchiamento visibile. */
export interface Appearance extends AppearanceIndices {
  /** Id del tatuaggio (content/avatar.json) per zona; zona assente = nessun tatuaggio. */
  tattoos: Partial<Record<TattooZone, string>>;
  /** Se vero, con l'età capelli e barba ingrigiscono e la fronte si stempia. */
  ageing: boolean;
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
  /** `energy` è la freschezza (0–100). */
  condition: { form: number; energy: number; morale: number };
  persona: {
    discipline: number;
    /** Valore verso cui la disciplina torna ogni settimana. */
    disciplineBase: number;
    temperament: number;
    happiness: number;
  };
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
  /** Presenze della stagione in corso per livello di campionato (livello -> presenze): serve all'esordio. */
  seasonLevelApps?: Record<string, number>;
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
  /** Un osservatore segue il giocatore in questa partita (estratto la settimana prima). */
  scout?: boolean;
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
  | {
      kind: 'moment';
      minute: number;
      momentId: string;
      optionId: string;
      success: boolean;
      /** Qualità del gesto del giocatore, 0–1 (0,5 neutro). */
      quality: number;
      /** Passo risolto in automatico, non mostrato al giocatore (rapida, simulata). */
      auto?: true;
    }
  /** Preavviso: il momento si apre poco dopo (Task A5). */
  | { kind: 'buildup'; minute: number; momentId: string; textKey: string };

/** Momento chiave in attesa della scelta del giocatore. */
export interface PendingMoment {
  momentId: string;
  minute: number;
  /** Variante di testo, da 1. */
  textVariant: number;
  /** Passo di una catena di momenti, se ne fa parte. */
  chain?: { rootId: string; step: number };
  /** Indici delle opzioni della config disponibili, fissati all'apertura. */
  options: number[];
}

export type MatchMode = 'full' | 'quick' | 'sim';

/** Dinamiche della partita che dipendono dal giocatore. */
export interface MatchDyn {
  coachTrust: number;
  nerves: number;
  fatigue: number;
  marking: number;
}

/** Stato del regista della partita: budget di interventi, preavviso, respiro. */
export interface DirectorState {
  budgetStart: number;
  budgetLeft: number;
  /** Passi ancora mostrati al giocatore (rapida, simulata); assente = tutti visibili. */
  visibleLeft?: number;
  /** Passi riservati rimasti nel finale caldo; null = non ancora valutato. */
  hotLeft: number | null;
  lastAt: number | null;
  interventions: number;
  /**
   * Preavviso: il momento si apre al minuto `at`. `forced` = minimo garantito, immune ai gol.
   */
  armed: { at: number; momentId: string; forced?: boolean } | null;
  /** Respiro dopo un gol o la fine di una catena. */
  relaxUntil: number | null;
  /** Ultimi tipi proposti (massimo 3). */
  lastTypes: string[];
  legendsUsed: number;
  /** Passo decisivo: il passo aperto a tensione più alta, con il suo esito. */
  peak: { minute: number; momentId: string; tension: number; success: boolean } | null;
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
  /** Minuto raggiunto dalla simulazione (0–90). */
  minute: number;
  mode: MatchMode;
  /** Pressione −1..1: positivo = spinge la squadra del giocatore. */
  pressure: number;
  /** Pressione per minuto giocato, arrotondata a 2 decimali; lunghezza = minute. */
  trace: number[];
  director: DirectorState;
  dyn: MatchDyn;
  /** Posta in gioco 0..1, calcolata a beginMatch. */
  stakes: number;
  /** Momento da leggenda vissuto, letto dal report (Task A7b). */
  legend: { id: string; success: boolean } | null;
  score: { home: number; away: number };
  events: MatchEvent[];
  pending: PendingMoment | null;
  /** Somma delle variazioni di voto dovute ai momenti chiave. */
  ratingDelta: number;
  goals: number;
  assists: number;
}

/** Una partita scelta dal regista della stagione: `full` è la più importante del capitolo. */
export interface ChapterPick {
  fixtureId: string;
  mode: 'full' | 'quick';
}

/** Registro delle partite del giocatore in un tratto di stagione (capitolo o tratto fra due stop). */
export interface ChapterLog {
  /** Partite giocate da titolare. */
  starts: number;
  goals: number;
  assists: number;
  ratingSum: number;
  ratingCount: number;
  cleanSheets: number;
  /** Gol segnati nelle partite scelte. */
  pickedGoals: number;
  /** Momenti da leggenda vissuti. */
  legends: number;
  /** Passo decisivo più recente: settimana, partita ed esito. */
  decisive: { week: number; fixtureId: string; success: boolean } | null;
  /** Notizie risolte (di persona o in automatico). */
  events: number;
  /** Voto migliore (a parità, il più recente). */
  bestRating: { week: number; fixtureId: string; rating: number } | null;
  /** Ultima partita del giocatore: esito e gol (per i titoli di prima pagina). */
  lastResult: {
    week: number;
    fixtureId: string;
    result: 'win' | 'draw' | 'loss';
    goalsFor: number;
    goalsAgainst: number;
  } | null;
  /** Ultimo momento da leggenda vissuto. */
  lastLegend: { week: number; fixtureId: string; id: string; success: boolean } | null;
}

/** Obiettivo del capitolo corrente: la definizione sta in `content/data/chapter-goals.json`. */
export interface ChapterGoalState {
  id: string;
  target: number;
  /** Già liquidato (ricompensa o calo di morale applicati): non si liquida due volte. */
  settled: boolean;
}

/** Obiettivo di capitolo già liquidato, per la bacheca. */
export interface ChapterGoalRecord {
  season: number;
  chapter: ChapterId;
  goalId: string;
  target: number;
  met: boolean;
}

/** Il capitolo corrente della stagione e le partite che il giocatore vivrà in prima persona. */
export interface ChapterState {
  id: ChapterId;
  picks: ChapterPick[];
  /** Obiettivo assegnato a inizio capitolo (assente in preparazione); il progresso si legge da `log`. */
  goal: ChapterGoalState | null;
  /** Obiettivo del capitolo precedente, escluso dalla prossima estrazione. */
  lastGoalId: string | null;
  log: ChapterLog;
  /** Come `log`, dal precedente stop: si azzera quando il controllo torna al giocatore. */
  stretch: ChapterLog;
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
  /** Settimana per cui il piano è già stato applicato (-1 = mai). */
  plannedWeek: number;
  /** Ultimo piano settimanale scelto: l'app lo ripropone, l'avanti veloce lo ripete. */
  lastPlan?: WeekPlan;
  /** Capitolo corrente della stagione (v3). */
  chapter: ChapterState;
  /** Piano valido per tutto il capitolo (v4); `null` finché non è scelto. */
  chapterPlan: WeekPlan | null;
  /** Settimane della stagione passate a ogni carico, recupero compreso (pesano il declino). */
  seasonLoadWeeks: Record<EffectiveLoad, number>;
  /**
   * Settimana in corso: carico e vita applicati e freschezza ancora da sommare (carico, vita,
   * partite). La chiude `advanceWeek` con un solo clamp al tetto del carico; assente fra una
   * settimana e l'altra.
   */
  weekInProgress?: WeekInProgress;
  /** Obiettivi di capitolo liquidati, in ordine (assente nei salvataggi precedenti). */
  goalRecords?: ChapterGoalRecord[];
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
  /** Patrimonio: deposito, investimenti, beni, attività e prestiti (assente nei salvataggi vecchi). */
  finance?: Finance;
  /** Vita privata: relazione, figli, ex (assente nei salvataggi vecchi). */
  privateLife?: PrivateLife;
  /** Social, interviste e conferenze stampa (assente nei salvataggi vecchi). */
  media?: MediaState;
}

/** Una voce del feed social: commento di un tifoso, post del giocatore o titolo di giornale. */
export interface FeedItem {
  week: number;
  kind: 'fan' | 'post' | 'press';
  /** Nome utente del tifoso (solo commenti). */
  author?: string;
  textKey: string;
  params: Record<string, string>;
  likes: number;
  tone: 'pos' | 'neg' | 'neutral';
}

/** La partita appena giocata, per l'intervista. */
export interface MatchMedia {
  fixtureId: string;
  week: number;
  context: InterviewContext;
  opponent: string;
}

export interface MediaState {
  /** Dal più recente. */
  feed: FeedItem[];
  /** Settimana dell'ultimo post (-1 = mai). */
  postWeek: number;
  lastMatch?: MatchMedia;
  /** Partita dell'ultima intervista già fatta. */
  interviewed?: string;
  /** Club in cui il giocatore va presentato in conferenza stampa. */
  presentation?: string;
  /** Conferenze già fatte (chiavi delle partite e delle presentazioni, le più recenti). */
  pressDone: string[];
  /** Effetto della conferenza sui momenti chiave di una partita. */
  boost?: { fixtureId: string; chance: number };
}

export type Gender = 'f' | 'm';
export type PartnerStage = 'dating' | 'engaged' | 'married';

/** Una persona della vita privata, con quanto serve per il ritratto. */
export interface PrivatePerson {
  firstName: string;
  lastName: string;
  gender: Gender;
  /** Id del mestiere (content/private.json). */
  job: string;
  /** Indici in content/avatar.json (carnagione, colore dei capelli) e acconciatura. */
  skin: number;
  hairColor: number;
  hair: PartnerHair;
}

/** La persona conosciuta di recente: si può invitare a uscire fino a `expiresWeek`. */
export interface Prospect extends PrivatePerson {
  expiresWeek: number;
}

export interface Partner extends PrivatePerson {
  stage: PartnerStage;
  /** Settimana in cui è iniziata la relazione e in cui è iniziata la fase attuale. */
  sinceWeek: number;
  stageWeek: number;
  /** Intesa della coppia 0–100: in basso c'è la crisi, a zero la fine. */
  affinity: number;
}

export interface Child {
  id: string;
  firstName: string;
  gender: Gender;
  birthWeek: number;
  /** Falso dopo un divorzio: il figlio vive con l'altro genitore e si paga l'assegno. */
  withPlayer: boolean;
}

export interface ExPartner {
  firstName: string;
  lastName: string;
  gender: Gender;
  endedWeek: number;
  stage: PartnerStage;
}

export interface PrivateLife {
  /** Da chi è attratto il giocatore (scelto alla creazione, modificabile). */
  interest: Interest;
  partner?: Partner;
  prospect?: Prospect;
  children: Child[];
  exes: ExPartner[];
  /** Storia segreta in corso. */
  affair?: { sinceWeek: number };
  /** Figlio in arrivo. */
  expecting?: { dueWeek: number };
  /** Settimana dell'ultima azione privata (-1 = mai). */
  actionWeek: number;
}

/** Quote di un titolo o di una moneta possedute e quanto sono costate in tutto. */
export interface Holding {
  units: number;
  invested: number;
}

/** Un bene comprato dal catalogo (casa, auto, barca...). */
export interface OwnedProperty {
  id: string;
  catalogId: string;
  boughtWeek: number;
  /** Prezzo pagato. */
  price: number;
  /** Valore di mercato attuale. */
  value: number;
}

/** Mutuo (legato a un immobile) o prestito personale, rimborsato a rate settimanali. */
export interface Loan {
  id: string;
  kind: 'mortgage' | 'personal';
  /** Immobile del mutuo. */
  propertyId?: string;
  principal: number;
  /** Debito residuo. */
  remaining: number;
  weeklyPayment: number;
  weeklyRate: number;
  weeksLeft: number;
  /** Rate non pagate di fila. */
  missed: number;
}

/** Attività aperta dal giocatore (ristorante, marchio...). */
export interface Business {
  id: string;
  catalogId: string;
  /** Nome scelto dal giocatore. */
  name: string;
  openedWeek: number;
  cost: number;
  /** Andamento 0–100: sotto la soglia di pareggio perde soldi, quasi a zero chiude. */
  health: number;
  lastResult: number;
  totalResult: number;
}

export interface Finance {
  /** Saldo del conto deposito. */
  deposit: number;
  /** Prezzo attuale e storico recente di ogni titolo (uguali per tutti: è il mercato). */
  prices: Record<string, number>;
  history: Record<string, number[]>;
  holdings: Record<string, Holding>;
  properties: OwnedProperty[];
  businesses: Business[];
  loans: Loan[];
}
