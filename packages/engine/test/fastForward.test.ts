import { describe, expect, it } from 'vitest';
import {
  advanceToStop,
  bigMatchKind,
  defaultContext,
  fastForward,
  isSeasonOver,
  newCareer,
  planWeek,
  playerFixture,
  prudentChoice,
  repeatPlan,
  setChapterPlan,
  simulateMatch,
  skipToNextMatch,
  type FastForwardStop,
  type FastForwardTarget,
  type GameState,
  type WeekPlan,
} from '../src/index';
import { applyMatchAftermath } from '../src/player/condition';
import { recordChapterMatch } from '../src/season/director';
import { lifeModifiers } from '../src/season/life';
import { Rng } from '../src/rng';
import { baseOptions } from './fixtures';
import { chapterOf, emptyChapterLog } from '../src/season/director';
import { buildHeadlines } from '../src/season/headlines';
import { drawWeekEvents, resolveEvent, getEvent } from '../src/events/events';
import { advanceWeek } from '../src/season/week';
import { clubLevel } from '../src/market/offers';
import { weekOfSeason } from '../src/time';

const ctx = defaultContext;
const ev = (id: string) => ctx.content.events.find((e) => e.id === id)!;
const start = (seed = 6): GameState => newCareer(baseOptions, seed);

describe('piano ricordato', () => {
  it('planWeek ricorda il piano scelto e il piano automatico non lo sostituisce', () => {
    const s = planWeek(start(), { load: 'push', life: 'leisure' }).state;
    expect(s.lastPlan).toEqual({ load: 'push', life: 'leisure' });
    const skipped = skipToNextMatch({ ...s, week: s.week + 1 }).state;
    expect(skipped.lastPlan).toEqual(s.lastPlan);
  });

  it('il piano da ripetere non filtra nulla: la serata resta, il carico lo decide planWeek', () => {
    const s: GameState = { ...start(), lastPlan: { load: 'push', life: 'party' } };
    expect(repeatPlan(s)).toEqual({ load: 'push', life: 'party' });
    const injured: GameState = {
      ...s,
      player: { ...s.player, injury: { type: 'contusione', weeksLeft: 2 } },
    };
    expect(repeatPlan(injured)).toEqual({ load: 'push', life: 'party' });
    expect(planWeek(injured, repeatPlan(injured)).report.effectiveLoad).toBe('recovery');
  });
});

describe('scelta prudente', () => {
  it('evita rotture, storie segrete e infortuni', () => {
    const s = start();
    expect(prudentChoice(ev('amore_tentazione_01'), s)).toBe(1);
    expect(prudentChoice(ev('amore_crisi_01'), s)).not.toBe(1);
  });
});

/** Avanti veloce ripetuto, come farebbe il giocatore ignorando le offerte, fino a `stop`. */
function runUntil(state: GameState, target: FastForwardTarget, stop: FastForwardStop) {
  let s = state;
  const record = { win: 0, draw: 0, loss: 0 };
  for (let i = 0; i < 60; i++) {
    const out = fastForward(s, target);
    s = out.state;
    record.win += out.report.record.win;
    record.draw += out.report.record.draw;
    record.loss += out.report.record.loss;
    if (out.report.stop === stop || out.report.stop === 'seasonEnd') {
      return { state: s, stop: out.report.stop, record };
    }
  }
  throw new Error('fast forward did not stop');
}

describe('avanti veloce', () => {
  it('arriva a fine stagione simulando le partite', () => {
    const out = runUntil(start(), 'seasonEnd', 'seasonEnd');
    expect(out.stop).toBe('seasonEnd');
    expect(isSeasonOver(out.state, ctx)).toBe(true);
    const r = out.record;
    expect(r.win + r.draw + r.loss).toBeGreaterThan(20);
    expect(out.state.pendingEvents).toEqual([]);
  });

  it('si ferma prima di una partita importante, con la settimana ancora da pianificare', () => {
    for (let seed = 1; seed < 15; seed++) {
      const out = runUntil(start(seed), 'bigMatch', 'bigMatch');
      if (out.stop !== 'bigMatch') continue;
      const f = playerFixture(out.state)!;
      expect(bigMatchKind(out.state, f, ctx)).not.toBeNull();
      expect(out.state.plannedWeek).not.toBe(out.state.week);
      return;
    }
    throw new Error('no big match found in 14 careers');
  });

  it('è deterministico', () => {
    const a = fastForward(start(9), 'seasonEnd');
    const b = fastForward(start(9), 'seasonEnd');
    expect(a.report).toEqual(b.report);
    expect(a.state.rngState).toEqual(b.state.rngState);
  });
});

/** Carriera guidata da advanceToStop: pick simulate, notizie prudenti, piano fisso. */
function driveSeason(seed: number, ctx = defaultContext) {
  let s = setChapterPlan(start(seed), { load: 'balanced' }, ctx);
  const stops: { stop: string; weeks: number; pendingIsPick: boolean; untouched: boolean }[] = [];
  const reports: ReturnType<typeof advanceToStop>['report'][] = [];
  for (let i = 0; i < 300; i++) {
    const out = advanceToStop(s, ctx);
    s = out.state;
    reports.push(out.report);
    const f = playerFixture(s);
    stops.push({
      stop: out.report.stop,
      weeks: out.report.weeks,
      untouched: s.pendingEvents.length > 0 || s.plannedWeek !== s.week,
      pendingIsPick: !f || s.chapter.picks.some((p) => p.fixtureId === f.id),
    });
    if (out.report.stop === 'seasonEnd' || out.report.stop === 'retired') break;
    if (out.report.stop === 'pick') s = simulateMatch(s, ctx).state;
    if (out.report.stop === 'news') {
      for (const pe of [...s.pendingEvents]) {
        s = resolveEvent(s, pe.eventId, prudentChoice(getEvent(pe.eventId, ctx), s), ctx).state;
      }
    }
  }
  return { state: s, stops, reports };
}

describe('avanti fino al prossimo stop', () => {
  it('stops before each pick', () => {
    const { stops, state } = driveSeason(6);
    const picks = stops.filter((x) => x.stop === 'pick');
    expect(picks.length).toBeGreaterThanOrEqual(6);
    expect(isSeasonOver(state, ctx)).toBe(true);
    // Ogni stop 'pick' lascia in sospeso una partita scelta, mai una a caso.
    for (const p of picks) expect(p.pendingIsPick).toBe(true);
  });

  it('never leaves a non-picked match pending', () => {
    for (const seed of [1, 2, 3, 6, 9]) {
      for (const x of driveSeason(seed).stops) {
        // A news, chapterEnd e offerta a inizio settimana (settimana ancora intatta) una non scelta può essere ancora dovuta: si simula alla chiamata dopo.
        if (x.stop !== 'news' && x.stop !== 'chapterEnd' && !x.untouched)
          expect(x.pendingIsPick).toBe(true);
      }
    }
  });

  it('stops at chapter end and starts the next chapter', () => {
    let s = setChapterPlan(start(6), { load: 'balanced' }, ctx);
    const first = s.chapter.id;
    let saw = false;
    for (let i = 0; i < 40 && !saw; i++) {
      const out = advanceToStop(s, ctx);
      s = out.state;
      if (out.report.stop === 'chapterEnd') {
        saw = true;
        expect(out.report.weeks).toBeGreaterThan(0);
        expect(s.chapter.id).not.toBe(first);
        expect(s.chapter.log).toEqual(emptyChapterLog());
        expect(s.chapter.stretch).toEqual(emptyChapterLog());
        // Subito dopo, il piano del capitolo nuovo si può impostare e si riparte.
        s = setChapterPlan(s, { load: 'push' }, ctx);
        expect(s.chapterPlan).toEqual({ load: 'push' });
      } else if (out.report.stop === 'pick') s = simulateMatch(s, ctx).state;
      else if (out.report.stop === 'news') {
        for (const pe of [...s.pendingEvents]) {
          s = resolveEvent(s, pe.eventId, 0, ctx).state;
        }
      }
    }
    expect(saw).toBe(true);
  });

  it('stops for events and offers as today', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed < 15 && !(seen.has('news') && seen.has('offers')); seed++) {
      for (const x of driveSeason(seed).stops) seen.add(x.stop);
    }
    expect(seen.has('news') || seen.has('offers')).toBe(true);
    expect(seen.has('seasonEnd')).toBe(true);
  });

  it('stops at zero weeks when the current week already has a stop', () => {
    let s = setChapterPlan(start(6), { load: 'balanced' }, ctx);
    for (let i = 0; i < 40; i++) {
      const out = advanceToStop(s, ctx);
      s = out.state;
      if (out.report.stop === 'pick') {
        const again = advanceToStop(s, ctx);
        expect(again.report.stop).toBe('pick');
        expect(again.report.weeks).toBe(0);
        return;
      }
      if (out.report.stop === 'news') {
        for (const pe of [...s.pendingEvents]) s = resolveEvent(s, pe.eventId, 0, ctx).state;
      }
    }
    throw new Error('no pick found');
  });

  it('summary lists skipped matches with rating', () => {
    const { reports } = driveSeason(6);
    const all = reports.flatMap((r) => r.summary);
    expect(all.length).toBeGreaterThan(10);
    for (const e of all) {
      expect(['win', 'draw', 'loss']).toContain(e.result);
      expect(e.rating === null || (e.rating >= 4 && e.rating <= 10)).toBe(true);
    }
    expect(all.some((e) => e.rating !== null)).toBe(true);
  });

  it('is deterministic', () => {
    const a = driveSeason(9);
    const b = driveSeason(9);
    expect(a.reports).toEqual(b.reports);
    expect(a.state.rngState).toEqual(b.state.rngState);
  });

  it('every week still runs advanceWeek', () => {
    // Stesso seme e stesso piano: la stagione guidata da advanceToStop coincide con quella manuale.
    // Senza obiettivi: l'estrazione dell'obiettivo sposta l'`Rng` e le ricompense il morale.
    const noGoals = { ...ctx, content: { ...ctx.content, chapterGoals: [] } };
    const plan: WeekPlan = { load: 'balanced' };
    const driven = driveSeason(6, noGoals).state;
    let m = setChapterPlan(start(6), plan, ctx);
    while (!isSeasonOver(m, ctx)) {
      if (m.plannedWeek !== m.week) {
        m = {
          ...planWeek(m, repeatPlan({ ...m, lastPlan: plan }, ctx), ctx).state,
          lastPlan: m.lastPlan,
        };
      }
      m = drawWeekEvents(m, ctx).state;
      for (const pe of [...m.pendingEvents]) {
        m = resolveEvent(m, pe.eventId, prudentChoice(getEvent(pe.eventId, ctx), m), ctx).state;
      }
      for (let f = playerFixture(m); f; f = playerFixture(m)) m = simulateMatch(m, ctx).state;
      m = advanceWeek(m, ctx).state;
    }
    expect(driven.week).toBe(m.week);
    expect(driven.player.money).toEqual(m.player.money);
    expect(driven.player.condition).toEqual(m.player.condition);
    expect(driven.rngState).toEqual(m.rngState);
  });
});

describe('prima pagina', () => {
  const player = start(6);
  const log = (patch: Partial<ReturnType<typeof emptyChapterLog>>) => ({
    ...emptyChapterLog(),
    ...patch,
  });
  const fid = player.calendar.find((f) => f.homeId === player.player.clubId)!.id;
  const rich = log({
    starts: 3,
    legends: 1,
    lastLegend: { week: 10, fixtureId: fid, id: 'x', success: true },
    decisive: { week: 11, fixtureId: fid, success: false },
    bestRating: { week: 12, fixtureId: fid, rating: 8 },
    events: 2,
    lastResult: { week: 12, fixtureId: fid, result: 'win', goalsFor: 2, goalsAgainst: 1 },
  });

  it('headlines: at most 3, no duplicate kind, legend first when present', () => {
    const h = buildHeadlines(player, rich, 'relegation', 'mid', ctx);
    expect(h.length).toBeLessThanOrEqual(ctx.config.calendar.headlines.max);
    expect(new Set(h.map((x) => x.kind)).size).toBe(h.length);
    expect(h[0]!.kind).toBe('legend');
    expect(h.every((x) => x.textKey.startsWith(`headlines.${x.kind}.`))).toBe(true);
  });

  it('priority then most recent week, rating only from the threshold', () => {
    const low = log({
      bestRating: { week: 12, fixtureId: fid, rating: 7 },
      lastResult: { week: 12, fixtureId: fid, result: 'draw', goalsFor: 0, goalsAgainst: 0 },
    });
    const h = buildHeadlines(player, low, null, null, ctx);
    expect(h.map((x) => x.kind)).toEqual(['result']);
  });

  it('zero headlines only when there are no candidates', () => {
    expect(buildHeadlines(player, emptyChapterLog(), null, null, ctx)).toEqual([]);
    const only = log({
      lastResult: { week: 3, fixtureId: fid, result: 'loss', goalsFor: 0, goalsAgainst: 1 },
    });
    expect(buildHeadlines(player, only, null, null, ctx).length).toBe(1);
    expect(
      buildHeadlines(player, emptyChapterLog(), 'mid', 'promotion', ctx).map((x) => x.kind),
    ).toEqual(['table']);
  });

  it('headlines deterministic without rng', () => {
    const before = JSON.stringify(player);
    const a = buildHeadlines(player, rich, 'mid', 'promotion', ctx);
    const b = buildHeadlines(player, rich, 'mid', 'promotion', ctx);
    expect(a).toEqual(b);
    expect(JSON.stringify(player)).toBe(before);
  });

  it('advanceToStop reports headlines and resets the stretch', () => {
    const { reports, state } = driveSeason(6);
    expect(reports.some((r) => r.headlines.length > 0)).toBe(true);
    for (const r of reports) expect(r.headlines.length).toBeLessThanOrEqual(3);
    expect(state.chapter.stretch).toEqual(emptyChapterLog());
  });
});

describe('fine capitolo e stop mancanti', () => {
  const answerNews = (s: GameState) => {
    for (const pe of [...s.pendingEvents]) {
      s = resolveEvent(s, pe.eventId, prudentChoice(getEvent(pe.eventId, ctx), s), ctx).state;
    }
    return s;
  };
  /** Porta la carriera al primo chapterEnd, gestendo pick e notizie. */
  function toChapterEnd(seed: number, plan: WeekPlan = { load: 'balanced' }) {
    let s = setChapterPlan(start(seed), plan, ctx);
    for (let i = 0; i < 60; i++) {
      const out = advanceToStop(s, ctx);
      s = out.state;
      if (out.report.stop === 'chapterEnd') return { s, report: out.report };
      if (out.report.stop === 'pick') s = simulateMatch(s, ctx).state;
      if (out.report.stop === 'news') s = answerNews(s);
    }
    throw new Error('no chapterEnd');
  }

  it('chapterEnd returns before the new week and the new chapter uses the new plan', () => {
    const { s, report } = toChapterEnd(6);
    const w = s.week;
    expect(weekOfSeason(w, ctx.config.calendar)).toBe(
      ctx.config.calendar.chapters.find((c) => c.id === s.chapter.id)!.fromWeek,
    );
    expect(s.plannedWeek).not.toBe(w);
    expect(report.weeks).toBeGreaterThan(0);
    expect(s.chapter.log).toEqual(emptyChapterLog());
    expect(s.chapter.stretch).toEqual(emptyChapterLog());
    expect(playerFixture(s)?.result).toBeUndefined();
    // Stesso stato, due piani: la prima settimana del capitolo nuovo li segue.
    const run = (plan: WeekPlan) => advanceToStop(setChapterPlan(s, plan, ctx), ctx).state;
    const a = run({ load: 'push' });
    const b = run({ load: 'rest', life: 'leisure' });
    expect(a.plannedWeek).toBeGreaterThanOrEqual(w);
    expect(a.player.skills).not.toEqual(b.player.skills);
  });

  it('chapterEnd is reported also when the week has events', () => {
    for (let seed = 1; seed < 12; seed++) {
      const ends = driveSeason(seed).stops.filter((x) => x.stop === 'chapterEnd');
      expect(ends.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('returns retired at zero weeks for a retired state', () => {
    const s = { ...start(6), retired: { season: 1, week: 0, age: 35, reason: 'age' as const } };
    const out = advanceToStop(s, ctx);
    expect(out.report.stop).toBe('retired');
    expect(out.report.weeks).toBe(0);
  });

  it('simulates a due non-picked match after a news stop', () => {
    // La notizia personale è iniettata a mano (evento con trigger) in stati di ramo, costruiti
    // dagli stop reali portando avanti le settimane senza giocare: così si trovano settimane
    // con una partita non scelta.
    let hits = 0;
    for (let seed = 1; seed < 4; seed++) {
      let s = setChapterPlan(start(seed), { load: 'balanced' }, ctx);
      for (let i = 0; i < 40; i++) {
        let b = s;
        for (let k = 0; k < 6 && !isSeasonOver(b, ctx) && b.pendingEvents.length === 0; k++) {
          const probe = advanceToStop(
            {
              ...b,
              eventsWeek: b.week,
              pendingEvents: [{ eventId: 'amore_addio_01', textVariant: 1 }],
            },
            ctx,
          );
          const f = playerFixture(probe.state);
          if (
            probe.report.stop === 'news' &&
            probe.report.weeks === 0 &&
            f &&
            !probe.state.chapter.picks.some((p) => p.fixtureId === f.id)
          ) {
            const next = advanceToStop(answerNews(probe.state), ctx);
            expect(next.report.summary.some((m) => m.fixtureId === f.id)).toBe(true);
            const g = playerFixture(next.state);
            expect(!g || next.state.chapter.picks.some((p) => p.fixtureId === g.id)).toBe(true);
            hits++;
          }
          b = playerFixture(b) ? simulateMatch(b, ctx).state : advanceWeek(b, ctx).state;
        }
        const out = advanceToStop(s, ctx);
        s = out.state;
        if (out.report.stop === 'seasonEnd' || out.report.stop === 'retired') break;
        if (out.report.stop === 'pick') s = simulateMatch(s, ctx).state;
        if (out.report.stop === 'news') s = answerNews(s);
      }
    }
    expect(hits).toBeGreaterThan(0);
  });

  it('never loses a worthwhile offer behind another stop', () => {
    const worth = (s: GameState, o: GameState['offers'][number]) =>
      !s.player.clubId ||
      o.kind === 'renewal' ||
      clubLevel(s, o.clubId) < clubLevel(s, s.player.clubId);
    let hits = 0;
    for (let seed = 1; seed < 60; seed++) {
      let s = setChapterPlan(start(seed), { load: 'balanced' }, ctx);
      let seen = new Set(s.offers.map((o) => o.id));
      let weeksSinceSeen = 0;
      for (let i = 0; i < 80; i++) {
        const out = advanceToStop(s, ctx);
        s = out.state;
        weeksSinceSeen += out.report.weeks;
        const fresh = s.offers.filter((o) => !seen.has(o.id) && worth(s, o));
        // Un'offerta nuova che vale, dopo almeno una settimana, o ha fermato questo giro o
        // era già visibile al giro prima: non resta "nuova" e muta.
        if (weeksSinceSeen > 0 && fresh.length > 0) {
          hits++;
          expect(out.report.stop).toBe('offers');
        }
        seen = new Set(s.offers.map((o) => o.id));
        weeksSinceSeen = 0;
        if (out.report.stop === 'seasonEnd' || out.report.stop === 'retired') break;
        if (out.report.stop === 'pick') s = simulateMatch(s, ctx).state;
        if (out.report.stop === 'news') s = answerNews(s);
      }
    }
    expect(hits).toBeGreaterThan(0);
    // Scorre 60 carriere: il limite predefinito di 5 s è stretto con la suite intera.
  }, 20000);
});

describe('avanti veloce e capitoli', () => {
  it('attraversa i capitoli: id coerente con la settimana, obiettivo liquidato e nuovo estratto', () => {
    const cal = ctx.config.calendar;
    let s = start(6);
    const ids = new Set<string>([s.chapter.id]);
    for (let i = 0; i < 60 && !isSeasonOver(s, ctx); i++) {
      const before = s.chapter;
      s = fastForward(s, 'seasonEnd', ctx).state;
      for (const pe of [...s.pendingEvents]) s = resolveEvent(s, pe.eventId, 0, ctx).state;
      if (isSeasonOver(s, ctx)) break;
      expect(s.chapter.id).toBe(chapterOf(weekOfSeason(s.week, cal), cal));
      if (s.chapter.id !== before.id) {
        // Il capitolo lasciato aveva un obiettivo (liquidato): il nuovo ne ha già uno e lo ricorda.
        expect(s.chapter.goal).not.toBeNull();
        expect(s.chapter.goal!.settled).toBe(false);
        if (before.goal) expect(s.chapter.lastGoalId).toBe(before.goal.id);
      }
      ids.add(s.chapter.id);
    }
    expect(isSeasonOver(s, ctx)).toBe(true);
    expect(ids.size).toBeGreaterThan(1);
    expect(s.chapter.id).not.toBe('preseason');
    expect(s.chapter.goal).not.toBeNull();
    expect(s.chapter.lastGoalId).not.toBeNull();
  });

  it('senza chapterPlan ripete il piano ricordato prima del piano delle settimane saltate', () => {
    const plan: WeekPlan = { load: 'push' };
    const remembered = { ...start(6), chapterPlan: null, lastPlan: plan };
    const explicit = { ...start(6), chapterPlan: plan, lastPlan: plan };
    const a = advanceToStop(remembered, ctx);
    const b = advanceToStop(explicit, ctx);
    expect(a.state.player).toEqual(b.state.player);
    expect(a.state.rngState).toEqual(b.state.rngState);
    // Senza ricordo si ricade su skipWeekPlan: il giocatore cambia.
    const { lastPlan: _none, ...noMemory } = start(6);
    const none = advanceToStop({ ...noMemory, chapterPlan: null }, ctx);
    expect(none.state.player).not.toEqual(a.state.player);
  });
});

describe('piano a due binari nel capitolo', () => {
  /** Una settimana come la gioca il capitolo: piano ripetuto, notizie prudenti, partite simulate. */
  function step(s: GameState) {
    const planned = planWeek(s, repeatPlan(s, ctx), ctx);
    let m: GameState = s.lastPlan ? { ...planned.state, lastPlan: s.lastPlan } : planned.state;
    m = drawWeekEvents(m, ctx).state;
    for (const pe of [...m.pendingEvents]) {
      m = resolveEvent(m, pe.eventId, prudentChoice(getEvent(pe.eventId, ctx), m), ctx).state;
    }
    for (let f = playerFixture(m); f; f = playerFixture(m)) m = simulateMatch(m, ctx).state;
    return { state: advanceWeek(m, ctx).state, report: planned.report };
  }
  const chapterWeeks = (s: GameState) => {
    const cal = ctx.config.calendar;
    const id = chapterOf(weekOfSeason(s.week, cal), cal);
    let n = 0;
    for (let w = s.week; chapterOf(weekOfSeason(w, cal), cal) === id; w++) n++;
    return n;
  };
  const withSponsor = (s: GameState): GameState => ({
    ...s,
    player: {
      ...s.player,
      sponsors: [{ sponsorId: 'test_sponsor', weeklyIncome: 400, untilSeason: s.season + 1 }],
    },
  });

  it('lo sponsor che scade a metà capitolo: settimane saltate, nessuna eccezione', () => {
    let s = setChapterPlan(withSponsor(start(6)), { load: 'balanced', life: 'sponsor' }, ctx);
    const reports = [];
    for (let i = 0; i < 6; i++) {
      // Il contratto finisce dopo la terza settimana.
      if (i === 3) s = { ...s, player: { ...s.player, sponsors: [] } };
      const out = step(s);
      reports.push(out.report);
      s = out.state;
    }
    for (const r of reports.slice(0, 3)) {
      expect(r.lifeSkipped).toBeUndefined();
      expect(r.sponsorIncome).toBe(200);
    }
    for (const r of reports.slice(3)) {
      expect(r.lifeSkipped).toBe('sponsor');
      expect(r.sponsorIncome).toBeUndefined();
    }
    // Il piano non cambia da solo: lo sponsor resta, la UI lo segnala.
    expect(s.chapterPlan).toEqual({ load: 'balanced', life: 'sponsor' });
  });

  it('allo stop planIssues elenca le settimane in cui la vita è saltata', () => {
    const planned = setChapterPlan(
      withSponsor(start(6)),
      { load: 'balanced', life: 'sponsor' },
      ctx,
    );
    const s = { ...planned, player: { ...planned.player, sponsors: [] } };
    const out = advanceToStop(s, ctx);
    expect(out.report.planIssues.length).toBeGreaterThan(0);
    for (const issue of out.report.planIssues) {
      expect(issue.life).toBe('sponsor');
      expect(issue.reasonKey).toBe('week.blocked.no_sponsor');
    }
    expect(new Set(out.report.planIssues.map((i) => i.week)).size).toBe(
      out.report.planIssues.length,
    );
    // Con lo sponsor nessun problema.
    expect(advanceToStop(planned, ctx).report.planIssues).toEqual([]);
  });

  it('setChapterPlan rifiuta una vita non disponibile ora', () => {
    expect(() => setChapterPlan(start(6), { load: 'balanced', life: 'sponsor' }, ctx)).toThrow(
      /not available/,
    );
  });

  it('la serata si ripete davvero ogni settimana del capitolo', () => {
    let s = setChapterPlan(start(6), { load: 'balanced', life: 'party' }, ctx);
    const weeks = chapterWeeks(s);
    let parties = 0;
    for (let i = 0; i < weeks; i++) {
      const out = step(s);
      if (out.report.party) parties++;
      s = out.state;
    }
    expect(parties).toBe(weeks);
  });

  it('stesso seme e stesso WeekPlan: stessa carriera', () => {
    const run = () => {
      let s = setChapterPlan(start(9), { load: 'push', focus: 'shooting', life: 'family' }, ctx);
      for (let i = 0; i < 30; i++) s = step(s).state;
      return s;
    };
    expect(run()).toEqual(run());
  });
});

describe('registro del piano nel tratto', () => {
  /** Sei settimane (dalla prima con una partita) col piano dato: pianifica, simula le partite, chiude la settimana. */
  function run(plan: WeekPlan, seed = 6) {
    let s = skipToNextMatch(start(seed), ctx).state;
    const energies: number[] = [];
    let matches = 0;
    for (let i = 0; i < 6; i++) {
      s = planWeek(s, plan, ctx).state;
      for (let f = playerFixture(s); f; f = playerFixture(s)) {
        energies.push(s.player.condition.energy);
        matches++;
        s = simulateMatch(s, ctx).state;
      }
      s = advanceWeek(s, ctx).state;
    }
    return { s, energies, matches };
  }

  it('un tratto senza piano registrato non ha il campo (vecchi salvataggi)', () => {
    expect(emptyChapterLog().plan).toBeUndefined();
  });

  /** Sei settimane col piano dato, senza partite vere; nelle settimane `lossWeeks` si registra una sconfitta. */
  function runWithLosses(plan: WeekPlan, lossWeeks: number[]) {
    // Le prime settimane sono di preparazione: nessuna partita vera, solo quelle registrate a mano.
    let s = start(6);
    const probe = simulateMatch(skipToNextMatch(s, ctx).state, ctx).matchReport;
    const forced = { ...probe, result: 'loss' as const, rating: 4 };
    for (let i = 0; i < 6; i++) {
      s = planWeek(s, plan, ctx).state;
      if (lossWeeks.includes(i)) {
        const after = applyMatchAftermath(
          s.player,
          undefined,
          { selection: 'starter', minutesPlayed: 90, rating: 4, result: 'loss' },
          s.week,
          Rng.fromSeed(1),
          ctx,
          { growth: 1, injury: 0 },
          lifeModifiers(plan.life, ctx),
        );
        s = recordChapterMatch(s, forced, {
          freshness: s.player.condition.energy,
          moraleProtected: after.moraleProtected,
          startSkills: s.player.skills,
        });
      }
      s = advanceWeek(s, ctx).state;
    }
    return s;
  }

  it('Famiglia: il morale protetto conta le volte, 2 sconfitte = 2; senza Famiglia 0', () => {
    const fam = runWithLosses({ load: 'balanced', life: 'family' }, [1, 3]);
    expect(fam.chapter.stretch.plan!.moraleProtected).toBe(2);
    expect(fam.chapter.log.plan!.moraleProtected).toBe(2);
    const none = runWithLosses({ load: 'balanced' }, [1, 3]);
    expect(none.chapter.stretch.plan!.moraleProtected).toBe(0);
  });

  it('pointsGained = differenza dei floor fra inizio e fine; solo abilità cambiate', () => {
    const { s } = run({ load: 'push', focus: 'shooting' });
    const p = s.chapter.stretch.plan!;
    for (const k of Object.keys(p.skillsAtStart) as (keyof typeof p.skillsAtStart)[]) {
      const d = Math.floor(s.player.skills[k]) - Math.floor(p.skillsAtStart[k]);
      expect(p.pointsGained[k]).toBe(d === 0 ? undefined : d);
    }
    expect(p.pointsGained.shooting).toBeGreaterThan(0);
  });

  it('freschezza delle partite: una per partita, quella di inizio settimana', () => {
    const { s, energies, matches } = run({ load: 'balanced' });
    expect(matches).toBeGreaterThan(0);
    expect(s.chapter.stretch.plan!.freshnessAtMatches).toEqual(energies);
  });

  it('serata: gossip, multe e popolarità vengono dai report', () => {
    let s = start(6);
    let gossip = 0;
    let fines = 0;
    let pop = 0;
    for (let i = 0; i < 6; i++) {
      const out = planWeek(s, { load: 'balanced', life: 'party' }, ctx);
      gossip += out.report.party?.gossip ? 1 : 0;
      fines += out.report.party?.fine ? 1 : 0;
      pop += out.report.popularityGained ?? 0;
      s = advanceWeek(out.state, ctx).state;
    }
    const p = s.chapter.stretch.plan!;
    expect(p.gossip).toBe(gossip);
    expect(p.fines).toBe(fines);
    expect(p.popularity).toBe(pop);
    expect(p.popularity).toBeGreaterThan(0);
  });

  it('lo stop riporta il registro del tratto e poi si azzera', () => {
    const s = setChapterPlan(start(6), { load: 'push', focus: 'shooting' }, ctx);
    const out = advanceToStop(s, ctx);
    expect(out.report.planLog).toBeDefined();
    expect(out.state.chapter.stretch.plan).toBeUndefined();
  });
});
