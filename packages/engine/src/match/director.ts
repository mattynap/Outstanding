import type { MatchConfig } from '@outstanding/config';
import type { Rng } from '../rng';
import type { DirectorState, MatchMode, MatchState } from '../types';
import { clamp } from '../util';

/**
 * Regista della partita: decide quando fermare la partita e quale momento proporre, mai l'esito.
 * Qui solo funzioni pure; le estrazioni (in ordine fisso) le fa `run` in match.ts.
 */

const totalMinutes = (cfg: MatchConfig) => cfg.blocks * cfg.minutesPerBlock;
const other = (side: 'home' | 'away') => (side === 'home' ? 'away' : 'home');

/** Differenza reti dal punto di vista del giocatore, limitata a ±3. */
export function goalDiff(m: MatchState): number {
  return clamp(m.score[m.side] - m.score[other(m.side)], -3, 3);
}

/** Vero se il giocatore è in campo al minuto dato (il minuto di uscita conta ancora). */
export function onPitchAt(m: MatchState, minute: number): boolean {
  return m.minuteIn !== null && minute > m.minuteIn && minute <= m.minuteOut;
}

/** Tensione della partita al minuto raggiunto: punteggio in bilico, tempo, posta e pressione. */
export function tension(m: MatchState, cfg: MatchConfig): number {
  const d = cfg.director;
  const close = d.close[String(goalDiff(m))] ?? 0;
  const t = m.minute / totalMinutes(cfg);
  const time = d.timeBase + (1 - d.timeBase) * Math.pow(t, d.timeExp);
  const danger = Math.max(0, Math.abs(m.pressure) - cfg.pressure.dangerAt);
  return d.wGame * close * time + d.wStakes * m.stakes + d.wPress * danger;
}

/** Il giocatore resta in campo abbastanza per avere almeno un momento. */
export function eligibleForMoments(minutesOnPitch: number, cfg: MatchConfig): boolean {
  return minutesOnPitch >= cfg.moments.minMinutesForMoment;
}

/**
 * Stato iniziale del regista. Il budget (in passi) si estrae dalla modalità e si scala sui minuti
 * in campo; chi non arriva a `minMinutesForMoment` non ha budget e non consuma estrazioni.
 */
export function initialDirector(
  mode: MatchMode,
  minutesOnPitch: number,
  rng: Rng,
  cfg: MatchConfig,
): DirectorState {
  let budget = 0;
  let visible = 0;
  if (eligibleForMoments(minutesOnPitch, cfg)) {
    const [min, max] = cfg.steps;
    const raw = rng.int(min, max);
    const scale = minutesOnPitch / totalMinutes(cfg);
    budget = Math.max(1, Math.round(raw * scale));
    // I passi visibili della rapida seguono la stessa estrazione del budget (posizione nel
    // intervallo): nessuna estrazione in più, così rapida e simulata consumano il Rng allo stesso modo.
    const [vMin, vMax] = cfg.visibleSteps;
    const t = max > min ? (raw - min) / (max - min) : 0;
    visible = Math.min(budget, Math.max(1, Math.round((vMin + t * (vMax - vMin)) * scale)));
  }
  return {
    budgetStart: budget,
    budgetLeft: budget,
    // Completa: tutti visibili (campo assente); simulata: nessuno; rapida: la quota.
    ...(mode === 'full' ? {} : { visibleLeft: mode === 'sim' ? 0 : visible }),
    hotLeft: null,
    lastAt: null,
    interventions: 0,
    armed: null,
    relaxUntil: null,
    lastTypes: [],
    legendsUsed: 0,
    peak: null,
  };
}

/**
 * La radice che si sta per aprire è visibile al giocatore? Campo `visibleLeft` assente = tutte
 * visibili (partita completa, salvataggi precedenti). Una catena che non ci sta nei passi
 * visibili rimasti si nasconde; prima del finale caldo resta riservato un passo visibile per il
 * finale o per il minimo garantito. Non estrae.
 */
export function rootVisible(m: MatchState, depth: number, cfg: MatchConfig): boolean {
  const left = m.director.visibleLeft;
  if (left === undefined) return true;
  // Garanzia: finché nessun passo visibile è stato usato, la prima radice della partita, il minimo
  // garantito e il finale caldo sono visibili a prescindere dalla profondità; la catena resta
  // visibile fino in fondo, anche oltre la quota. Così ogni rapida con minuti sufficienti ha
  // almeno un passo visibile.
  const unused = !m.events.some((e) => e.kind === 'moment' && !e.auto);
  if (
    unused &&
    left > 0 &&
    (m.director.interventions === 0 ||
      m.director.armed?.forced === true ||
      m.minute >= cfg.director.hotFrom)
  ) {
    return true;
  }
  if (left <= 0 || depth > left) return false;
  const hotAhead = m.minuteOut > cfg.director.hotFrom;
  return (
    left > 1 || !hotAhead || m.minute >= cfg.director.hotFrom || m.director.armed?.forced === true
  );
}

/** Finale caldo attivo: ci sono ancora passi riservati al bilico degli ultimi minuti. */
export function hotActive(d: DirectorState): boolean {
  return d.hotLeft !== null && d.hotLeft > 0;
}

/**
 * Passi da tenere da parte per il finale caldo. Vale solo prima di `hotFrom` e solo se il
 * giocatore arriva in campo oltre `hotFrom`; dopo, la riserva si libera.
 */
export function reserveFor(m: MatchState, cfg: MatchConfig): number {
  const d = cfg.director;
  if (m.minuteOut <= d.hotFrom || m.minute >= d.hotFrom) return 0;
  return Math.min(d.hotSlots, Math.max(0, m.director.budgetStart - 1));
}

/** Esito dei controlli del regista in un minuto, senza estrazioni. */
export type Gate =
  | { kind: 'none' }
  /** Minimo garantito: si arma senza estrarre (ignora soglia, respiro, intervallo e riserva). */
  | { kind: 'forced'; maxDepth: number }
  /**
   * Si estrae `rng.chance(p)`; se riesce, il tipo deve stare entro `maxDepth` passi. `forced`:
   * il preavviso scavalca la scadenza del minimo garantito e va armato immune ai gol.
   */
  | { kind: 'roll'; p: number; maxDepth: number; forced: boolean };

const NONE: Gate = { kind: 'none' };

/**
 * Controlli del regista al minuto raggiunto (`m.minute`), dopo i gol del minuto e la contabilità.
 * Non estrae: dice a `run` se armare d'ufficio, se tentare l'estrazione o se tacere.
 */
export function gate(m: MatchState, cfg: MatchConfig): Gate {
  const d = m.director;
  const c = cfg.director;
  const minute = m.minute;
  if (!onPitchAt(m, minute) || d.armed || m.pending || d.budgetLeft <= 0) return NONE;
  // Il momento si apre `armLead` minuti dopo: deve restare dentro la partita e dentro il campo.
  if (minute + c.armLead > Math.min(totalMinutes(cfg), m.minuteOut)) return NONE;

  const minuteIn = m.minuteIn ?? 0;
  const owed = d.interventions === 0 && eligibleForMoments(m.minuteOut - minuteIn, cfg);
  const deadline = Math.max(minuteIn, m.minuteOut - c.armLead);
  if (owed && minute >= deadline) return { kind: 'forced', maxDepth: d.budgetLeft };

  if (d.relaxUntil !== null && minute < d.relaxUntil) return NONE;
  const gap = hotActive(d) ? c.hotGap : c.minGap;
  if (d.lastAt !== null && minute - d.lastAt < gap) return NONE;
  const maxDepth = d.budgetLeft - reserveFor(m, cfg);
  if (maxDepth < 1) return NONE;
  const t = tension(m, cfg);
  if (t < c.threshold) return NONE;
  // Un preavviso ancora chiuso alla scadenza toglierebbe il posto al minimo garantito: se un gol
  // lo annullasse dopo la scadenza non ci sarebbe più tempo per riarmare.
  const forced = owed && minute + c.armLead > deadline;
  return { kind: 'roll', p: Math.min(c.pMax, (t - c.threshold) * c.hazard), maxDepth, forced };
}

/** Respiro dopo un gol o una catena: più corto nel finale caldo. */
function relaxAfter(d: DirectorState, minute: number, cfg: MatchConfig): number {
  return minute + (hotActive(d) ? cfg.director.hotGap : cfg.director.relaxMinutes);
}

/**
 * Contabilità del minuto, senza estrazioni: apertura del finale caldo, annullo del preavviso per
 * gol (non quello forzato) e respiro dopo un gol.
 */
export function directorMinute(m: MatchState, goalScored: boolean, cfg: MatchConfig): MatchState {
  let d = m.director;
  const minute = m.minute;
  if (d.armed && minute > m.minuteOut) {
    // Invariante, non caso di gioco: i cambi sono fissati a beginMatch e `gate` non arma mai oltre
    // l'uscita. Se succede il regista è rotto e conviene fermarsi invece di proseguire in silenzio.
    throw new Error(`Armed moment at ${d.armed.at} beyond minuteOut ${m.minuteOut}`);
  }
  if (d.hotLeft === null && minute >= cfg.director.hotFrom && Math.abs(goalDiff(m)) <= 1) {
    d = { ...d, hotLeft: Math.min(cfg.director.hotSlots, d.budgetLeft) };
  }
  if (goalScored) {
    d = {
      ...d,
      armed: d.armed?.forced ? d.armed : null,
      relaxUntil: relaxAfter(d, minute, cfg),
    };
  }
  return d === m.director ? m : { ...m, director: d };
}

/** Prepara il preavviso di una radice: il momento si aprirà `armLead` minuti dopo. */
export function arm(
  d: DirectorState,
  minute: number,
  momentId: string,
  forced: boolean,
  cfg: MatchConfig,
): DirectorState {
  if (d.armed) throw new Error('A moment is already armed');
  return {
    ...d,
    armed: { at: minute + cfg.director.armLead, momentId, ...(forced ? { forced: true } : {}) },
  };
}

/**
 * Un passo interattivo si è aperto: unico punto in cui si aggiornano i contatori del regista.
 * `root` distingue la radice di una catena dai passi successivi (intervallo minimo fra radici).
 */
export function onStepOpened(
  d: DirectorState,
  step: { minute: number; momentId: string; tension: number; root: boolean },
  cfg: MatchConfig,
): DirectorState {
  const hot = step.minute >= cfg.director.hotFrom && hotActive(d);
  const better = d.peak === null || step.tension > d.peak.tension;
  return {
    ...d,
    armed: null,
    budgetLeft: d.budgetLeft - 1,
    interventions: d.interventions + (step.root ? 1 : 0),
    lastAt: step.root ? step.minute : d.lastAt,
    lastTypes: [...d.lastTypes, step.momentId].slice(-3),
    hotLeft: hot ? Math.max(0, d.hotLeft! - 1) : d.hotLeft,
    peak: better
      ? { minute: step.minute, momentId: step.momentId, tension: step.tension, success: false }
      : d.peak,
  };
}

/** Fine di una catena (in A5 ogni momento è una catena di un passo): parte il respiro. */
export function onChainEnd(d: DirectorState, minute: number, cfg: MatchConfig): DirectorState {
  return { ...d, relaxUntil: relaxAfter(d, minute, cfg) };
}
