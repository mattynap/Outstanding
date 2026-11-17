import type { NextStep } from './game.service';

/** Modalità predefinita della partita: completa con i momenti chiave o simulata. 'quick' arriva con M18. */
export const MATCH_MODES = ['full', 'sim'] as const;
export type MatchMode = (typeof MATCH_MODES)[number];

/** Valore salvato → modalità; qualsiasi valore sconosciuto torna a 'full'. */
export function parseMatchMode(raw: string | null): MatchMode {
  return (MATCH_MODES as readonly string[]).includes(raw ?? '') ? (raw as MatchMode) : 'full';
}

/**
 * Simulazione automatica da `/partita?mode=sim`: solo se la partita è davvero il passo della
 * settimana. Un link rimasto nella cronologia non deve saltare il piano né la partita successiva.
 */
export function autoSimulate(modeParam: string | null, step: NextStep | null): boolean {
  return modeParam === 'sim' && step === 'match';
}

/** Riga della scheda partita quando non si può ancora giocare: cosa manca prima del fischio. */
export function kickoffHintKey(step: NextStep | null): string | null {
  if (step === 'plan') return 'ui.week.matchAfterPlan';
  if (step === 'events') return 'ui.week.matchAfterNews';
  return null;
}
