import { Injectable, computed, inject, signal } from '@angular/core';
import {
  acceptOffer,
  acceptSponsor,
  advanceWeek,
  beginMatch,
  computeOvr,
  decideMoment,
  defaultContext,
  deserialize,
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
  serialize,
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
import { StorageService } from './storage.service';

const SAVE_KEY = 'outstanding.autosave';

/** Cosa deve fare il giocatore adesso: guida il pulsante principale della settimana. */
export type NextStep =
  'retired' | 'seasonOver' | 'plan' | 'events' | 'matchInProgress' | 'match' | 'advance';

/**
 * Stato della partita in corso e unico punto di contatto tra le schermate e il motore.
 * Ogni azione chiama una funzione pura del motore, aggiorna lo stato e salva in automatico.
 */
@Injectable({ providedIn: 'root' })
export class GameService {
  private readonly storage = inject(StorageService);
  readonly ctx = defaultContext;

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

  /** Carica il salvataggio automatico, se c'è. */
  async load(): Promise<boolean> {
    const raw = await this.storage.get(SAVE_KEY);
    if (!raw) return false;
    try {
      this._state.set(deserialize(raw));
      return true;
    } catch {
      // Salvataggio illeggibile: si riparte dal menu senza perdere il file (M10 gestirà i dettagli).
      return false;
    }
  }

  async newGame(options: NewCareerOptions, seed: number): Promise<void> {
    this.resetReports();
    await this.commit(newCareer(options, seed, this.ctx));
  }

  async deleteGame(): Promise<void> {
    this._state.set(null);
    this.resetReports();
    await this.storage.remove(SAVE_KEY);
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
    return report;
  }

  async closeSeason(): Promise<SeasonReport> {
    const { state, seasonReport } = endSeason(this.require(), this.ctx);
    this.lastSeason.set(seasonReport);
    await this.commit(state);
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
    await this.commit(retire(this.require(), this.ctx));
  }

  // --- Interni -----------------------------------------------------------------------------

  private require(): GameState {
    const s = this._state();
    if (!s) throw new Error('No game loaded');
    return s;
  }

  private async commit(state: GameState): Promise<void> {
    this._state.set(state);
    await this.storage.set(SAVE_KEY, serialize(state));
  }

  private resetReports(): void {
    this.lastWeek.set(null);
    this.lastSeason.set(null);
    this.lastMatch.set(null);
    this.lastEvent.set(null);
  }
}
