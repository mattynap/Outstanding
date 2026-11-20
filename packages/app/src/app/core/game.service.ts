import { Injectable, computed, inject, signal } from '@angular/core';
import {
  acceptOffer,
  acceptSponsor,
  advanceToStop,
  beginMatch,
  buyInstrument,
  buyProperty,
  careerDifficulty,
  depositCash,
  openBusiness,
  repayLoan,
  sellBusiness,
  sellInstrument,
  sellProperty,
  takePersonalLoan,
  withdrawCash,
  breakUp,
  answerInterview,
  answerPress,
  publishPost,
  doPrivateAction,
  endAffair,
  setInterest,
  changeLook,
  careerScore,
  computeOvr,
  decideMoment,
  defaultContext,
  editClub,
  editPerson,
  endSeason,
  fireAgent,
  getPendingEvents,
  getPendingMoment,
  hireAgent,
  negotiateOffer,
  newCareer,
  setChapterPlan,
  previewPlan,
  pruneEdits,
  rejectOffer,
  rejectSponsor,
  resetAllEdits,
  resetClub,
  resetPerson,
  resolveEvent,
  retire,
  setCompetitionName,
  setLifestyle,
  simulateMatch,
  type Appearance,
  type ClubLook,
  type EventReport,
  type BreakupReport,
  type FastForwardReport,
  type GameState,
  type Interest,
  type PostReport,
  type PressReport,
  type Tone,
  type PrivateActionReport,
  type MatchReport,
  type MatchDecision,
  type MatchStep,
  type NegotiationResult,
  type NewCareerOptions,
  type PersonName,
  type PlanPreview,
  type SeasonReport,
  type WeekPlan,
} from '@outstanding/engine';
import { trophyKey } from './career-view';
import { exportEdits, importEdits, type EditsFile, type ImportResult } from './editor/edits-file';
import { I18nService } from './i18n.service';
import { CapacitorSaveBackend } from './saves/capacitor-backend';
import { SlotStore, type SlotView } from './saves/slots';
import { UnlocksService } from './unlocks.service';
import { PlatformService } from './services/platform.service';
import { TutorialService } from './tutorial.service';
import { currentPick, nextStep, type NextStep } from './chapter-view';
import { clubInfo } from './views';

export type { NextStep } from './chapter-view';

/**
 * Stato della partita in corso e unico punto di contatto tra le schermate e il motore.
 * Ogni azione chiama una funzione pura del motore, aggiorna lo stato e salva in automatico.
 */
@Injectable({ providedIn: 'root' })
export class GameService {
  readonly ctx = defaultContext;
  private readonly platform = inject(PlatformService);
  private readonly i18n = inject(I18nService);
  private readonly tutorial = inject(TutorialService);
  private readonly unlocks = inject(UnlocksService);
  private readonly store = new SlotStore(new CapacitorSaveBackend(), this.ctx);

  /** Slot della carriera caricata e riepilogo di tutti gli slot. */
  readonly slot = signal<number | null>(null);
  readonly slots = signal<SlotView[]>([]);
  /** Vero se l'ultimo salvataggio automatico non è riuscito. */
  readonly saveFailed = signal(false);

  /** Coda di scrittura: si salva sempre l'ultimo stato, una scrittura alla volta. */
  private pending: { slot: number; state: GameState } | null = null;
  private writing: Promise<void> | null = null;

  private readonly _state = signal<GameState | null>(null);
  readonly state = this._state.asReadonly();
  readonly hasGame = computed(() => this._state() !== null);

  /** Ultimi resoconti, per le schermate di riepilogo. */
  /** Resoconto dell'ultimo "vai avanti": stop, partite simulate e titoli di prima pagina. */
  readonly lastStop = signal<FastForwardReport | null>(null);
  /** Prima pagina già chiusa dal giocatore: coincide con `lastStop` finché non arriva uno stop nuovo. */
  readonly frontSeen = signal<FastForwardReport | null>(null);
  readonly lastSeason = signal<SeasonReport | null>(null);
  readonly lastMatch = signal<MatchReport | null>(null);
  readonly lastEvent = signal<EventReport | null>(null);

  readonly ovr = computed(() => {
    const s = this._state();
    return s ? computeOvr(s.player.skills, s.player.role, this.ctx.config.ratings) : 0;
  });

  readonly nextStep = computed<NextStep | null>(() => {
    const s = this._state();
    return s ? nextStep(s, this.ctx) : null;
  });

  /** All'avvio: sposta il vecchio salvataggio unico negli slot e riapre l'ultima carriera. */
  async init(): Promise<void> {
    await this.store.migrateLegacy();
    await this.refreshSlots();
    const last = await this.store.lastSlot();
    if (last !== null) {
      try {
        await this.loadSlot(last);
      } catch {
        // Salvataggio illeggibile: si resta nel menu, dove lo slot risulta rovinato.
      }
    }
  }

  async refreshSlots(): Promise<void> {
    this.slots.set(await this.store.list());
  }

  /** Apre la carriera di uno slot. Lancia un errore se il salvataggio è illeggibile. */
  async loadSlot(slot: number): Promise<void> {
    await this.flush();
    const state = await this.store.load(slot);
    if (!state) throw new Error(`Slot ${slot} is empty`);
    this.resetReports();
    this.slot.set(slot);
    this.setState(state);
  }

  /** Primo slot libero per una nuova carriera. */
  freeSlot(): number | null {
    return this.slots().find((s) => !s.summary)?.slot ?? null;
  }

  async newGame(options: NewCareerOptions, seed: number, slot: number): Promise<void> {
    await this.flush();
    this.resetReports();
    // La carriera nuova sostituisce quella dello slot: la sua eventuale guida finisce.
    await this.tutorial.forgetSlot(slot);
    const state = newCareer(options, seed, this.ctx);
    await this.unlocks.start(slot, state);
    this.slot.set(slot);
    await this.commit(state);
    this.platform.track({
      name: 'career_start',
      role: state.player.role,
      startLevel: clubInfo(state, this.ctx)?.level ?? 0,
      difficulty: careerDifficulty(state, this.ctx),
    });
    await this.flush();
  }

  async deleteSlot(slot: number): Promise<void> {
    await this.flush();
    await this.store.remove(slot);
    await this.tutorial.forgetSlot(slot);
    await this.unlocks.forgetSlot(slot);
    if (this.slot() === slot) {
      this.slot.set(null);
      this.setState(null);
      this.resetReports();
    }
    await this.refreshSlots();
  }

  /** Attende che i salvataggi in coda siano scritti. */
  async flush(): Promise<void> {
    while (this.writing) await this.writing;
  }

  // --- Settimana ---------------------------------------------------------------------------

  /** Anteprima del piano sulla settimana corrente: nessun effetto sullo stato. */
  previewPlan(plan: WeekPlan): PlanPreview | null {
    const s = this.state();
    return s ? previewPlan(s, plan, this.ctx) : null;
  }

  /** Imposta il piano del capitolo: le settimane simulate lo ripetono. */
  async setPlan(plan: WeekPlan): Promise<void> {
    await this.commit(setChapterPlan(this.require(), plan, this.ctx));
  }

  /** Vai avanti fino al prossimo stop: partita scelta, notizia, offerta, fine capitolo o stagione. */
  async advanceToStop(): Promise<FastForwardReport> {
    const { state, report } = advanceToStop(this.require(), this.ctx);
    this.lastStop.set(report);
    await this.commit(state);
    this.trackRetirement(state);
    return report;
  }

  async closeSeason(): Promise<SeasonReport> {
    const { state, seasonReport } = endSeason(this.require(), this.ctx);
    this.lastSeason.set(seasonReport);
    this.lastStop.set(null);
    // Le modifiche di calciatori ritirati non servono più.
    await this.commit(pruneEdits(state));
    const r = seasonReport.record;
    this.platform.track({
      name: 'season_end',
      season: r.season,
      level: r.leagueLevel,
      promoted: r.promoted,
    });
    this.trackRetirement(state);
    return seasonReport;
  }

  // --- Eventi ------------------------------------------------------------------------------

  pendingEvents() {
    const s = this._state();
    return s ? getPendingEvents(s, this.ctx) : [];
  }

  async resolveEvent(eventId: string, choice: number): Promise<EventReport> {
    const { state, report } = resolveEvent(this.require(), eventId, choice, this.ctx);
    this.lastEvent.set(report);
    await this.commit(state);
    return report;
  }

  // --- Partita -----------------------------------------------------------------------------

  /** Riprende il momento chiave in sospeso o inizia la partita. */
  async startMatch(): Promise<MatchStep> {
    const s = this.require();
    if (s.currentMatch) {
      const moment = getPendingMoment(s, this.ctx);
      if (moment) return { kind: 'moment', moment };
    }
    // La modalità la decide il regista del capitolo (completa o rapida).
    const { state, step } = beginMatch(s, this.ctx, { mode: currentPick(s)?.mode ?? 'full' });
    return this.afterStep(state, step);
  }

  async decide(option: number | MatchDecision): Promise<MatchStep> {
    const { state, step } = decideMoment(this.require(), option, this.ctx);
    return this.afterStep(state, step);
  }

  async simulate(): Promise<MatchReport> {
    const { state, matchReport } = simulateMatch(this.require(), this.ctx);
    this.lastMatch.set(matchReport);
    await this.commit(state);
    return matchReport;
  }

  private async afterStep(state: GameState, step: MatchStep): Promise<MatchStep> {
    if (step.kind === 'finished') this.lastMatch.set(step.report);
    await this.commit(state);
    return step;
  }

  // --- Mercato e vita ----------------------------------------------------------------------

  async acceptOffer(id: string): Promise<void> {
    await this.commit(acceptOffer(this.require(), id, this.ctx));
  }

  async rejectOffer(id: string): Promise<void> {
    await this.commit(rejectOffer(this.require(), id));
  }

  async negotiate(
    id: string,
    ask: { salaryWeekly: number; seasons: number },
  ): Promise<NegotiationResult> {
    const { state, result } = negotiateOffer(this.require(), id, ask, this.ctx);
    await this.commit(state);
    return result;
  }

  async acceptSponsor(id: string): Promise<void> {
    await this.commit(acceptSponsor(this.require(), id, this.ctx));
  }

  async rejectSponsor(id: string): Promise<void> {
    await this.commit(rejectSponsor(this.require(), id));
  }

  async hireAgent(id: string): Promise<void> {
    await this.commit(hireAgent(this.require(), id, this.ctx));
  }

  async fireAgent(): Promise<void> {
    await this.commit(fireAgent(this.require()));
  }

  // --- Patrimonio ------------------------------------------------------------------------------

  async deposit(amount: number): Promise<void> {
    await this.commit(depositCash(this.require(), amount, this.ctx));
  }

  async withdraw(amount: number): Promise<void> {
    await this.commit(withdrawCash(this.require(), amount, this.ctx));
  }

  async buyInstrument(id: string, amount: number): Promise<void> {
    await this.commit(buyInstrument(this.require(), id, amount, this.ctx));
  }

  async sellInstrument(id: string, units?: number): Promise<number> {
    const r = sellInstrument(this.require(), id, units, this.ctx);
    await this.commit(r.state);
    return r.proceeds;
  }

  async buyProperty(id: string, mortgageSeasons: number | null): Promise<void> {
    await this.commit(buyProperty(this.require(), id, mortgageSeasons, this.ctx));
  }

  async sellProperty(id: string): Promise<number> {
    const r = sellProperty(this.require(), id, this.ctx);
    await this.commit(r.state);
    return r.proceeds;
  }

  async takeLoan(amount: number, seasons: number): Promise<void> {
    await this.commit(takePersonalLoan(this.require(), amount, seasons, this.ctx));
  }

  async repayLoan(id: string): Promise<void> {
    await this.commit(repayLoan(this.require(), id, this.ctx));
  }

  async openBusiness(id: string, name: string): Promise<void> {
    await this.commit(openBusiness(this.require(), id, name, this.ctx));
  }

  async sellBusiness(id: string): Promise<number> {
    const r = sellBusiness(this.require(), id, this.ctx);
    await this.commit(r.state);
    return r.proceeds;
  }

  /** Barbiere, accessori e tatuatore: cambia l'aspetto e restituisce quanto è costato. */
  async changeLook(next: Appearance): Promise<number> {
    const { state, cost } = changeLook(this.require(), next, this.ctx);
    await this.commit(state);
    return cost;
  }

  // --- Media ------------------------------------------------------------------------------

  async publishPost(id: string): Promise<PostReport> {
    const { state, report } = publishPost(this.require(), id, this.ctx);
    await this.commit(state);
    return report;
  }

  /** Risponde all'intervista dopo la partita (`null` = nessun commento). */
  async answerInterview(tone: Tone | null): Promise<void> {
    await this.commit(answerInterview(this.require(), tone, this.ctx));
  }

  async answerPress(tones: Tone[]): Promise<PressReport> {
    const { state, report } = answerPress(this.require(), tones, this.ctx);
    await this.commit(state);
    return report;
  }

  // --- Vita privata ------------------------------------------------------------------------

  async privateAction(id: string): Promise<PrivateActionReport> {
    const { state, report } = doPrivateAction(this.require(), id, this.ctx);
    await this.commit(state);
    return report;
  }

  async breakUp(): Promise<BreakupReport> {
    const { state, report } = breakUp(this.require(), this.ctx);
    await this.commit(state);
    return report;
  }

  async endAffair(): Promise<void> {
    await this.commit(endAffair(this.require(), this.ctx));
  }

  async setInterest(interest: Interest): Promise<void> {
    await this.commit(setInterest(this.require(), interest, this.ctx));
  }

  async setLifestyle(id: string): Promise<void> {
    await this.commit(setLifestyle(this.require(), id, this.ctx));
  }

  async retire(): Promise<void> {
    const state = retire(this.require(), this.ctx);
    await this.commit(state);
    this.trackRetirement(state);
  }

  // --- Editor ------------------------------------------------------------------------------

  async editClub(clubId: string, changes: Partial<ClubLook>): Promise<void> {
    await this.commit(editClub(this.require(), clubId, changes, this.ctx));
  }

  async resetClub(clubId: string): Promise<void> {
    await this.commit(resetClub(this.require(), clubId));
  }

  async editPerson(personId: string, name: PersonName): Promise<void> {
    await this.commit(editPerson(this.require(), personId, name, this.ctx));
  }

  async resetPerson(personId: string): Promise<void> {
    await this.commit(resetPerson(this.require(), personId));
  }

  async setCompetitionName(competitionId: string, name: string | null): Promise<void> {
    await this.commit(setCompetitionName(this.require(), competitionId, name, this.ctx));
  }

  async resetEdits(): Promise<void> {
    await this.commit(resetAllEdits(this.require()));
  }

  exportEdits(): EditsFile {
    return exportEdits(this.require(), this.ctx);
  }

  /** Importa un file di modifiche. Lancia `EditsFileError` se il file non è utilizzabile. */
  async importEdits(text: string): Promise<Omit<ImportResult, 'state'>> {
    const { state, applied, skipped } = importEdits(this.require(), text, this.ctx);
    await this.commit(state);
    return { applied, skipped };
  }

  // --- Interni -----------------------------------------------------------------------------

  private require(): GameState {
    const s = this._state();
    if (!s) throw new Error('No game loaded');
    return s;
  }

  /** Aggiorna lo stato subito e mette in coda il salvataggio automatico dello slot. */
  private async commit(state: GameState): Promise<void> {
    this.setState(state);
    const slot = this.slot();
    if (slot === null) return;
    this.pending = { slot, state };
    this.writing ??= this.drain();
  }

  /** Nuovo stato, con i nomi delle competizioni scelti nell'editor passati ai testi. */
  private setState(state: GameState | null): void {
    this._state.set(state);
    const names = state?.edits?.competitions ?? {};
    this.i18n.setOverrides(
      Object.fromEntries(Object.entries(names).map(([id, name]) => [trophyKey(id), name])),
    );
  }

  private async drain(): Promise<void> {
    try {
      while (this.pending) {
        const { slot, state } = this.pending;
        this.pending = null;
        try {
          const summary = await this.store.save(slot, state);
          // Riepilogo aggiornato senza rileggere l'indice: nessuna attesa fuori dal ciclo.
          this.slots.update((list) => list.map((v) => (v.slot === slot ? { slot, summary } : v)));
          this.saveFailed.set(false);
        } catch {
          this.saveFailed.set(true);
        }
      }
    } finally {
      this.writing = null;
    }
  }

  /** Statistica anonima di fine carriera (parte solo con il consenso del giocatore). */
  private trackRetirement(state: GameState): void {
    if (!state.retired) return;
    this.platform.track({
      name: 'retire',
      age: state.retired.age,
      seasons: state.player.history.length,
      tier: careerScore(state.player.history, state.player.role, this.ctx).tierId,
    });
  }

  private resetReports(): void {
    this.lastStop.set(null);
    this.lastSeason.set(null);
    this.lastMatch.set(null);
    this.lastEvent.set(null);
  }
}
