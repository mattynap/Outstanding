import { describe, expect, it } from 'vitest';
import {
  advanceToStop,
  autoDecider,
  defaultContext,
  emptyChapterLog,
  getPendingEvents,
  newCareer,
  playerFixture,
  playMatch,
  resolveEvent,
  setChapterPlan,
  type ChapterLog,
  type ChapterPlanLog,
  type FastForwardStop,
  type GameState,
} from '@outstanding/engine';
import base from '../../content/data/i18n/it.json';
import ui from '../../content/data/i18n/it.ui.json';
import {
  chapterHint,
  chapterPicks,
  currentPick,
  goalHistory,
  goalView,
  needsPlan,
  nextStep,
  planStretchLine,
  pointFlashes,
} from '../src/app/core/chapter-view';
import { lineText, planIssuesView } from '../src/app/core/plan-sheet-view';
import { translate } from '../src/app/core/text';

const ctx = defaultContext;
const start = newCareer(
  { firstName: 'Tommaso', lastName: 'Ferraro', hometown: 'Bergamo', role: 'ATT' },
  11,
  ctx,
);

/** Una stagione giocata come fa la home: piano agli stop obbligatori, poi "vai avanti". */
function playSeason(s0: GameState) {
  let s = s0;
  let last: FastForwardStop | null = null;
  const stops: FastForwardStop[] = [];
  const modes: string[] = [];
  for (let guard = 0; guard < 500; guard++) {
    const step = nextStep(s, ctx);
    if (step === 'seasonOver' || step === 'retired') return { s, stops, modes };
    if (step === 'events') {
      for (const e of getPendingEvents(s, ctx)) s = resolveEvent(s, e.eventId, 0, ctx).state;
      continue;
    }
    if (step === 'match') {
      const pick = currentPick(s)!;
      expect(pick.fixtureId).toBe(playerFixture(s)!.id);
      modes.push(pick.mode);
      s = playMatch(s, autoDecider, ctx, { mode: pick.mode }).state;
      continue;
    }
    expect(step).toBe('advance');
    if (needsPlan(s, ctx, last)) s = setChapterPlan(s, { load: 'rest' }, ctx);
    const out = advanceToStop(s, ctx);
    s = out.state;
    last = out.report.stop;
    stops.push(last);
  }
  throw new Error('season loop stalled');
}

describe('home del capitolo', () => {
  it('a inizio carriera serve il piano, poi no fino al capitolo nuovo', () => {
    expect(needsPlan(start, ctx, null)).toBe(true);
    const planned = setChapterPlan(start, { load: 'rest' }, ctx);
    expect(needsPlan(planned, ctx, 'pick')).toBe(false);
    expect(needsPlan(planned, ctx, 'chapterEnd')).toBe(true);
  });

  it('una stagione arriva in fondo giocando solo le partite scelte', () => {
    const { s, stops, modes } = playSeason(start);
    expect(nextStep(s, ctx)).toBe('seasonOver');
    expect(stops).toContain('chapterEnd');
    expect(stops.at(-1)).toBe('seasonEnd');
    expect(modes.length).toBeGreaterThan(0);
    expect(modes).toContain('full');
    // Gli obiettivi chiusi finiscono in bacheca, dal più recente.
    const h = goalHistory(s, ctx);
    expect(h.total).toBeGreaterThan(0);
    expect(h.rows).toHaveLength(h.total);
    expect(h.met).toBe(h.rows.filter((r) => r.met).length);
    expect(h.rows[0]!.chapterKey).toMatch(/^ui\.chapter\.name\./);
  });

  it('allo stop di fine capitolo non si gioca prima di aver pianificato la settimana', () => {
    let s = setChapterPlan(start, { load: 'rest' }, ctx);
    for (let i = 0; i < 50; i++) {
      const out = advanceToStop(s, ctx);
      s = out.state;
      if (out.report.stop === 'chapterEnd') break;
      for (const e of getPendingEvents(s, ctx)) s = resolveEvent(s, e.eventId, 0, ctx).state;
      if (nextStep(s, ctx) === 'match')
        s = playMatch(s, autoDecider, ctx, { mode: currentPick(s)!.mode }).state;
    }
    expect(s.plannedWeek).not.toBe(s.week);
    expect(nextStep(s, ctx)).toBe('advance');
    // Dopo un riavvio l'ultimo stop non c'è più: il piano nuovo si chiede lo stesso.
    expect(needsPlan(s, ctx, null)).toBe(true);
    const out = advanceToStop(setChapterPlan(s, { load: 'rest' }, ctx), ctx);
    if (out.state.plannedWeek === out.state.week)
      expect(needsPlan(out.state, ctx, null)).toBe(false);
  });

  it("l'obiettivo mostra bersaglio e progresso; le partite scelte sono in ordine", () => {
    let s = setChapterPlan(start, { load: 'rest' }, ctx);
    let out = advanceToStop(s, ctx);
    for (let i = 0; i < 20 && !s.chapter.goal; i++) {
      s = out.state;
      for (const e of getPendingEvents(s, ctx)) s = resolveEvent(s, e.eventId, 0, ctx).state;
      if (nextStep(s, ctx) === 'match')
        s = playMatch(s, autoDecider, ctx, { mode: currentPick(s)!.mode }).state;
      if (!s.chapter.goal) out = advanceToStop(s, ctx);
    }
    const g = goalView(s, ctx)!;
    expect(g.textKey).toMatch(/^chapterGoals\./);
    expect(g.progressKey).toMatch(/^ui\.chapter\.progress\./);
    expect(g.params.target).not.toBe('');
    if (g.ticks) expect(g.ticks.done).toBeLessThanOrEqual(g.ticks.total);
    expect(g.reward.trust).toBe(ctx.config.calendar.chapterGoals.rewardTrust);

    const picks = chapterPicks(s, ctx);
    const weeks = picks.map((p) => p.view.fixture.week);
    expect(weeks).toEqual([...weeks].sort((a, b) => a - b));
    expect(picks.filter((p) => p.next).length).toBeLessThanOrEqual(1);
  });

  it('in preparazione non c’è obiettivo', () => {
    expect(start.chapter.id).toBe('preseason');
    expect(goalView(start, ctx)).toBeNull();
  });
});

/** Un tratto con il registro del piano: abilità di partenza dal giocatore di prova. */
function stretch(plan: Partial<ChapterPlanLog>): ChapterLog {
  return {
    ...emptyChapterLog(),
    plan: {
      skillsAtStart: { ...start.player.skills, shooting: 61.4 },
      freshnessAtMatches: [],
      moraleProtected: 0,
      sponsorIncome: 0,
      popularity: 0,
      gossip: 0,
      fines: 0,
      pointsGained: {},
      ...plan,
    },
  };
}

const table: Record<string, string> = { ...base, ...ui };
const say = (l: { key: string; params?: Record<string, string | number> }) =>
  lineText((k, p) => translate(table, k, p), l);

describe('Dal piano', () => {
  it('un tratto senza registro del piano (vecchi salvataggi) non dà righe né lampi', () => {
    const old = emptyChapterLog();
    expect(old.plan).toBeUndefined();
    expect(planStretchLine(old)).toEqual([]);
    expect(pointFlashes(old)).toEqual([]);
    expect(chapterHint(old, ctx)).toBeNull();
  });

  it('abilità con floor, freschezza prima e ultima partita, morale protetto in volte', () => {
    const lines = planStretchLine(
      stretch({
        pointsGained: { shooting: 1 },
        freshnessAtMatches: [74.4, 70, 65.6],
        moraleProtected: 2,
      }),
    ).map(say);
    expect(lines).toEqual(['Tiro 61 → 62', 'freschezza 74 → 66', 'morale protetto 2 volte']);
  });

  it('una sola partita: la freschezza non ha la freccia; soldi e serate solo se ci sono', () => {
    const lines = planStretchLine(
      stretch({ freshnessAtMatches: [58], sponsorIncome: 12000, gossip: 1, fines: 0 }),
    ).map(say);
    expect(lines[0]).toBe('freschezza 58 alla partita');
    expect(lines.some((l) => l.includes('12.000'))).toBe(true);
    expect(lines.some((l) => /giornali/.test(l))).toBe(true);
    expect(lines.some((l) => /mult/.test(l))).toBe(false);
  });

  it('pointFlashes: una per abilità per stop, anche con due punti, mai per un calo', () => {
    const log = stretch({ pointsGained: { shooting: 2, pace: 1, physical: -1 } });
    const flashes = pointFlashes(log);
    expect(flashes).toHaveLength(new Set(flashes).size);
    expect([...flashes].sort()).toEqual(['pace', 'shooting']);
  });

  it('suggerimento neutro: stanco sotto la soglia di convocazione della configurazione', () => {
    const from = ctx.config.match.selection.freshnessFrom;
    const log = stretch({ freshnessAtMatches: [from + 10, from - 1, from - 5, from, from + 2] });
    const hint = chapterHint(log, ctx)!;
    expect(hint.key).toBe('ui.planLog.hint.tired');
    expect(hint.values).toEqual({ n: 2, total: 5 });
    expect(translate(table, hint.key, hint.values)).toBe('Sei arrivato stanco a 2 partite su 5.');
    const fresh = chapterHint(stretch({ freshnessAtMatches: [from, from + 3] }), ctx)!;
    expect(fresh.key).toBe('ui.planLog.hint.fresh');
    expect(chapterHint(stretch({}), ctx)).toBeNull();
  });

  it('suggerimento fresco: il plurale annidato regge una e più partite', () => {
    const from = ctx.config.match.selection.freshnessFrom;
    const one = chapterHint(stretch({ freshnessAtMatches: [from] }), ctx)!;
    expect(translate(table, one.key, one.values)).toBe('Sei arrivato fresco alla partita.');
    const many = chapterHint(stretch({ freshnessAtMatches: [from, from + 1, from + 9] }), ctx)!;
    expect(translate(table, many.key, many.values)).toBe(
      'Sei arrivato fresco a tutte le 3 partite.',
    );
  });

  it('planIssues con sponsor scaduto: la prima pagina ha la riga di avviso (planIssuesView)', () => {
    // Gli avvisi non stanno nel registro del tratto ma nel report dello stop: li legge planIssuesView.
    const rows = planIssuesView([
      { week: 30, life: 'sponsor', reasonKey: 'week.blocked.no_sponsor' },
      { week: 31, life: 'sponsor', reasonKey: 'week.blocked.no_sponsor' },
    ]);
    expect(rows).toHaveLength(1);
    const r = rows[0]!;
    const text = translate(table, 'ui.stop.planIssue', {
      life: translate(table, r.nameKey),
      n: r.weeks,
      reason: translate(table, r.reasonKey),
    });
    expect(text).toBe('Sponsor: 2 settimane saltate. Serve almeno uno sponsor.');
  });
});
