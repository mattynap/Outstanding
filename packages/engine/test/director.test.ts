import { describe, expect, it } from 'vitest';
import { parseConfig, rawDefaultConfig } from '@outstanding/config';
import {
  advanceWeek,
  autoDecider,
  beginMatch,
  decideMoment,
  defaultContext,
  deserialize,
  isSeasonOver,
  newCareer,
  playerFixture,
  playMatch,
  serialize,
  type GameContext,
  type GameState,
  type MatchReport,
  type MatchState,
  type Role,
} from '../src/index';
import {
  arm,
  directorMinute,
  gate,
  initialDirector,
  onChainEnd,
  onStepOpened,
  reserveFor,
  tension,
} from '../src/match/director';
import { chainDepth, phaseOf, pickMomentType } from '../src/match/moments';
import { stepPressure } from '../src/match/pressure';
import { Rng } from '../src/rng';
import { baseOptions } from './fixtures';

const ctx = defaultContext;
const cfg = ctx.config.match;
const dc = cfg.director;

/** Partita di prova del regista: titolare per 90', 0-0, posta nulla, budget 6. */
function ms(over: Partial<MatchState> = {}, director: Partial<MatchState['director']> = {}) {
  const base: MatchState = {
    fixtureId: 'f',
    side: 'home',
    opponentId: 'o',
    selection: 'starter',
    minuteIn: 0,
    minuteOut: 90,
    minute: 0,
    mode: 'full',
    pressure: 0,
    trace: [],
    director: {
      budgetStart: 6,
      budgetLeft: 6,
      hotLeft: null,
      lastAt: null,
      interventions: 0,
      armed: null,
      relaxUntil: null,
      lastTypes: [],
      legendsUsed: 0,
      peak: null,
    },
    dyn: { coachTrust: 0, nerves: 0, fatigue: 0, marking: 0 },
    stakes: 0,
    legend: null,
    score: { home: 0, away: 0 },
    events: [],
    pending: null,
    ratingDelta: 0,
    goals: 0,
    assists: 0,
  };
  return { ...base, ...over, director: { ...base.director, ...director } };
}

interface Opened {
  minute: number;
  momentId: string;
  tension: number;
}

/**
 * Regista senza motore: pressione dal rumore, gol imposti dal test, ogni momento chiude subito la
 * sua catena. Stesso ordine di `run`: gol, contabilità, preavviso, apertura.
 */
function drive(
  m0: MatchState,
  rng: Rng,
  opts: { goalsAt?: Record<number, 'home' | 'away'>; until?: number; role?: Role } = {},
) {
  let m = m0;
  const opened: Opened[] = [];
  const buildups: { minute: number; momentId: string }[] = [];
  const until = opts.until ?? 90;
  while (m.minute < until) {
    const minute = m.minute + 1;
    const p = stepPressure(m.pressure, 0, 0, rng, cfg.pressure);
    const scorer = opts.goalsAt?.[minute];
    const score = scorer ? { ...m.score, [scorer]: m.score[scorer] + 1 } : m.score;
    m = directorMinute({ ...m, minute, pressure: p, score }, scorer !== undefined, cfg);
    if (!m.director.armed) {
      const g = gate(m, cfg);
      if (g.kind !== 'none' && (g.kind === 'forced' || rng.chance(g.p))) {
        const type = pickMomentType(
          opts.role ?? 'ATT',
          phaseOf(m.pressure),
          m,
          g.maxDepth,
          rng,
          ctx,
        );
        if (type) {
          m = { ...m, director: arm(m.director, minute, type.id, g.kind === 'forced', cfg) };
          buildups.push({ minute, momentId: type.id });
        }
      }
    }
    const armed = m.director.armed;
    if (armed && armed.at <= minute) {
      const t = tension(m, cfg);
      opened.push({ minute, momentId: armed.momentId, tension: t });
      const d = onStepOpened(
        m.director,
        { minute, momentId: armed.momentId, tension: t, root: true },
        cfg,
      );
      m = { ...m, director: onChainEnd(d, minute, cfg) };
    }
  }
  return { m, opened, buildups };
}

/** Contesto con una config modificata (per catene e affinità di prova). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withConfig(edit: (raw: Record<string, any>) => void): GameContext {
  const raw = JSON.parse(JSON.stringify(rawDefaultConfig));
  edit(raw);
  return { ...ctx, config: parseConfig(raw) };
}

interface Sampled {
  report: MatchReport;
  minuteIn: number | null;
  minuteOut: number;
  pauses: MatchState[];
}

/** Partite vere del giocatore, ruoli a rotazione, una stagione per seme, scelte automatiche. */
function sample(full90: number): Sampled[] {
  const roles: Role[] = ['ATT', 'MID', 'DEF', 'GK'];
  const out: Sampled[] = [];
  let n90 = 0;
  for (let seed = 1; n90 < full90; seed++) {
    let s = newCareer({ ...baseOptions, role: roles[seed % 4]!, traits: [] }, seed);
    while (!isSeasonOver(s) && n90 < full90) {
      const f = playerFixture(s);
      if (f && !f.result) {
        let { state, step } = beginMatch(s);
        const cm = state.currentMatch;
        const pauses: MatchState[] = [];
        while (step.kind === 'moment') {
          pauses.push(state.currentMatch!);
          ({ state, step } = decideMoment(state, autoDecider(step.moment, state)));
        }
        const minuteIn = cm?.minuteIn ?? pauses[0]?.minuteIn ?? null;
        out.push({ report: step.report, minuteIn, minuteOut: cm?.minuteOut ?? 90, pauses });
        if (step.report.minutesPlayed === 90) n90++;
        s = state;
      }
      s = advanceWeek(s).state;
    }
  }
  return out;
}

// beginMatch restituisce lo stato in pausa solo con un momento: per chi non gioca minuteIn si
// ricava dal resoconto.
const SAMPLE = sample(2000);
const momentsOf = (r: MatchReport) => r.events.filter((e) => e.kind === 'moment');

describe('tensione', () => {
  it('segue la formula della spec', () => {
    const m = ms({ minute: 45, stakes: 0.5, pressure: 0.8, score: { home: 1, away: 1 } });
    const time = dc.timeBase + (1 - dc.timeBase) * Math.pow(45 / 90, dc.timeExp);
    const expected =
      dc.wGame * dc.close['0']! * time +
      dc.wStakes * 0.5 +
      dc.wPress * (0.8 - cfg.pressure.dangerAt);
    expect(tension(m, cfg)).toBeCloseTo(expected, 10);
    // La differenza reti è limitata a ±3.
    const big = ms({ minute: 45, score: { home: 0, away: 7 } });
    expect(tension(big, cfg)).toBeCloseTo(dc.wGame * dc.close['-3']! * time, 10);
  });
});

describe('regista della partita', () => {
  it("0-0 at 10' with stakes 0 does not intervene (10k seeds < 5%)", () => {
    let hits = 0;
    for (let seed = 1; seed <= 10_000; seed++) {
      const { opened, buildups } = drive(ms({}, { interventions: 1 }), Rng.fromSeed(seed), {
        until: 10,
      });
      if (opened.length + buildups.length > 0) hits++;
    }
    expect(hits / 10_000).toBeLessThan(0.05);
  });

  it("1-1 at 88' intervenes above threshold", () => {
    const at88 = ms({ minute: 88, score: { home: 1, away: 1 } });
    expect(tension(at88, cfg)).toBeGreaterThanOrEqual(dc.threshold);
    // Frequenza: dall'80' con 1-1 fisso, già un intervento al 60' (niente minimo garantito).
    let hits = 0;
    const n = 2000;
    for (let seed = 1; seed <= n; seed++) {
      const m = ms({ minute: 79, score: { home: 1, away: 1 } }, { interventions: 1, lastAt: 60 });
      if (drive(m, Rng.fromSeed(seed)).opened.length > 0) hits++;
    }
    expect(hits / n).toBeGreaterThan(0.5);
  });

  it('respects minGap', () => {
    const hot = { minute: 60, stakes: 1, score: { home: 1, away: 1 } };
    const d = { interventions: 1, budgetLeft: 6 };
    expect(gate(ms(hot, { ...d, lastAt: 60 - dc.minGap + 1 }), cfg).kind).toBe('none');
    expect(gate(ms(hot, { ...d, lastAt: 60 - dc.minGap }), cfg).kind).toBe('roll');
    // Nelle partite vere due radici non sono mai più vicine di hotGap, né di minGap prima di hotFrom.
    for (const { report } of SAMPLE) {
      const minutes = momentsOf(report).map((e) => e.minute);
      for (let i = 1; i < minutes.length; i++) {
        const gap = minutes[i]! - minutes[i - 1]!;
        expect(gap).toBeGreaterThanOrEqual(dc.hotGap);
        if (minutes[i]! - dc.armLead < dc.hotFrom) expect(gap).toBeGreaterThanOrEqual(dc.minGap);
      }
    }
  });

  it('hot finale lowers gap and reserves slots', () => {
    // Al 75' sull'1-1 si apre il finale caldo con hotSlots passi riservati.
    const at75 = directorMinute(
      ms({ minute: dc.hotFrom, score: { home: 1, away: 1 } }, { interventions: 2, budgetLeft: 4 }),
      false,
      cfg,
    );
    expect(at75.director.hotLeft).toBe(Math.min(dc.hotSlots, 4));
    // Con hotLeft > 0 l'intervallo scende a hotGap.
    const late = { ...at75, minute: 80 };
    expect(
      gate({ ...late, director: { ...late.director, lastAt: 80 - dc.hotGap } }, cfg).kind,
    ).toBe('roll');
    expect(
      gate({ ...late, director: { ...late.director, lastAt: 80 - dc.hotGap + 1 } }, cfg).kind,
    ).toBe('none');
    // Senza finale caldo vale minGap.
    const cold = { ...late, director: { ...late.director, hotLeft: 0, lastAt: 80 - dc.hotGap } };
    expect(gate(cold, cfg).kind).toBe('none');
    // Sullo 0-2 il finale non si apre; si apre più tardi se la partita torna in bilico.
    const far = directorMinute(ms({ minute: 76, score: { home: 0, away: 2 } }), false, cfg);
    expect(far.director.hotLeft).toBeNull();
    const back = directorMinute({ ...far, minute: 80, score: { home: 1, away: 2 } }, true, cfg);
    expect(back.director.hotLeft).toBe(Math.min(dc.hotSlots, 6));
    // Una volta valutato non si rivaluta più.
    const again = directorMinute({ ...back, minute: 81, score: { home: 1, away: 4 } }, true, cfg);
    expect(again.director.hotLeft).toBe(back.director.hotLeft);
  });

  it('never intervenes off pitch', () => {
    const loud = { stakes: 1, score: { home: 1, away: 1 } };
    expect(gate(ms({ ...loud, minute: 50, minuteIn: 60 }), cfg).kind).toBe('none');
    expect(gate(ms({ ...loud, minute: 60, minuteIn: 60 }), cfg).kind).toBe('none');
    expect(gate(ms({ ...loud, minute: 70, minuteOut: 65 }), cfg).kind).toBe('none');
    expect(gate(ms({ ...loud, minute: 70, minuteIn: null }), cfg).kind).toBe('none');
    for (const { report, minuteIn, minuteOut } of SAMPLE) {
      for (const e of momentsOf(report)) {
        expect(minuteIn).not.toBeNull();
        expect(e.minute).toBeGreaterThan(minuteIn!);
        expect(e.minute).toBeLessThanOrEqual(minuteOut);
      }
    }
  });

  it('bench player: 0 interventions, no crash', () => {
    const rng = Rng.fromSeed(3);
    const before = rng.getState();
    const d = initialDirector('full', 0, rng, cfg);
    expect(d.budgetLeft).toBe(0);
    expect(rng.getState()).toEqual(before);
    const bench = drive(ms({ minuteIn: null, selection: 'bench' }, d), Rng.fromSeed(4));
    expect(bench.opened).toEqual([]);
    const benched = SAMPLE.filter((x) => x.report.minutesPlayed === 0);
    expect(benched.length).toBeGreaterThan(0);
    for (const { report } of benched) {
      expect(momentsOf(report)).toEqual([]);
      expect(report.events.some((e) => e.kind === 'buildup')).toBe(false);
      expect(report.rating).toBeNull();
    }
  });

  it('at least 1 intervention if on pitch ≥ minMinutesForMoment', () => {
    const min = cfg.moments.minMinutesForMoment;
    for (const { report } of SAMPLE) {
      if (report.minutesPlayed >= min) expect(momentsOf(report).length).toBeGreaterThanOrEqual(1);
    }
    // Esattamente minMinutesForMoment, partita chiusa e senza posta: arriva il minimo garantito.
    for (const [minuteIn, minuteOut] of [
      [90 - min, 90],
      [0, min],
    ] as const) {
      const d = initialDirector('full', minuteOut - minuteIn, Rng.fromSeed(1), cfg);
      expect(d.budgetLeft).toBeGreaterThanOrEqual(1);
      const m = ms({ minuteIn, minuteOut, minute: 0, score: { home: 0, away: 3 } }, d);
      const { opened } = drive(m, Rng.fromSeed(9), { goalsAt: { [minuteOut]: 'away' } });
      expect(opened.map((o) => o.minute)).toEqual([minuteOut]);
    }
    // Sotto la soglia di minuti niente budget.
    expect(initialDirector('full', min - 1, Rng.fromSeed(1), cfg).budgetLeft).toBe(0);
  });

  it("mean interventions in full mode with player on pitch 90' ≥ 3 over 2000 matches", () => {
    const full = SAMPLE.filter((x) => x.report.minutesPlayed === 90);
    expect(full.length).toBeGreaterThanOrEqual(2000);
    const mean = full.reduce((s, x) => s + momentsOf(x.report).length, 0) / full.length;
    expect(mean).toBeGreaterThanOrEqual(3);
    // Mai oltre il budget della modalità.
    for (const x of full) expect(momentsOf(x.report).length).toBeLessThanOrEqual(cfg.modes.full[1]);
  });

  it('same seed same intervention minutes', () => {
    for (const seed of [5, 6, 7]) {
      let s = newCareer(baseOptions, seed);
      while (!playerFixture(s)) s = advanceWeek(s).state;
      const a = playMatch(s, autoDecider).matchReport;
      const b = playMatch(s, autoDecider).matchReport;
      expect(momentsOf(a).map((e) => e.minute)).toEqual(momentsOf(b).map((e) => e.minute));
      expect(a).toEqual(b);
    }
  });

  it('resume after pause equals continuous play', () => {
    let checked = 0;
    for (let seed = 1; seed <= 6 && checked <= 5; seed++) {
      let s: GameState = newCareer(baseOptions, seed);
      for (let week = 0; week < 40 && !isSeasonOver(s) && checked <= 5; week++) {
        const f = playerFixture(s);
        if (f && !f.result) {
          const continuous = playMatch(s, autoDecider);
          // Salva e ricarica a ogni momento aperto.
          let { state, step } = beginMatch(deserialize(serialize(s)));
          let pauses = 0;
          while (step.kind === 'moment') {
            pauses++;
            state = deserialize(serialize(state));
            ({ state, step } = decideMoment(state, autoDecider(step.moment, state)));
          }
          expect(step.report).toEqual(continuous.matchReport);
          expect(state).toEqual(continuous.state);
          if (pauses > 1) checked++;
          s = continuous.state;
        }
        s = advanceWeek(s).state;
      }
    }
    expect(checked).toBeGreaterThan(5);
  }, 60_000);

  it('buildup event precedes every root moment by armLead', () => {
    let cancelled = 0;
    for (const { report } of SAMPLE) {
      const buildups = report.events.filter((e) => e.kind === 'buildup');
      const moments = momentsOf(report);
      for (const mo of moments) {
        const b = buildups.find((e) => e.minute === mo.minute - dc.armLead);
        expect(b).toBeDefined();
        expect(b?.kind === 'buildup' && b.momentId).toBe(mo.momentId);
        expect(b?.kind === 'buildup' && b.textKey).toMatch(
          /^match\.buildup\.(attack|defense)\.\d+$/,
        );
      }
      // Un preavviso senza momento è stato annullato da un gol prima dell'apertura.
      for (const b of buildups) {
        if (moments.some((mo) => mo.minute === b.minute + dc.armLead)) continue;
        cancelled++;
        const goal = report.events.some(
          (e) => e.kind === 'goal' && e.minute > b.minute && e.minute <= b.minute + dc.armLead,
        );
        expect(goal).toBe(true);
      }
    }
    expect(cancelled).toBeGreaterThan(0);
  });

  it('armed is never overwritten', () => {
    const armed = arm(ms().director, 30, 'att_counter', false, cfg);
    expect(() => arm(armed, 31, 'att_wing', false, cfg)).toThrow(/already armed/);
    const m = ms({ minute: 31, stakes: 1, score: { home: 1, away: 1 } }, armed);
    expect(gate(m, cfg).kind).toBe('none');
    // Nella cronaca vera due preavvisi non si sovrappongono.
    for (const { report } of SAMPLE) {
      const b = report.events.filter((e) => e.kind === 'buildup').map((e) => e.minute);
      for (let i = 1; i < b.length; i++)
        expect(b[i]! - b[i - 1]!).toBeGreaterThanOrEqual(dc.armLead);
    }
  });

  it('armed beyond minuteOut is never created', () => {
    const loud = { stakes: 1, score: { home: 1, away: 1 }, minuteOut: 60 };
    expect(gate(ms({ ...loud, minute: 60 - dc.armLead + 1 }), cfg).kind).toBe('none');
    expect(gate(ms({ ...loud, minute: 60 - dc.armLead }), cfg).kind).not.toBe('none');
    for (const { report, minuteOut } of SAMPLE) {
      for (const e of report.events) {
        if (e.kind === 'buildup') expect(e.minute + dc.armLead).toBeLessThanOrEqual(minuteOut);
      }
    }
    // L'asserzione difensiva: un armato oltre l'uscita è un errore.
    const bad = ms({ minute: 61, minuteOut: 60 }, { armed: { at: 62, momentId: 'att_wing' } });
    expect(() => directorMinute(bad, false, cfg)).toThrow(/beyond minuteOut/);
  });

  it('guaranteed minimum armed at minuteOut − armLead', () => {
    // Partita chiusa, respiro e intervallo attivi: solo il minimo garantito può armare.
    const quiet = { score: { home: 0, away: 3 }, minuteOut: 70 };
    const d = { relaxUntil: 80, lastAt: null };
    expect(gate(ms({ ...quiet, minute: 70 - dc.armLead - 1 }, d), cfg).kind).toBe('none');
    const g = gate(ms({ ...quiet, minute: 70 - dc.armLead }, d), cfg);
    expect(g).toEqual({ kind: 'forced', maxDepth: 6 });
    // Già un intervento: niente minimo.
    expect(gate(ms({ ...quiet, minute: 70 - dc.armLead }, { interventions: 1 }), cfg).kind).toBe(
      'none',
    );
    // Il preavviso forzato resiste al gol.
    const forced = ms(
      { minute: 70, minuteOut: 70 },
      { armed: { at: 70, momentId: 'att_wing', forced: true } },
    );
    expect(directorMinute(forced, true, cfg).director.armed).toEqual(forced.director.armed);
    // Nelle partite vere, chi ha un solo momento all'ultimo minuto in campo lo ha avuto d'ufficio.
    const late = SAMPLE.filter(
      (x) => momentsOf(x.report).length === 1 && momentsOf(x.report)[0]!.minute === x.minuteOut,
    );
    expect(late.length).toBeGreaterThan(0);
  });

  it('hot reserve: before hotFrom a root opens only if the reserve still fits', () => {
    const loud = { minute: 50, stakes: 1, score: { home: 1, away: 1 } };
    const reserve = Math.min(dc.hotSlots, 5 - 1);
    expect(reserveFor(ms(loud, { budgetStart: 5 }), cfg)).toBe(reserve);
    const fits = gate(ms(loud, { budgetStart: 5, budgetLeft: reserve + 1, interventions: 1 }), cfg);
    expect(fits).toMatchObject({ kind: 'roll', maxDepth: 1 });
    expect(
      gate(ms(loud, { budgetStart: 5, budgetLeft: reserve, interventions: 1 }), cfg).kind,
    ).toBe('none');
    // Dopo hotFrom la riserva si libera; chi esce prima di hotFrom non riserva nulla.
    expect(reserveFor(ms({ ...loud, minute: dc.hotFrom }, { budgetStart: 5 }), cfg)).toBe(0);
    expect(reserveFor(ms({ ...loud, minuteOut: dc.hotFrom }, { budgetStart: 5 }), cfg)).toBe(0);
    // Il tipo estratto sta sempre entro maxDepth: una radice da 2 passi non entra in 1.
    const chained = withConfig((raw) => {
      const base = raw.moments.types.find((t: { id: string }) => t.id === 'att_wing');
      base.options[0].success.next = { momentId: 'att_follow' };
      raw.moments.types.push({
        id: 'att_follow',
        phase: 'attack',
        chainOnly: true,
        weights: {},
        textVariants: 1,
        options: [
          {
            ...base.options[1],
            id: 'chiudi',
            risk: 'safe',
            closes: true,
            success: { rating: 0.1 },
            failure: { rating: 0 },
          },
          { ...base.options[0], id: 'tira', success: { rating: 0.3 } },
        ],
      });
    });
    expect(chainDepth('att_wing', chained)).toBe(2);
    expect(chainDepth('att_box_chance', chained)).toBe(1);
    const m = ms({ pressure: 0.1 });
    for (let seed = 1; seed <= 300; seed++) {
      const t = pickMomentType('ATT', 'attack', m, 1, Rng.fromSeed(seed), chained);
      expect(t?.id).not.toBe('att_wing');
    }
  });

  it('hotLeft decreases with every step after hotFrom', () => {
    let d = ms({}, { hotLeft: 2 }).director;
    const step = (minute: number) => ({ minute, momentId: 'att_wing', tension: 0.5, root: true });
    d = onStepOpened(d, step(70), cfg);
    expect(d.hotLeft).toBe(2);
    d = onStepOpened(d, step(dc.hotFrom), cfg);
    expect(d.hotLeft).toBe(1);
    // Anche un passo di catena (non radice) consuma il finale caldo.
    d = onStepOpened(d, { ...step(80), root: false }, cfg);
    expect(d.hotLeft).toBe(0);
    d = onStepOpened(d, step(85), cfg);
    expect(d.hotLeft).toBe(0);
    expect(d.budgetLeft).toBe(2);
  });

  it('goal before armed.at cancels it and keeps budget', () => {
    const armed = ms({ minute: 40 }, { armed: { at: 41, momentId: 'att_wing' }, interventions: 1 });
    const after = directorMinute(armed, true, cfg).director;
    expect(after.armed).toBeNull();
    expect(after.budgetLeft).toBe(armed.director.budgetLeft);
    expect(after.interventions).toBe(1);
    expect(after.lastTypes).toEqual([]);
    expect(after.relaxUntil).toBe(40 + dc.relaxMinutes);
    // Senza gol il preavviso resta.
    expect(directorMinute(armed, false, cfg).director.armed).toEqual(armed.director.armed);
  });

  it('no intervention during relax (relaxMinutes, hotGap in hot finale)', () => {
    const loud = { stakes: 1, score: { home: 1, away: 1 } };
    const relaxed = directorMinute(ms({ ...loud, minute: 30 }), true, cfg);
    expect(relaxed.director.relaxUntil).toBe(30 + dc.relaxMinutes);
    const rd = { ...relaxed.director, interventions: 1 };
    for (let minute = 31; minute < 30 + dc.relaxMinutes; minute++) {
      expect(gate({ ...relaxed, minute, director: rd }, cfg).kind).toBe('none');
    }
    expect(gate({ ...relaxed, minute: 30 + dc.relaxMinutes, director: rd }, cfg).kind).toBe('roll');
    // Nel finale caldo il respiro dura hotGap, anche dopo una catena.
    const hot = ms({ ...loud, minute: 80 }, { hotLeft: 1 });
    expect(directorMinute(hot, true, cfg).director.relaxUntil).toBe(80 + dc.hotGap);
    expect(onChainEnd(hot.director, 80, cfg).relaxUntil).toBe(80 + dc.hotGap);
    expect(onChainEnd(ms().director, 50, cfg).relaxUntil).toBe(50 + dc.relaxMinutes);
  });

  it('same type never proposed twice in a row when alternatives exist', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const m = ms({}, { lastTypes: ['att_wing', 'att_box_chance'] });
      const t = pickMomentType('ATT', 'attack', m, 6, Rng.fromSeed(seed), ctx)!;
      expect(t.id).not.toBe('att_box_chance');
    }
    // Il difensore in attacco ha un solo tipo: si ripete.
    const only = ms({}, { lastTypes: ['def_set_piece'] });
    expect(pickMomentType('DEF', 'attack', only, 6, Rng.fromSeed(1), ctx)!.id).toBe(
      'def_set_piece',
    );
    // La fase segue il segno della pressione (0 = attacco).
    expect(phaseOf(0)).toBe('attack');
    expect(phaseOf(-0.01)).toBe('defense');
  });

  it('high marking raises share of affine types', () => {
    const affine = cfg.moments.types.find((t) => t.affinity === 'marking')!;
    expect(affine).toBeDefined();
    const role = (Object.keys(affine.weights)[0] ?? 'MID') as Role;
    const share = (marking: number) => {
      let hits = 0;
      const m = ms({ dyn: { coachTrust: 0, nerves: 0, fatigue: 0, marking } });
      for (let seed = 1; seed <= 4000; seed++) {
        const t = pickMomentType(role, affine.phase, m, 6, Rng.fromSeed(seed), ctx)!;
        if (t.id === affine.id) hits++;
      }
      return hits / 4000;
    };
    expect(share(1)).toBeGreaterThan(share(0) + 0.03);
  });

  it('peak is the step with highest tension', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { m, opened } = drive(ms({ stakes: 0.4 }), Rng.fromSeed(seed), {
        goalsAt: { 30: 'away', 70: 'home' },
      });
      if (opened.length === 0) continue;
      const best = opened.reduce((a, b) => (b.tension > a.tension ? b : a));
      expect(m.director.peak).toMatchObject({
        minute: best.minute,
        momentId: best.momentId,
        tension: best.tension,
      });
    }
    // Nelle partite vere: picco = massimo delle tensioni alle aperture, esito scritto da decideMoment.
    let checked = 0;
    for (const { pauses, report } of SAMPLE) {
      if (pauses.length < 2) continue;
      const last = pauses.at(-1)!;
      const max = Math.max(...pauses.map((p) => tension(p, cfg)));
      expect(last.director.peak!.tension).toBeCloseTo(max, 12);
      const peak = last.director.peak!;
      if (peak.minute < last.minute) {
        const ev = momentsOf(report).find((e) => e.minute === peak.minute)!;
        expect(ev.kind === 'moment' && ev.success).toBe(peak.success);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
