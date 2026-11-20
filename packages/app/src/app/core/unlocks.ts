import { getTransferWindow, type GameState } from '@outstanding/engine';

export type TabId = 'week' | 'profile' | 'market' | 'standings' | 'career';

export const TAB_IDS: readonly TabId[] = ['week', 'profile', 'market', 'standings', 'career'];
const ORDER = TAB_IDS;

/** Chiave dello StorageService con le voci della barra già annunciate per uno slot. */
export const unlocksKey = (slot: number): string => `unlocks.${slot}`;

/**
 * Voci della barra in basso visibili: le funzioni si aprono a gradini, così la prima sessione
 * mostra solo l'essenziale. Una voce già vista resta, anche se la condizione non vale più.
 */
export function visibleTabs(s: GameState, offers: number, seen: readonly TabId[] = []): TabId[] {
  const played = s.player.history.length > 0;
  const show: Record<TabId, boolean> = {
    week: true,
    profile: true,
    standings: true,
    // La finestra estiva d'apertura non conta: la prima sessione resta con tre voci.
    market:
      getTransferWindow(s) === 'winter' ||
      (getTransferWindow(s) !== null && played) ||
      !s.player.clubId ||
      offers > 0 ||
      played ||
      seen.includes('market'),
    // La bacheca si apre col primo obiettivo di capitolo chiuso.
    career: played || (s.goalRecords?.length ?? 0) > 0 || seen.includes('career'),
  };
  return ORDER.filter((t) => show[t]);
}

/**
 * Voci comparse da annunciare e nuovo elenco delle viste. Senza dati salvati (carriera di prima
 * dell'aggiornamento) tutto ciò che è visibile conta come già visto: nessuna raffica di novità.
 */
export function newTabs(
  visible: readonly TabId[],
  seen: readonly TabId[] | null,
): { tabs: TabId[]; seen: TabId[] } {
  if (seen === null) return { tabs: [], seen: [...visible] };
  const tabs = visible.filter((t) => !seen.includes(t));
  return { tabs, seen: ORDER.filter((t) => seen.includes(t) || tabs.includes(t)) };
}

/** Legge l'elenco salvato; un valore rovinato vale come assente. */
export function parseSeen(raw: string | null): TabId[] | null {
  if (raw === null) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? ORDER.filter((t) => v.includes(t)) : null;
  } catch {
    return null;
  }
}

/** Archivio chiave-valore minimo (StorageService nella app, memoria nei test). */
export interface UnlockBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

interface UnlockRecord {
  career: string;
  seen: TabId[];
}

// Identità della carriera: una carriera nuova nello stesso slot non deve ereditare le voci.
const careerKey = (s: GameState): string => `${s.seed}:${s.player.firstName} ${s.player.lastName}`;

function parseRecord(raw: string | null): UnlockRecord | null {
  if (raw === null) return null;
  try {
    const v = JSON.parse(raw) as Partial<UnlockRecord> | null;
    const seen = parseSeen(JSON.stringify(v?.seen ?? null));
    return typeof v?.career === 'string' && seen ? { career: v.career, seen } : null;
  } catch {
    return null;
  }
}

/**
 * Voci della barra già viste, per slot. Senza dati salvati la carriera è di prima di questa
 * versione: tutte le voci restano aperte. Le carriere nuove partono da `start`.
 */
export class UnlockStore {
  private readonly records = new Map<number, UnlockRecord>();

  constructor(private readonly backend: UnlockBackend) {}

  /** Voci visibili con quello che è già in memoria (nessuna lettura dall'archivio). */
  visible(slot: number | null, s: GameState, offers: number): TabId[] {
    const r = slot === null ? undefined : this.records.get(slot);
    const seen = r && r.career === careerKey(s) ? r.seen : [];
    return visibleTabs(s, offers, seen);
  }

  /** Carriera nuova nello slot: vede solo le voci di partenza. */
  async start(slot: number, s: GameState): Promise<void> {
    const r = { career: careerKey(s), seen: visibleTabs(s, 0) };
    this.records.set(slot, r);
    await this.backend.set(unlocksKey(slot), JSON.stringify(r));
  }

  async forget(slot: number): Promise<void> {
    this.records.delete(slot);
    await this.backend.remove(unlocksKey(slot));
  }

  /** Registra le voci comparse e le restituisce, da annunciare. */
  async sync(slot: number, s: GameState, offers: number): Promise<TabId[]> {
    const career = careerKey(s);
    let r = this.records.get(slot);
    if (!r) {
      const stored = parseRecord(await this.backend.get(unlocksKey(slot)));
      // Un'altra operazione può aver scritto lo slot mentre si leggeva.
      r = this.records.get(slot) ?? stored ?? { career, seen: [...TAB_IDS] };
      this.records.set(slot, r);
    }
    // Stato di un'altra carriera (pagina rimasta aperta dopo un cambio): si ignora.
    if (r.career !== career) return [];
    const { tabs, seen } = newTabs(visibleTabs(s, offers, r.seen), r.seen);
    if (tabs.length === 0) return [];
    this.records.set(slot, { career, seen });
    await this.backend.set(unlocksKey(slot), JSON.stringify({ career, seen }));
    return tabs;
  }
}
