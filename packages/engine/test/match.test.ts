import { describe, expect, it } from 'vitest';
import { matchSchema } from '@outstanding/config';
import {
  advanceWeek,
  autoDecider,
  beginMatch,
  consequenceOf,
  type KeyMoment,
  decideMoment,
  defaultContext,
  deserialize,
  getPendingMoment,
  isSeasonOver,
  newCareer,
  applyEffects,
  optionChance,
  ZERO_DYN,
  playerFixture,
  playMatch,
  serialize,
  simulateMatch,
  type GameState,
  type KeyMomentDecider,
  type MatchReport,
} from '../src/index';
import { baseOptions } from './fixtures';
import { chainDepth } from '../src/match/moments';
import { availableOptions } from '../src/match/match';

const ctx = defaultContext;
const first: KeyMomentDecider = () => 0;

/** Avanza fino alla prima settimana in cui gioca il club del giocatore. */
function toFirstMatch(state: GameState): GameState {
  let s = state;
  while (!playerFixture(s)) s = advanceWeek(s).state;
  return s;
}

/** Gioca una stagione intera, raccogliendo i resoconti delle partite del giocatore. */
function playSeason(state: GameState, decide: KeyMomentDecider = first) {
  let s = state;
  const reports: MatchReport[] = [];
  while (!isSeasonOver(s)) {
    const own = playerFixture(s);
    if (own && !own.result) {
      const r = playMatch(s, decide);
      s = r.state;
      reports.push(r.matchReport);
    }
    s = advanceWeek(s).state;
  }
  return { state: s, reports };
}

describe('testi della partita', () => {
  it('ha una traduzione per ogni momento, opzione e commento', () => {
    const t = ctx.content.i18n.it;
    const missing: string[] = [];
    const need = (key: string) => {
      if (!(key in t)) missing.push(key);
    };
    for (const type of ctx.config.match.moments.types) {
      for (let i = 1; i <= type.textVariants; i++) need(`match.moments.${type.id}.text.${i}`);
      for (const o of type.options) {
        if (o.legend) {
          for (const part of ['option', 'success', 'failure', 'headline']) {
            need(`match.legends.${o.legend.id}.${part}`);
          }
        } else {
          need(`match.moments.${type.id}.options.${o.id}`);
        }
      }
    }
    for (const band of ctx.config.match.rating.commentBands) {
      for (let i = 1; i <= band.variants; i++) need(`match.comment.${band.id}.${i}`);
    }
    for (const k of ['sv', 'panchina', 'fuori']) need(`match.comment.${k}`);
    expect(missing).toEqual([]);
  });
});

describe('partita', () => {
  const start = toFirstMatch(newCareer(baseOptions, 2024));

  it('è deterministica: stesso stato e stesse scelte danno la stessa partita', () => {
    const a = playMatch(start, first);
    const b = playMatch(start, first);
    expect(serialize(a.state)).toBe(serialize(b.state));
    expect(a.matchReport).toEqual(b.matchReport);
  });

  it('scrive il risultato nel calendario e chiude la partita', () => {
    const { state, matchReport } = playMatch(start, first);
    const fixture = state.calendar.find((f) => f.id === matchReport.fixtureId)!;
    expect(fixture.result).toEqual(matchReport.score);
    expect(state.currentMatch).toBeUndefined();
    expect(() => advanceWeek(state)).not.toThrow();
  });

  it('impedisce di avanzare la settimana se la partita non è giocata', () => {
    expect(() => advanceWeek(start)).toThrow();
  });

  it('si può salvare e riprendere durante un momento chiave', () => {
    // Cerca un seed in cui il giocatore ha almeno un momento chiave.
    let s = start;
    let step = beginMatch(s);
    for (let seed = 1; step.step.kind !== 'moment' && seed < 50; seed++) {
      s = toFirstMatch(newCareer(baseOptions, seed));
      step = beginMatch(s);
    }
    expect(step.step.kind).toBe('moment');
    const paused = step.state;
    expect(paused.currentMatch?.pending).not.toBeNull();
    expect(getPendingMoment(paused)).toEqual(step.step.kind === 'moment' ? step.step.moment : null);
    expect(() => advanceWeek(paused)).toThrow();

    const resumed = deserialize(serialize(paused));
    const finish = (r: ReturnType<typeof decideMoment>) =>
      r.step.kind === 'finished' ? r.step.report : playMatch(r.state, first).matchReport;
    expect(finish(decideMoment(resumed, 0))).toEqual(finish(decideMoment(paused, 0)));
    expect(() => decideMoment(paused, 99)).toThrow();
  });

  it('è coerente tra resoconto, cronaca e statistiche', () => {
    const { state, matchReport: r } = playMatch(start, first);
    const goals = r.events.filter((e) => e.kind === 'goal');
    expect(goals.filter((e) => e.side === 'home')).toHaveLength(r.score.home);
    expect(goals.filter((e) => e.side === 'away')).toHaveLength(r.score.away);
    expect(goals.filter((e) => e.kind === 'goal' && e.byPlayer)).toHaveLength(r.goals);
    expect(goals.filter((e) => e.kind === 'goal' && e.assistByPlayer)).toHaveLength(r.assists);
    const minutes = r.events.map((e) => e.minute);
    expect(minutes).toEqual([...minutes].sort((a, b) => a - b));
    const stats = state.player.seasonStats;
    expect(stats.goals).toBe(r.goals);
    expect(stats.minutes).toBe(r.minutesPlayed);
  });
});

describe('qualità del comando partita', () => {
  const started = beginMatch(toFirstMatch(newCareer(baseOptions, 3)));
  const paused = started.state;

  it('mantiene tutti gli esiti legacy con qualità neutra', () => {
    expect(started.step.kind).toBe('moment');
    expect(decideMoment(paused, { optionIndex: 0, quality: 0.5 })).toEqual(decideMoment(paused, 0));
    for (const seed of [3, 7, 11, 2024]) {
      const state = toFirstMatch(newCareer(baseOptions, seed));
      expect(playMatch(state, () => ({ optionIndex: 0, quality: 0.5 }))).toEqual(
        playMatch(state, first),
      );
    }
  });

  it('resta deterministico con qualità non neutra e dopo un salvataggio', () => {
    const command = { optionIndex: 0, quality: 0.9 };
    expect(decideMoment(deserialize(serialize(paused)), command)).toEqual(
      decideMoment(paused, command),
    );
    expect(playMatch(paused, () => command)).toEqual(playMatch(paused, () => command));
  });

  it('usa la qualità per risolvere i momenti senza introdurre casualità aggiuntiva', () => {
    const outcomes = (quality: number) =>
      Array.from({ length: 20 }, (_, seed) => {
        const state = toFirstMatch(newCareer(baseOptions, seed));
        return playMatch(state, () => ({ optionIndex: 0, quality })).matchReport.events.filter(
          (event) => event.kind === 'moment',
        );
      });
    expect(outcomes(1)).not.toEqual(outcomes(0));
  });

  it.each([NaN, Infinity, -Infinity, -0.01, 1.01])(
    'rifiuta qualità %s senza modificare stato o generatore',
    (quality) => {
      const before = serialize(paused);
      expect(() => decideMoment(paused, { optionIndex: 0, quality })).toThrow();
      expect(serialize(paused)).toBe(before);
      expect(decideMoment(paused, 0)).toEqual(decideMoment(deserialize(before), 0));
    },
  );

  it.each([NaN, Infinity, -Infinity, -1, 0.5, 99])('rifiuta indice %s', (optionIndex) => {
    const before = serialize(paused);
    expect(() => decideMoment(paused, { optionIndex, quality: 0.5 })).toThrow();
    expect(() => decideMoment(paused, optionIndex)).toThrow();
    expect(serialize(paused)).toBe(before);
  });
});

describe('probabilità dei momenti chiave', () => {
  const player = newCareer(baseOptions, 7).player;
  const option = ctx.config.match.moments.types.find((t) => t.id === 'att_box_chance')!.options[0]!;
  const { minChance, maxChance } = ctx.config.match.moments;

  it('scende contro avversari più forti ed è sempre nei limiti', () => {
    const easy = optionChance(player, option, 20, ctx);
    const hard = optionChance(player, option, 90, ctx);
    expect(easy).toBeGreaterThan(hard);
    expect(easy).toBeLessThanOrEqual(maxChance);
    expect(hard).toBeGreaterThanOrEqual(minChance);
  });

  it('applica al massimo dieci punti di qualità e conserva il bonus difficoltà', () => {
    const plain = {
      ...player,
      traits: [],
      condition: { ...player.condition, form: 50, morale: 50, energy: 50 },
    };
    const balanced = { ...option, skills: { shooting: 1 }, difficulty: 0 };
    const rating = plain.skills.shooting;
    expect(optionChance(plain, balanced, rating, ctx)).toBe(0.5);
    expect(optionChance(plain, balanced, rating, ctx, 0.03, 0.5)).toBe(0.53);
    expect(optionChance(plain, balanced, rating, ctx, 0.03, 0)).toBeCloseTo(0.43);
    expect(optionChance(plain, balanced, rating, ctx, 0.03, 1)).toBeCloseTo(0.63);
    const reduced = {
      ...ctx,
      config: {
        ...ctx.config,
        match: {
          ...ctx.config.match,
          moments: { ...ctx.config.match.moments, qualityMaxBonus: 0.04 },
        },
      },
    };
    expect(optionChance(plain, balanced, rating, reduced, 0, 1)).toBeCloseTo(0.54);
  });

  it('limita la probabilità finale anche agli estremi della qualità', () => {
    expect(optionChance(player, option, -1000, ctx, 0, 1)).toBe(maxChance);
    expect(optionChance(player, option, 1000, ctx, 0, 0)).toBe(minChance);
  });

  it.each([NaN, Infinity, -Infinity, -0.01, 1.01])(
    'rifiuta qualità %s anche nel calcolo pubblico',
    (quality) => expect(() => optionChance(player, option, 45, ctx, 0, quality)).toThrow(),
  );

  it('valida in configurazione il limite del modificatore qualità', () => {
    for (const qualityMaxBonus of [-0.01, 0.16, NaN, Infinity]) {
      expect(
        matchSchema.safeParse({
          ...ctx.config.match,
          moments: { ...ctx.config.match.moments, qualityMaxBonus },
        }).success,
      ).toBe(false);
    }
  });

  it('aumenta con i tratti adatti', () => {
    const plain = { ...player, traits: [] };
    const bomber = { ...player, traits: ['bomber_area'] };
    expect(optionChance(bomber, option, 45, ctx)).toBeGreaterThan(
      optionChance(plain, option, 45, ctx),
    );
  });
});

describe('convocazione e pagella', () => {
  it('un giocatore infortunato resta fuori senza voto', () => {
    const s = toFirstMatch(newCareer(baseOptions, 11));
    const injured = { ...s, player: { ...s.player, injury: { type: 'muscle', weeksLeft: 2 } } };
    const { matchReport } = playMatch(injured, first);
    expect(matchReport.selection).toBe('out');
    expect(matchReport.minutesPlayed).toBe(0);
    expect(matchReport.rating).toBeNull();
    expect(matchReport.commentKey).toBe('match.comment.fuori');
  });

  it('su una stagione intera produce numeri plausibili', () => {
    const { state, reports } = playSeason(newCareer(baseOptions, 99));
    expect(reports.length).toBeGreaterThan(20);
    const cfg = ctx.config.match.rating;
    for (const r of reports) {
      if (r.rating !== null) {
        expect(r.rating).toBeGreaterThanOrEqual(cfg.min);
        expect(r.rating).toBeLessThanOrEqual(cfg.max);
        expect(Number.isInteger(r.rating / cfg.step)).toBe(true);
        expect(r.minutesPlayed > 0).toBe(true);
      }
      if (r.minutesPlayed > 0 && r.minutesPlayed < cfg.minMinutes && r.goals + r.assists === 0) {
        expect(r.rating).toBeNull();
      }
    }
    const stats = state.player.seasonStats;
    expect(stats.appearances).toBe(reports.filter((r) => r.minutesPlayed > 0).length);
    expect(stats.starts).toBe(reports.filter((r) => r.selection === 'starter').length);
    // Gol medi per partita in un intervallo ragionevole.
    const total = reports.reduce((n, r) => n + r.score.home + r.score.away, 0);
    const perMatch = total / reports.length;
    expect(perMatch).toBeGreaterThan(1);
    expect(perMatch).toBeLessThan(5);
  });
});

describe('conseguenze delle opzioni', () => {
  /** Primo momento chiave trovato partendo dal seme indicato. */
  function firstMoment(seed: number) {
    for (let k = seed; k < seed + 50; k++) {
      const step = beginMatch(toFirstMatch(newCareer(baseOptions, k))).step;
      if (step.kind === 'moment') return step.moment;
    }
    throw new Error('nessun momento chiave');
  }

  it('ogni opzione dichiara cosa succede se va e se no', () => {
    for (const seed of [1, 42, 77]) {
      for (const o of firstMoment(seed).options) {
        expect(['goal', 'assist', 'teamGoal', 'rating']).toContain(o.onSuccess);
        expect(['goalAgainst', 'lost']).toContain(o.onFailure);
      }
    }
  });

  it('consequenceOf', () => {
    expect(consequenceOf({ rating: 1, goalFor: 0.6, by: 'self' }, true)).toBe('goal');
    expect(consequenceOf({ rating: 1, goalFor: 0.4, by: 'assist' }, true)).toBe('assist');
    expect(consequenceOf({ rating: 0.5, goalFor: 0.2, by: 'team' }, true)).toBe('teamGoal');
    expect(consequenceOf({ rating: 0.5 }, true)).toBe('rating');
    expect(consequenceOf({ rating: -0.5, goalAgainst: 0.3 }, false)).toBe('goalAgainst');
    expect(consequenceOf({ rating: -0.5, goalAgainst: 0 }, false)).toBe('lost');
    expect(consequenceOf({ rating: -0.5 }, false)).toBe('lost');
  });
});

describe('voci del voto', () => {
  const cfg = ctx.config.match.rating;
  const roundTo = (v: number, step: number) => Math.round(v / step) * step;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const season = (seed: number) => playSeason(newCareer(baseOptions, seed)).reports;

  it('le voci del voto sommano al voto prima di arrotondare e limitare', () => {
    let rated = 0;
    for (const seed of [1, 2, 3, 42]) {
      for (const r of season(seed)) {
        if (r.rating === null) continue;
        rated++;
        const sum = r.ratingParts!.reduce((s, p) => s + p.delta, 0);
        expect(clamp(roundTo(sum, cfg.step), cfg.min, cfg.max)).toBe(r.rating);
        expect(r.ratingParts![0]).toEqual({ key: 'base', delta: cfg.base });
        expect(r.ratingParts!.slice(1).every((p) => p.delta !== 0)).toBe(true);
      }
    }
    expect(rated).toBeGreaterThan(0);
  });

  it('senza voto niente voci', () => {
    const reports = season(99).filter((r) => r.rating === null);
    expect(reports.length).toBeGreaterThan(0);
    for (const r of reports) expect(r.ratingParts).toBeUndefined();
  });

  it('stesso seme, stesse voci', () => {
    const a = season(7).map((r) => r.ratingParts);
    expect(season(7).map((r) => r.ratingParts)).toEqual(a);
  });
});

describe('partita simulata', () => {
  it("sceglie sempre l'opzione più probabile", () => {
    const moment: KeyMoment = {
      momentId: 'x',
      minute: 10,
      textKey: 'k',
      params: {},
      score: { home: 0, away: 0 },
      dyn: ZERO_DYN,
      pressure: 0,
      options: [
        {
          id: 'a',
          textKey: 'a',
          chance: 0.3,
          onSuccess: 'rating',
          onFailure: 'lost',
          onFail: 'none',
          chanceBand: 'mid',
          risk: 'balanced',
          value: 0,
        },
        {
          id: 'b',
          textKey: 'b',
          chance: 0.8,
          onSuccess: 'rating',
          onFailure: 'lost',
          onFail: 'none',
          chanceBand: 'mid',
          risk: 'balanced',
          value: 0,
        },
        {
          id: 'c',
          textKey: 'c',
          chance: 0.5,
          onSuccess: 'rating',
          onFailure: 'lost',
          onFail: 'none',
          chanceBand: 'mid',
          risk: 'balanced',
          value: 0,
        },
      ],
    };
    expect(autoDecider(moment, toFirstMatch(newCareer(baseOptions, 3)))).toBe(1);
  });

  it('equivale a giocare la partita con la scelta automatica', () => {
    const s = toFirstMatch(newCareer(baseOptions, 3));
    const simulated = simulateMatch(s);
    expect(simulated).toEqual(playMatch(s, autoDecider, ctx, { mode: 'sim' }));
    expect(
      simulated.state.calendar.find((f) => f.id === simulated.matchReport.fixtureId)!.result,
    ).toBeDefined();
  });
});

describe('partita al minuto', () => {
  /** Mette in pausa la partita al primo momento chiave: restituisce lo stato fermo. */
  function firstPause(seed: number): GameState | null {
    const s = toFirstMatch(newCareer(baseOptions, seed));
    const r = beginMatch(s);
    return r.step.kind === 'moment' ? r.state : null;
  }

  it('la traccia ha un valore per minuto e le stesse scelte danno la stessa traccia', () => {
    const a = firstPause(3)!;
    const b = firstPause(3)!;
    const m = a.currentMatch!;
    expect(m.trace.length).toBe(m.minute);
    expect(m.trace).toEqual(b.currentMatch!.trace);
    expect(m.pressure).toBe(m.trace.at(-1));
  });

  it('il punteggio è cronologico: nessun gol dopo il minuto di pausa', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = firstPause(seed);
      if (!s) continue;
      const m = s.currentMatch!;
      expect(m.events.filter((e) => e.kind === 'goal' && e.minute > m.minute)).toEqual([]);
      const goals = m.events.filter((e) => e.kind === 'goal');
      expect(m.score.home + m.score.away).toBe(goals.length);
    }
  });

  it('la ripresa dopo una pausa equivale al gioco continuo, con momenti ancora da giocare', () => {
    let checked = 0;
    for (let seed = 1; seed <= 40 && checked < 5; seed++) {
      const paused = firstPause(seed);
      const m = paused?.currentMatch;
      if (!paused || !m || m.director.budgetLeft === 0) continue;
      checked++;
      const continuous = playMatch(toFirstMatch(newCareer(baseOptions, seed)), first);
      const reloaded = deserialize(serialize(paused));
      const resumed = playMatch(reloaded, first);
      expect(resumed.matchReport).toEqual(continuous.matchReport);
      expect(resumed.state).toEqual(continuous.state);
      // Eventi e traccia prima della pausa restano identici nel resoconto finale.
      // La traccia fino alla pausa è conservata: al termine la partita non c'è più, quindi la si
      // confronta con quella di una seconda pausa dello stesso gioco continuo.
      const again = beginMatch(toFirstMatch(newCareer(baseOptions, seed)));
      expect(again.state.currentMatch!.trace.slice(0, m.minute)).toEqual(m.trace);
      expect(m.trace).toHaveLength(m.minute);
      // Nel minuto di pausa la decisione può ancora aggiungere eventi: si confrontano i minuti prima.
      const settled = (e: { minute: number }) => e.minute < m.minute;
      const before = m.events.filter(settled);
      expect(resumed.matchReport.events.filter(settled)).toEqual(
        [...before].sort((x, y) => x.minute - y.minute),
      );
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('i gol medi per partita restano entro il 5% della baseline (2,807)', () => {
    let n = 0;
    let goals = 0;
    for (let seed = 42; n < 2000; seed++) {
      let s = newCareer(baseOptions, seed);
      while (!isSeasonOver(s) && n < 2000) {
        const f = playerFixture(s);
        if (f && !f.result) {
          const r = playMatch(s, autoDecider);
          s = r.state;
          n++;
          goals += r.matchReport.score.home + r.matchReport.score.away;
        }
        s = advanceWeek(s).state;
      }
    }
    expect(goals / n).toBeGreaterThanOrEqual(2.667);
    expect(goals / n).toBeLessThanOrEqual(2.947);
  }, 60000);
});

describe('conseguenze nel resto della partita (dyn)', () => {
  const player = newCareer(baseOptions, 7).player;
  const plain = {
    ...player,
    traits: [],
    condition: { ...player.condition, form: 50, morale: 50, energy: 50 },
  };
  const option = {
    ...ctx.config.match.moments.types.find((t) => t.id === 'att_box_chance')!.options[0]!,
    skills: { shooting: 1 },
    difficulty: 0,
  };
  const rating = plain.skills.shooting;
  const cfg = ctx.config.match;
  const m0 = () => {
    const s = toFirstMatch(newCareer(baseOptions, 7));
    const step = beginMatch(s);
    return step.state.currentMatch!;
  };

  it('default dyn keeps old chances identical', () => {
    expect(optionChance(plain, option, rating, ctx, 0, 0.5, ZERO_DYN)).toBe(
      optionChance(plain, option, rating, ctx),
    );
    expect(optionChance(plain, option, rating, ctx)).toBe(0.5);
  });

  /** Contesto di prova: ogni esito aggiunge `fx` agli stati dinamici (la config reale non cambia). */
  const withFx = (fx: Record<string, number>) => {
    const types = cfg.moments.types.map((t) => ({
      ...t,
      options: t.options.map((o) => ({
        ...o,
        success: { ...o.success, effects: fx },
        failure: { ...o.failure, effects: fx },
      })),
    }));
    return {
      ...ctx,
      config: { ...ctx.config, match: { ...cfg, moments: { ...cfg.moments, types } } },
    };
  };
  /** Gioca la partita registrando i momenti mostrati. */
  const record = (s: GameState, c: typeof ctx) => {
    const seen: KeyMoment[] = [];
    const r = playMatch(
      s,
      (mo) => {
        seen.push(mo);
        return 0;
      },
      c,
    );
    return { seen, state: r.state };
  };

  it('successful dribble raises marking and lowers next dribble chance', () => {
    const c = withFx({ marking: 1 });
    const { seen } = record(toFirstMatch(newCareer(baseOptions, 7)), c);
    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(seen[0]!.dyn.marking).toBe(0);
    expect(seen[1]!.dyn.marking).toBe(1);
    expect(cfg.dyn.chanceWeight.marking).toBeLessThan(0);
    expect(optionChance(plain, option, rating, c, 0, 0.5, seen[1]!.dyn)).toBeCloseTo(
      optionChance(plain, option, rating, c, 0, 0.5, ZERO_DYN) + cfg.dyn.chanceWeight.marking,
    );
  });

  it('fatigue lowers chance', () => {
    const m = applyEffects(m0(), { fatigue: 2 }, cfg);
    expect(optionChance(plain, option, rating, ctx, 0, 0.5, m.dyn)).toBeLessThan(0.5);
  });

  it('effects clamp to dyn.min/max and pressure to +-1', () => {
    const m = applyEffects(m0(), { nerves: 99, fatigue: -99, pressure: 5 }, cfg);
    expect(m.dyn.nerves).toBe(cfg.dyn.max);
    expect(m.dyn.fatigue).toBe(cfg.dyn.min);
    expect(m.pressure).toBe(1);
    expect(applyEffects(m, { pressure: -9 }, cfg).pressure).toBe(-1);
  });

  it('decideMoment applies the outcome effects and exposes dyn in the moment', () => {
    const c = withFx({ marking: 1 });
    const begun = beginMatch(toFirstMatch(newCareer(baseOptions, 7)), c);
    if (begun.step.kind !== 'moment') throw new Error('nessun momento');
    expect(begun.step.moment.dyn).toEqual(ZERO_DYN);
    const cm = decideMoment(begun.state, 0, c).state.currentMatch;
    expect(cm).not.toBeNull();
    expect(cm!.dyn.marking).toBe(1);
  });

  it('dyn resets each match', () => {
    const c = withFx({ marking: 1 });
    const one = record(toFirstMatch(newCareer(baseOptions, 7)), c);
    // Nella prima partita gli stati si accumulano.
    expect(Math.max(...one.seen.map((x) => x.dyn.marking))).toBeGreaterThan(0);
    let n = one.state;
    let next: KeyMoment[] = [];
    for (let i = 0; i < 60 && next.length === 0; i++) {
      n = advanceWeek(n).state;
      const f = playerFixture(n);
      if (f && !f.result) {
        const r = record(n, c);
        next = r.seen;
        n = r.state;
      }
    }
    expect(next.length).toBeGreaterThan(0);
    expect(next[0]!.dyn).toEqual(ZERO_DYN);
  });
});

describe('modalità della partita e passo decisivo', () => {
  /** Conta i passi interattivi di una partita giocata con `first`. */
  function steps(seed: number, mode?: 'full' | 'quick' | 'sim') {
    const s = toFirstMatch(newCareer(baseOptions, seed));
    let n = 0;
    const { matchReport, state } = playMatch(
      s,
      () => {
        n++;
        return 0;
      },
      ctx,
      mode ? { mode } : undefined,
    );
    return { n, report: matchReport, state };
  }

  it('quick mode shows 1–2 steps', () => {
    const [min, max] = ctx.config.match.visibleSteps;
    let played = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { n } = steps(seed, 'quick');
      if (n === 0) continue;
      played++;
      expect(n).toBeGreaterThanOrEqual(min);
      expect(n).toBeLessThanOrEqual(max);
    }
    expect(played).toBeGreaterThan(5);
  });

  it('quick: almeno un passo visibile se il giocatore resta in campo abbastanza, mai oltre quota + catena', () => {
    const { visibleSteps, moments } = ctx.config.match;
    const maxDepth = Math.max(...moments.types.map((t) => chainDepth(t.id, ctx)));
    let eligible = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const { n, report } = steps(seed, 'quick');
      const minutes = report.minutesPlayed;
      if (minutes >= moments.minMinutesForMoment) {
        eligible++;
        expect(n, `seed ${seed}`).toBeGreaterThanOrEqual(1);
      }
      expect(n).toBeLessThanOrEqual(visibleSteps[1] + maxDepth - 1);
    }
    expect(eligible).toBeGreaterThan(20);
  });

  /** Eventi `moment` della partita, divisi in visibili e automatici. */
  const split = (r: MatchReport) => {
    const ms = r.events.filter((e) => e.kind === 'moment');
    return { all: ms.length, auto: ms.filter((e) => e.auto).length };
  };

  it('quick: il budget totale è quello di full e i passi visibili restano nella quota', () => {
    const [, maxVisible] = ctx.config.match.visibleSteps;
    let hidden = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const q = steps(seed, 'quick');
      const f = steps(seed, 'full');
      const { all, auto } = split(q.report);
      expect(q.n).toBe(all - auto);
      expect(q.n).toBeLessThanOrEqual(maxVisible);
      hidden += auto;
      // stessa estrazione del budget: la quick non ha più passi totali di full
      expect(all).toBeLessThanOrEqual(ctx.config.match.steps[1]);
      expect(split(f.report).auto).toBe(0);
    }
    expect(hidden).toBeGreaterThan(20);
  });

  it('quick e sim: con lo stesso decisore automatico stesso punteggio, gol, assist, voto', () => {
    // I gesti da leggenda compaiono solo nei passi visibili: il decisore li scarta per confronto.
    const noLegend: KeyMomentDecider = (m) => {
      const ok = { ...m, options: m.options.map((o) => (o.legendId ? { ...o, chance: -1 } : o)) };
      return autoDecider(ok, undefined as never);
    };
    for (let seed = 1; seed <= 30; seed++) {
      const s = toFirstMatch(newCareer(baseOptions, seed));
      const q = playMatch(s, noLegend, ctx, { mode: 'quick' }).matchReport;
      const sim = playMatch(s, noLegend, ctx, { mode: 'sim' }).matchReport;
      expect(q.score).toEqual(sim.score);
      expect(q.goals).toBe(sim.goals);
      expect(q.assists).toBe(sim.assists);
      expect(q.rating).toBe(sim.rating);
    }
  });

  it('quick: la ripresa dal pending equivale al gioco continuo; v3 senza visibleLeft riprende', () => {
    let checked = 0;
    for (let seed = 1; seed <= 40 && checked < 5; seed++) {
      const s = toFirstMatch(newCareer(baseOptions, seed));
      const begun = beginMatch(s, ctx, { mode: 'quick' });
      if (begun.step.kind !== 'moment') continue;
      checked++;
      const continuous = playMatch(s, first, ctx, { mode: 'quick' });
      const resumed = playMatch(deserialize(serialize(begun.state)), first, ctx);
      expect(resumed.matchReport).toEqual(continuous.matchReport);
      expect(resumed.state).toEqual(continuous.state);
      // salvataggio senza `visibleLeft`: tutti i passi restano visibili, la partita finisce
      const m = begun.state.currentMatch!;
      const { visibleLeft: _v, ...director } = m.director;
      const legacy = { ...begun.state, currentMatch: { ...m, director } };
      const done = playMatch(deserialize(serialize(legacy)), first, ctx);
      expect(done.state.currentMatch).toBeUndefined();
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('availableOptions non offre leggende a un passo nascosto e non consuma la quota', () => {
    let checked = 0;
    for (let seed = 1; seed <= 40 && checked < 3; seed++) {
      const s = toFirstMatch(newCareer(baseOptions, seed));
      const m = beginMatch(s, ctx, { mode: 'quick' }).state.currentMatch;
      if (!m) continue;
      const lt = ctx.config.match.moments.types.find((t) => t.options.some((o) => o.legend));
      if (!lt) continue;
      const strong = {
        ...s.player,
        skills: Object.fromEntries(Object.keys(s.player.skills).map((k) => [k, 99])),
      } as typeof s.player;
      const chain = { rootId: lt.id, step: 2 };
      const used = m.director.legendsUsed;
      const shown = availableOptions(m, lt, chain, strong, 100, ctx, false);
      const hidden = availableOptions(m, lt, chain, strong, 100, ctx, true);
      expect(hidden.legendsOffered).toBe(0);
      expect(m.director.legendsUsed).toBe(used);
      expect(hidden.options.length).toBeLessThanOrEqual(shown.options.length);
      expect(hidden.options.every((i) => !lt.options[i]!.legend)).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('le leggende non sono mai offerte ai passi nascosti', () => {
    let hiddenSteps = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = toFirstMatch(newCareer(baseOptions, seed));
      const r = playMatch(s, first, ctx, { mode: 'sim' });
      expect(r.matchReport.legend).toBeUndefined();
      hiddenSteps += r.matchReport.events.filter((e) => e.kind === 'moment' && e.auto).length;
      expect(r.state.currentMatch).toBeUndefined();
    }
    expect(hiddenSteps).toBeGreaterThan(20);
  });

  it('default mode is full', () => {
    let checked = 0;
    let quickChecked = 0;
    for (let seed = 1; seed <= 40 && checked < 3; seed++) {
      const s = toFirstMatch(newCareer(baseOptions, seed));
      const a = beginMatch(s, ctx);
      const b = beginMatch(s, ctx, { mode: 'full' });
      if (a.step.kind !== 'moment') continue;
      checked++;
      expect(a.state.currentMatch!.mode).toBe('full');
      expect(a.state).toEqual(b.state);
      // La rapida può non fermarsi mai: senza partita in corso non c'è modalità da confrontare.
      const quick = beginMatch(s, ctx, { mode: 'quick' });
      if (quick.step.kind === 'moment') {
        expect(quick.state.currentMatch!.mode).toBe('quick');
        quickChecked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
    expect(quickChecked).toBeGreaterThan(0);
  });

  it('sim mode decides with autoDecider and never pauses', () => {
    let hidden = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const s = toFirstMatch(newCareer(baseOptions, seed));
      const sim = simulateMatch(s, ctx);
      expect(sim.state.currentMatch).toBeUndefined();
      expect(sim.matchReport.fixtureId).toBe(playerFixture(s)!.id);
      // Nessun passo visibile: la partita non si ferma mai, i passi sono tutti automatici.
      const begun = beginMatch(s, ctx, { mode: 'sim' });
      expect(begun.step.kind).toBe('finished');
      hidden += sim.matchReport.events.filter((e) => e.kind === 'moment' && e.auto).length;
      // Stesso risultato giocando di persona con autoDecider in modalità sim.
      expect(playMatch(s, autoDecider, ctx, { mode: 'sim' })).toEqual(sim);
    }
    expect(hidden).toBeGreaterThan(0);
  });

  it('report.peak is the highest-tension step with its outcome', () => {
    let checked = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { report } = steps(seed);
      if (!report.peak) continue;
      checked++;
      const ev = report.events.find(
        (e) =>
          e.kind === 'moment' &&
          e.minute === report.peak!.minute &&
          e.momentId === report.peak!.momentId,
      );
      expect(ev).toBeDefined();
      expect(report.peak.success).toBe((ev as { success: boolean }).success);
      const kind = report.peak.success ? 'success' : 'failure';
      expect(report.peak.closingKey).toMatch(new RegExp(`^match\\.peak\\.${kind}\\.([1-9]\\d*)$`));
      const variant = Number(report.peak.closingKey.split('.').at(-1));
      expect(variant).toBeGreaterThanOrEqual(1);
      expect(variant).toBeLessThanOrEqual(ctx.config.match.peak.variants);
      expect(report.peak.closingKey in ctx.content.i18n.it).toBe(true);
    }
    expect(checked).toBeGreaterThan(5);
  });

  it('every peak closing key has a translation', () => {
    const t = ctx.content.i18n.it;
    for (const kind of ['success', 'failure']) {
      for (let i = 1; i <= ctx.config.match.peak.variants; i++) {
        expect(`match.peak.${kind}.${i}` in t).toBe(true);
      }
    }
  });

  it('no steps → peak null', () => {
    let nulls = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { n, report } = steps(seed);
      if (n === 0) {
        nulls++;
        expect(report.peak).toBeNull();
      } else {
        expect(report.peak).not.toBeNull();
      }
    }
    expect(nulls).toBeGreaterThan(0);
  });
});

describe('freschezza in partita e convocazione', () => {
  const player = newCareer(baseOptions, 7).player;
  const option = ctx.config.match.moments.types.find((t) => t.id === 'att_box_chance')!.options[0]!;
  const withFreshness = (energy: number) => ({
    ...player,
    condition: { ...player.condition, energy },
  });

  it('sposta la probabilità del momento di freschezzaWeight*2 fra 0 e 100', () => {
    const wide = {
      ...ctx,
      config: {
        ...ctx.config,
        match: {
          ...ctx.config.match,
          moments: { ...ctx.config.match.moments, minChance: 0, maxChance: 1 },
        },
      },
    };
    const rating = withFreshness(50).skills.shooting;
    const hard = { ...option, skills: { shooting: 1 }, difficulty: 0 };
    const fresh = optionChance(withFreshness(100), hard, rating - 5, wide);
    const tired = optionChance(withFreshness(0), hard, rating - 5, wide);
    expect(fresh - tired).toBeCloseTo(0.12);
  });

  it('la convocazione perde 3 punti a freschezza 30 rispetto a 70', async () => {
    const { selectPlayer } = await import('../src/match/selection');
    const { computeOvr } = await import('../src/player/ratings');
    const { Rng } = await import('../src/rng');
    const quiet = {
      ...ctx,
      config: {
        ...ctx.config,
        match: { ...ctx.config.match, selection: { ...ctx.config.match.selection, noise: 0 } },
      },
    };
    const base = {
      ...player,
      relationships: {},
      condition: { ...player.condition, form: 50, morale: 50 },
    };
    const ovr = computeOvr(base.skills, base.role, quiet.config.ratings);
    const rival = (o: number) => ({ role: base.role, ovr: o });
    // Il rivale è 2 punti sopra: con freschezza 70 il giocatore è davanti solo se non perde nulla;
    // con 30 la penalità (3) lo fa scivolare dietro
    const club = (o: number) =>
      ({
        coachId: 'c',
        roster: Array.from({ length: 40 }, () => rival(o)),
      }) as never;
    const starters = quiet.config.world.formation[base.role];
    expect(starters).toBeGreaterThan(0);
    const pick = (energy: number, rivalOvr: number) =>
      selectPlayer(
        { ...base, condition: { ...base.condition, energy } },
        club(rivalOvr),
        Rng.fromSeed(1),
        quiet,
      );
    // 40 rivali a ovr+1 (sopra a 70, sotto a 30 non cambia: tutti sopra): usiamo rivali a ovr-1
    expect(pick(70, ovr - 1)).toBe('starter');
    expect(pick(70, ovr - 1)).not.toBe('out');
    // 40 rivali a ovr-1: a 70 il giocatore li batte tutti, a 30 (-3) li perde tutti
    expect(pick(30, ovr - 1)).toBe('out');
  });
});
