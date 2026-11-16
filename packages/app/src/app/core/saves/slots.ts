/**
 * Slot di salvataggio: un file per slot più un indice con i riepiloghi, così la schermata iniziale
 * non deve leggere e decomprimere le carriere intere. L'archivio vero (Capacitor o memoria nei test)
 * è passato dall'esterno.
 */
import {
  ageAt,
  getAnyClub,
  weekOfSeason,
  type GameContext,
  type GameState,
} from '@outstanding/engine';
import { decodeSave, encodeSave } from './codec';

/** Numero di carriere salvabili in parallelo. */
export const SLOT_COUNT = 3;

/** Operazioni minime sull'archivio del dispositivo. */
export interface SaveBackend {
  readFile(path: string): Promise<string | null>;
  writeFile(path: string, data: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  /** Sposta un file sostituendo la destinazione se esiste. */
  moveFile(from: string, to: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** Riepilogo di uno slot per la schermata iniziale. */
export interface SlotSummary {
  slot: number;
  playerName: string;
  clubName: string | null;
  season: number;
  week: number;
  age: number;
  retired: boolean;
  /** Millisecondi dall'epoca Unix dell'ultimo salvataggio. */
  savedAt: number;
  bytes: number;
}

export type SlotView = { slot: number; summary: SlotSummary | null };

const INDEX_KEY = 'outstanding.slots';
const LAST_KEY = 'outstanding.lastSlot';
/** Salvataggio unico di M9, da spostare nello slot 1. */
export const LEGACY_KEY = 'outstanding.autosave';

const fileOf = (slot: number) => `slot-${slot}.sav`;
const tmpOf = (slot: number) => `slot-${slot}.tmp`;

export function summarize(
  state: GameState,
  slot: number,
  bytes: number,
  now: number,
  ctx: GameContext,
): SlotSummary {
  const p = state.player;
  // Dopo il ritiro il giocatore non ha più un club: si mostra l'ultimo.
  const clubId = p.clubId ?? p.history.at(-1)?.clubId ?? null;
  const club = clubId ? getAnyClub(state.world, clubId) : null;
  return {
    slot,
    playerName: `${p.firstName} ${p.lastName}`,
    clubName: club?.name ?? null,
    season: state.season,
    week: weekOfSeason(state.week, ctx.config.calendar) + 1,
    age: state.retired?.age ?? ageAt(p.birthWeek, state.week, ctx.config.calendar),
    retired: Boolean(state.retired),
    savedAt: now,
    bytes,
  };
}

export class SlotStore {
  constructor(
    private readonly backend: SaveBackend,
    private readonly ctx: GameContext,
    private readonly now: () => number = () => Date.now(),
  ) {}

  private async readIndex(): Promise<Record<string, SlotSummary>> {
    const raw = await this.backend.getItem(INDEX_KEY);
    if (!raw) return {};
    try {
      return JSON.parse(raw) as Record<string, SlotSummary>;
    } catch {
      return {};
    }
  }

  private async writeIndex(index: Record<string, SlotSummary>): Promise<void> {
    await this.backend.setItem(INDEX_KEY, JSON.stringify(index));
  }

  /** Tutti gli slot, occupati o vuoti, in ordine. */
  async list(): Promise<SlotView[]> {
    const index = await this.readIndex();
    return Array.from({ length: SLOT_COUNT }, (_, i) => ({
      slot: i + 1,
      summary: index[String(i + 1)] ?? null,
    }));
  }

  /** Ultimo slot usato, se ancora occupato. */
  async lastSlot(): Promise<number | null> {
    const raw = await this.backend.getItem(LAST_KEY);
    const slot = raw ? Number(raw) : NaN;
    const index = await this.readIndex();
    return Number.isInteger(slot) && index[String(slot)] ? slot : null;
  }

  /**
   * Carica uno slot. Se il file principale manca ma c'è quello temporaneo (salvataggio interrotto a
   * metà dello spostamento), usa quello. Lancia un errore se il salvataggio è illeggibile.
   */
  async load(slot: number): Promise<GameState | null> {
    const text =
      (await this.backend.readFile(fileOf(slot))) ?? (await this.backend.readFile(tmpOf(slot)));
    if (text === null) return null;
    const state = decodeSave(text);
    await this.backend.setItem(LAST_KEY, String(slot));
    return state;
  }

  /** Scrive prima un file temporaneo e poi lo sposta: un'interruzione non rovina il salvataggio. */
  async save(slot: number, state: GameState): Promise<SlotSummary> {
    const text = encodeSave(state);
    await this.backend.writeFile(tmpOf(slot), text);
    await this.backend.moveFile(tmpOf(slot), fileOf(slot));
    const summary = summarize(state, slot, text.length, this.now(), this.ctx);
    const index = await this.readIndex();
    index[String(slot)] = summary;
    await this.writeIndex(index);
    await this.backend.setItem(LAST_KEY, String(slot));
    return summary;
  }

  async remove(slot: number): Promise<void> {
    await this.backend.deleteFile(fileOf(slot));
    await this.backend.deleteFile(tmpOf(slot));
    const index = await this.readIndex();
    delete index[String(slot)];
    await this.writeIndex(index);
    if ((await this.backend.getItem(LAST_KEY)) === String(slot)) {
      await this.backend.removeItem(LAST_KEY);
    }
  }

  /** Primo slot libero, se c'è. */
  async freeSlot(): Promise<number | null> {
    return (await this.list()).find((s) => !s.summary)?.slot ?? null;
  }

  /**
   * Sposta il salvataggio unico di M9 nel primo slot libero (una sola volta). Un salvataggio
   * illeggibile resta dov'è, per non perdere dati.
   */
  async migrateLegacy(): Promise<boolean> {
    const legacy = await this.backend.getItem(LEGACY_KEY);
    if (!legacy) return false;
    const slot = await this.freeSlot();
    if (slot === null) return false;
    try {
      await this.save(slot, decodeSave(legacy));
    } catch {
      return false;
    }
    await this.backend.removeItem(LEGACY_KEY);
    return true;
  }
}
