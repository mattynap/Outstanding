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
    career: played || seen.includes('career'),
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
