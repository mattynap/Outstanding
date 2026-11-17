/** Dati e regole della settimana guidata, senza dipendenze da Angular (si provano nei test). */

/**
 * Consigli della settimana guidata, in ordine. Ogni consiglio compare solo dopo quelli indicati in
 * `after` (così sulla stessa schermata se ne vede uno alla volta).
 */
export const TIPS = {
  'week.welcome': [],
  'week.cta': ['week.welcome'],
  'event.choice': [],
  'match.moments': [],
  'match.rating': [],
  // Condizione, piano e prepartita aspettano la prima pagella: prima si gioca, poi si approfondisce.
  'week.condition': ['match.rating'],
  'week.plan': ['week.condition'],
  'match.pre': ['match.rating'],
  'week.tabs': ['week.plan'],
  'week.done': ['week.tabs'],
} as const satisfies Record<string, readonly string[]>;

export type TipId = keyof typeof TIPS;
export const TIP_IDS = Object.keys(TIPS) as TipId[];

/** Stato della guida: a quale slot appartiene e quali consigli sono già stati letti. */
export interface TutorialData {
  slot: number;
  seen: TipId[];
}

/** Legge i dati salvati, scartando quelli rovinati o di una versione diversa. */
export function parseTutorial(raw: string | null): TutorialData | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<TutorialData>;
    if (!Number.isInteger(data.slot) || !Array.isArray(data.seen)) return null;
    return {
      slot: data.slot!,
      seen: data.seen.filter((id): id is TipId => TIP_IDS.includes(id as TipId)),
    };
  } catch {
    return null;
  }
}

/** Vero se il consiglio va mostrato: non ancora letto e con i precedenti già letti. */
export function tipVisible(data: TutorialData | null, slot: number | null, id: TipId): boolean {
  if (!data || data.slot !== slot || data.seen.includes(id)) return false;
  return TIPS[id].every((prev) => data.seen.includes(prev));
}
