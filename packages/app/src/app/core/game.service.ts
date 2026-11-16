import { Injectable, computed, inject, signal } from '@angular/core';
import {
  acceptOffer,
  acceptSponsor,
  advanceWeek,
  beginMatch,
  careerScore,
  computeOvr,
  decideMoment,
  defaultContext,
  drawWeekEvents,
  endSeason,
  fireAgent,
  getPendingEvents,
  getPendingMoment,
  hireAgent,
  isSeasonOver,
  negotiateOffer,
  newCareer,
  planWeek,
  playerFixture,
  rejectOffer,
  rejectSponsor,
  resolveEvent,
  retire,
  setLifestyle,
  simulateMatch,
  skipToNextMatch,
  type EventReport,
  type GameState,
  type MatchReport,
  type MatchStep,
  type NegotiationResult,
  type NewCareerOptions,
  type SeasonReport,
  type WeekChoice,
  type WeekReport,
} from '@outstanding/engine';
import { CapacitorSaveBackend } from './saves/capacitor-backend';
import { SlotStore, type SlotView } from './saves/slots';
import { PlatformService } from './services/platform.service';
import { clubInfo } from './views';

/** Cosa deve fare il giocatore adesso: guida il pulsante principale della settimana. */
export type NextStep =
  'retired' | 'seasonOver' | 'plan' | 'events' | 'matchInProgress' | 'match' | 'advance';

/**
 * Stato della partita in corso e unico punto di contatto tra le schermate e il motore.
 * Ogni azione chiama una funzione pura del motore, aggiorna lo stato e salva in automatico.
 */
@Injectable({ providedIn: 'root' })
export class GameService {
  readonly ctx = defaultContext;
  private readonly platform = inject(PlatformService);
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
  readonly lastWeek = signal<WeekReport | null>(null);
  readonly lastSeason = signal<SeasonReport | null>(null);
  readonly lastMatch = signal<MatchReport | null>(null);
  readonly lastEvent = signal<EventReport | null>(null);

  readonly ovr = computed(() => {
    const s = this._state();
    return s ? computeOvr(s.player.skills, s.player.role, this.ctx.config.ratings) : 0;
  });

  readonly nextStep = computed<NextStep | null>(() => {
    const s = this._state();
    if (!s) return null;
    if (s.retired) return 'retired';
    if (s.currentMatch) return 'matchInProgress';
    if (isSeasonOver(s, this.ctx)) return 'seasonOver';
    if (s.plannedWeek !== s.week) return 'plan';
    if (s.pendingEvents.length > 0) return 'events';
    if (playerFixture(s)) return 'match';
    return 'advance';
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
    this._state.set(state);
  }

  /** Primo slot libero per una nuova carriera. */
  freeSlot(): number | null {
    return this.slots().find((s) => !s.summary)?.slot ?? null;
  }

  async newGame(options: NewCareerOptions, seed: number, slot: number): Promise<void> {
    await this.flush();
    this.resetReports();
    this.slot.set(slot);
    const state = newCareer(options, seed, this.ctx);
    await this.commit(state);
    this.platform.track({
      name: 'career_start',
      role: state.player.role,
      startLevel: clubInfo(state, this.ctx)?.level ?? 0,
    });
    await this.flush();
  }

  async deleteSlot(slot: number): Promise<void> {
    await this.flush();
    await this.store.remove(slot);
    if (this.slot() === slot) {
      this.slot.set(null);
      this._state.set(null);
      this.resetReports();
    }
    await this.refreshSlots();
  }

  /** Attende che i salvataggi in coda siano scritti. */
  async flush(): Promise<void> {
    while (this.writing) await this.writing;
  }

  // --- Settimana ---------------------------------------------------------------------------

  /** Conferma il piano e pesca le notizie della settimana. Restituisce quante notizie ci sono. */
  async plan(choices: WeekChoice[]): Promise<number> {
    const planned = planWeek(this.require(), choices, this.ctx).state;
    const drawn = drawWeekEvents(planned, this.ctx);
    await this.commit(drawn.state);
    return drawn.events.length;
  }

  /** Salta le settimane senza partite con il piano automatico. */
  async skipToMatch(): Promise<number> {
    const { state, weeksSkipped } = skipToNextMatch(this.require(), this.ctx);
    await this.commit(state);
    return weeksSkipped;
  }

  async advance(): Promise<WeekReport> {
    const { state, report } = advanceWeek(this.require(), this.ctx);
    this.lastWeek.set(report);
    await this.commit(state);
    this.trackRetirement(state);
    return report;
  }

  async closeSeason(): Promise<SeasonReport> {
    const { state, seasonReport } = endSeason(this.require(), this.ctx);
    this.lastSeason.set(seasonReport);
    await this.commit(state);
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
    const { state, step } = beginMatch(s, this.ctx);
    return this.afterStep(state, step);
  }

  async decide(option: number): Promise<MatchStep> {
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

  async setLifestyle(id: string): Promise<void> {
    await this.commit(setLifestyle(this.require(), id, this.ctx));
  }

  async retire(): Promise<void> {
    const state = retire(this.require(), this.ctx);
    await this.commit(state);
    this.trackRetirement(state);
  }

  // --- Interni -----------------------------------------------------------------------------

  private require(): GameState {
    const s = this._state();
    if (!s) throw new Error('No game loaded');
    return s;
  }

  /** Aggiorna lo stato subito e mette in coda il salvataggio automatico dello slot. */
  private async commit(state: GameState): Promise<void> {
    this._state.set(state);
    const slot = this.slot();
    if (slot === null) return;
    this.pending = { slot, state };
    this.writing ??= this.drain();
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
    this.lastWeek.set(null);
    this.lastSeason.set(null);
    this.lastMatch.set(null);
    this.lastEvent.set(null);
  }
}
