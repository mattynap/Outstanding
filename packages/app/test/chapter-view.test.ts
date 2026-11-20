import { describe, expect, it } from 'vitest';
import {
  advanceToStop,
  autoDecider,
  defaultContext,
  getPendingEvents,
  newCareer,
  playerFixture,
  playMatch,
  resolveEvent,
  setChapterPlan,
  type FastForwardStop,
  type GameState,
} from '@outstanding/engine';
import {
  chapterPicks,
  currentPick,
  goalHistory,
  goalView,
  needsPlan,
  nextStep,
} from '../src/app/core/chapter-view';

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
