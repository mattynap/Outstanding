import {
  chapterGoalDef,
  chapterOf,
  evaluateChapterGoal,
  isSeasonOver,
  playerFixture,
  SKILLS,
  weekOfSeason,
  type ChapterLog,
  type ChapterPick,
  type FastForwardStop,
  type GameContext,
  type GameState,
  type Skill,
} from '@outstanding/engine';
import type { TextLine } from './plan-sheet-view';
import { formatAverage, formatInt, formatMoney } from './text';
import { fixtureView, outcomeFor, type FixtureView } from './views';

/** Cosa deve fare il giocatore adesso: guida il pulsante principale della home del capitolo. */
export type NextStep =
  'retired' | 'seasonOver' | 'events' | 'matchInProgress' | 'match' | 'advance';

/** La partita della settimana, se è una di quelle scelte dal regista. */
export function currentPick(s: GameState): ChapterPick | null {
  const f = playerFixture(s);
  return (f && s.chapter.picks.find((p) => p.fixtureId === f.id)) ?? null;
}

/**
 * Passo successivo nel ciclo a capitoli. Si gioca solo una partita scelta, e solo a settimana
 * preparata (piano e notizie): allo stop di fine capitolo la settimana è intatta e va prima
 * pianificata dal motore con il piano nuovo, quindi lì il passo è "avanti".
 */
export function nextStep(s: GameState, ctx: GameContext): NextStep {
  if (s.retired) return 'retired';
  if (s.currentMatch) return 'matchInProgress';
  if (isSeasonOver(s, ctx)) return 'seasonOver';
  if (s.pendingEvents.length > 0) return 'events';
  const prepared = s.plannedWeek === s.week && s.eventsWeek === s.week;
  if (prepared && currentPick(s)) return 'match';
  return 'advance';
}

/**
 * Il piano va scelto: a inizio stagione è vuoto, a fine capitolo si ripropone quello vecchio.
 * L'ultimo stop vive solo in memoria: dopo un riavvio l'apertura del capitolo si riconosce dallo
 * stato, prima settimana del capitolo ancora intatta (non pianificata).
 */
export function needsPlan(
  s: GameState,
  ctx: GameContext,
  lastStop: FastForwardStop | null,
): boolean {
  if (s.chapterPlan === null) return true;
  if (lastStop) return lastStop === 'chapterEnd';
  const cal = ctx.config.calendar;
  const sw = weekOfSeason(s.week, cal);
  const firstWeek = sw === 0 || chapterOf(sw - 1, cal) !== s.chapter.id;
  return firstWeek && s.plannedWeek !== s.week;
}

export interface GoalView {
  textKey: string;
  /** Parametri del testo: il bersaglio già scritto all'italiana. */
  params: { target: string };
  progressKey: string;
  progressParams: Record<string, string | number>;
  /** Tacche per i bersagli a conteggio (presenze, gol...); nulle per media voto e classifica. */
  ticks: { done: number; total: number } | null;
  met: boolean;
  /** Cosa dà l'obiettivo: si vede prima, non solo a capitolo chiuso. */
  reward: { trust: number; morale: number; miss: number };
}

/** L'obiettivo del capitolo con il progresso letto dal registro; nullo in preparazione o senza club. */
export function goalView(s: GameState, ctx: GameContext): GoalView | null {
  const goal = s.chapter.goal;
  if (!goal) return null;
  const def = chapterGoalDef(goal.id, ctx);
  const { met, progress } = evaluateChapterGoal(s, ctx);
  const rating = def.metric === 'avgRating';
  const target = rating ? formatAverage(goal.target) : String(goal.target);
  const counted = !rating && def.metric !== 'tablePosition';
  const log = s.chapter.log;
  const cfg = ctx.config.calendar.chapterGoals;
  return {
    textKey: def.textKey,
    params: { target },
    // Media senza voti: niente "in 0 partite", basta il bersaglio.
    progressKey:
      rating && log.ratingCount === 0
        ? 'ui.chapter.progress.avgRatingNone'
        : `ui.chapter.progress.${def.metric}`,
    progressParams: {
      n: rating ? formatAverage(progress) : progress,
      target,
      // Per la media: su quante partite.
      games: log.ratingCount,
    },
    ticks: counted ? { done: Math.min(progress, goal.target), total: goal.target } : null,
    met,
    reward: { trust: cfg.rewardTrust, morale: cfg.rewardMorale, miss: cfg.missMorale },
  };
}

export interface PickView {
  view: FixtureView;
  mode: ChapterPick['mode'];
  outcome: 'win' | 'draw' | 'loss' | null;
  /** È la prossima da giocare. */
  next: boolean;
}

/** Le partite del capitolo scelte dal regista, in ordine di calendario. */
export function chapterPicks(s: GameState, ctx: GameContext): PickView[] {
  const own = s.player.clubId;
  const rows = s.chapter.picks.flatMap((p) => {
    const f = s.calendar.find((x) => x.id === p.fixtureId);
    return f ? [{ p, f }] : [];
  });
  rows.sort((a, b) => a.f.week - b.f.week);
  const nextId = rows.find((r) => !r.f.result)?.f.id;
  return rows.map(({ p, f }) => ({
    view: fixtureView(s, f, ctx),
    mode: p.mode,
    outcome: own ? outcomeFor(f, own) : null,
    next: f.id === nextId,
  }));
}

export interface GoalRecordView {
  season: number;
  chapterKey: string;
  textKey: string;
  params: { target: string };
  met: boolean;
}

/** Obiettivi di capitolo già chiusi, dal più recente: la parte "premi" della bacheca. */
export function goalHistory(
  s: GameState,
  ctx: GameContext,
): { met: number; total: number; rows: GoalRecordView[] } {
  const records = s.goalRecords ?? [];
  const rows = records
    .flatMap((r) => {
      // Un obiettivo tolto dai contenuti non rompe la bacheca: si salta.
      const def = ctx.content.chapterGoals.find((g) => g.id === r.goalId);
      if (!def) return [];
      const target = def.metric === 'avgRating' ? formatAverage(r.target) : String(r.target);
      return [
        {
          season: r.season,
          chapterKey: `ui.chapter.name.${r.chapter}`,
          textKey: def.textKey,
          params: { target },
          met: r.met,
        },
      ];
    })
    .reverse();
  return { met: records.filter((r) => r.met).length, total: records.length, rows };
}

/**
 * "Dal piano": cosa ha fatto il piano nel tratto, una riga per voce, solo le voci mosse. Le abilità
 * si leggono come a schermo (intere, per difetto). Senza registro (vecchi salvataggi) niente righe.
 */
export function planStretchLine(log: Pick<ChapterLog, 'plan'>): TextLine[] {
  const p = log.plan;
  if (!p) return [];
  const lines: TextLine[] = [];
  for (const k of SKILLS) {
    const d = p.pointsGained[k];
    if (!d) continue;
    const from = Math.floor(p.skillsAtStart[k]);
    lines.push({
      key: 'ui.planLog.skill',
      params: { skillKey: `skills.${k}`, from, to: from + d },
    });
  }
  const f = p.freshnessAtMatches;
  if (f.length === 1)
    lines.push({ key: 'ui.planLog.freshnessOne', params: { value: Math.round(f[0]!) } });
  else if (f.length > 1)
    lines.push({
      key: 'ui.planLog.freshness',
      params: { from: Math.round(f[0]!), to: Math.round(f.at(-1)!) },
    });
  if (p.moraleProtected > 0)
    lines.push({ key: 'ui.planLog.morale', params: { n: p.moraleProtected } });
  if (p.sponsorIncome > 0)
    lines.push({ key: 'ui.planLog.sponsor', params: { money: formatMoney(p.sponsorIncome) } });
  if (p.popularity > 0)
    lines.push({ key: 'ui.planLog.popularity', params: { n: formatInt(p.popularity) } });
  if (p.gossip > 0) lines.push({ key: 'ui.planLog.gossip', params: { n: p.gossip } });
  if (p.fines > 0) lines.push({ key: 'ui.planLog.fines', params: { n: p.fines } });
  return lines;
}

/**
 * Suggerimento neutro dai numeri del tratto, mai una scelta imposta: a quante partite si è arrivati
 * sotto la freschezza da cui la convocazione comincia a calare (`match.selection.freshnessFrom`).
 */
export function chapterHint(
  log: Pick<ChapterLog, 'plan'>,
  ctx: GameContext,
): { key: string; values: { n?: number; total: number } } | null {
  const f = log.plan?.freshnessAtMatches ?? [];
  if (f.length === 0) return null;
  const from = ctx.config.match.selection.freshnessFrom;
  const n = f.filter((x) => x < from).length;
  return n > 0
    ? { key: 'ui.planLog.hint.tired', values: { n, total: f.length } }
    : { key: 'ui.planLog.hint.fresh', values: { total: f.length } };
}

/** Le abilità salite di almeno un punto nel tratto: un lampo ciascuna per stop, mai per un calo. */
export function pointFlashes(log: Pick<ChapterLog, 'plan'>): Skill[] {
  const g = log.plan?.pointsGained ?? {};
  return SKILLS.filter((k) => (g[k] ?? 0) > 0);
}
