/** Funzioni pure per testi e numeri visibili al giocatore (testabili senza Angular). */

export type TextParams = Record<string, string | number>;

/** Testo tradotto con i segnaposto `{nome}` sostituiti; una chiave mancante resta visibile. */
export function translate(
  table: Readonly<Record<string, string>>,
  key: string,
  params: TextParams = {},
): string {
  const text = table[key];
  if (text === undefined) return key;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

const integer = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** 12345 -> "12.345" (l'italiano non separa le migliaia sotto 10.000) */
export const formatInt = (n: number): string => integer.format(Math.round(n));

/** Euro senza decimali: "€ 12.000" (negativi con il segno meno). */
export function formatMoney(n: number): string {
  const sign = n < 0 ? '−' : '';
  return `${sign}€ ${integer.format(Math.abs(Math.round(n)))}`;
}

/** Voto in pagella all'italiana: 7.5 -> "7,5", 6 -> "6". */
export function formatRating(r: number | null): string {
  if (r === null) return 's.v.';
  return Number.isInteger(r) ? String(r) : oneDecimal.format(r);
}

/** Media con un decimale: 6.234 -> "6,2". */
export const formatAverage = (n: number): string => oneDecimal.format(n);

/** Numero ordinale femminile per giornate e posizioni: 14 -> "14ª". */
export const ordinal = (n: number): string => `${n}ª`;

/** Variazione con segno: 3 -> "+3", -2 -> "−2". */
export function formatDelta(n: number, digits = 0): string {
  const v = Number(n.toFixed(digits));
  if (v === 0) return '0';
  const abs = new Intl.NumberFormat('it-IT', { maximumFractionDigits: digits }).format(Math.abs(v));
  return v > 0 ? `+${abs}` : `−${abs}`;
}

/** Colore di una probabilità (0–1) per le barre dei momenti chiave. */
export function chanceTone(chance: number): 'pos' | 'neg' | 'mid' {
  if (chance >= 0.6) return 'pos';
  if (chance <= 0.3) return 'neg';
  return 'mid';
}

/** Tono di una barra di condizione (0–100): sotto 35 critica, sopra 60 buona. */
export function levelTone(value: number): 'pos' | 'neg' | 'mid' {
  if (value >= 60) return 'pos';
  if (value < 35) return 'neg';
  return 'mid';
}

/** Saldo di cassa di una settimana: stipendio e sponsor, meno spese, più o meno il patrimonio. */
export function weekBalance(r: {
  finance: { salary: number; sponsors: number; commission: number; expenses: number };
  wealth?: { upkeep: number; loanPayments: number; businessIncome: number };
}): number {
  const f = r.finance;
  const w = r.wealth;
  return (
    f.salary +
    f.sponsors -
    f.commission -
    f.expenses +
    (w ? w.businessIncome - w.upkeep - w.loanPayments : 0)
  );
}
