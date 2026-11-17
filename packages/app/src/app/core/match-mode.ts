/** Modalità predefinita della partita: completa con i momenti chiave o simulata. 'quick' arriva con M18. */
export const MATCH_MODES = ['full', 'sim'] as const;
export type MatchMode = (typeof MATCH_MODES)[number];

/** Valore salvato → modalità; qualsiasi valore sconosciuto torna a 'full'. */
export function parseMatchMode(raw: string | null): MatchMode {
  return (MATCH_MODES as readonly string[]).includes(raw ?? '') ? (raw as MatchMode) : 'full';
}
