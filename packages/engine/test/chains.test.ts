import { describe, expect, it } from 'vitest';
import type {
  MomentOptionConfig,
  MomentOutcomeConfig,
  MomentTypeConfig,
} from '@outstanding/config';
import { checkMomentKeys } from '@outstanding/content';
import {
  advanceWeek,
  autoDecider,
  beginMatch,
  decideMoment,
  defaultContext,
  deserialize,
  getPendingMoment,
  newCareer,
  playerFixture,
  playMatch,
  prudentMomentChoice,
  serialize,
  type GameContext,
  type GameState,
  type KeyMoment,
  type KeyMomentOption,
  type MatchEvent,
  type MatchStep,
} from '../src/index';
import { chainDepth, chanceBandOf, onFailOf, pickMomentType } from '../src/match/moments';
import { Rng } from '../src/rng';
import { baseOptions } from './fixtures';

const base = defaultContext;

/** Difficoltà che rende l'esito certo nel contesto di prova (probabilità 1 oppure 0). */
const SURE = -1000;
const NEVER = 1000;

const opt = (
  id: string,
  difficulty: number,
  success: MomentOutcomeConfig,
  failure: MomentOutcomeConfig,
  extra: Partial<MomentOptionConfig> = {},
): MomentOptionConfig => ({
  id,
  skills: { shooting: 1 },
  difficulty,
  risk: 'balanced',
  success,
  failure,
  ...extra,
});

const ALL_ROLES = { GK: 1, DEF: 1, MID: 1, ATT: 1 };

/**
 * Tipi di prova: `t_pass` (3 passi: pass → cross → header, oppure palla persa → contropiede),
 * più una radice di un passo per fase. I passi di catena hanno l'opzione "chiudi".
 */
const TYPES: MomentTypeConfig[] = [
  {
    id: 't_pass',
    phase: 'attack',
    weights: { GK: 2, DEF: 2, MID: 3, ATT: 3 },
    textVariants: 1,
    options: [
      opt('pass', SURE, { rating: 0.25, next: { momentId: 't_cross' } }, { rating: 0 }),
      opt(
        'lose',
        NEVER,
        { rating: 0 },
        { rating: -0.25, goalAgainst: 1, next: { momentId: 't_counter', chance: 1 } },
      ),
      opt(
        'gamble',
        NEVER,
        { rating: 0 },
        { rating: -0.5, goalAgainst: 1, next: { momentId: 't_counter', chance: 0 } },
      ),
    ],
  },
  {
    id: 't_cross',
    phase: 'attack',
    chainOnly: true,
    weights: {},
    textVariants: 1,
    options: [
      opt(
        'cross',
        SURE,
        { rating: 0.25, next: { momentId: 't_header' } },
        { rating: 0, next: { momentId: 't_header', chance: 0.5 } },
      ),
      opt(
        'keep',
        NEVER,
        { rating: 0.1, effects: { pressure: 0.1 } },
        { rating: 0 },
        { risk: 'safe', closes: true },
      ),
      // Gemella di `keep` senza "chiudi": stessa resa, ma estrae (probabilità 1).
      opt(
        'keep_ref',
        SURE,
        { rating: 0.1, effects: { pressure: 0.1 } },
        { rating: 0 },
        { risk: 'safe' },
      ),
    ],
  },
  {
    id: 't_header',
    phase: 'attack',
    chainOnly: true,
    weights: {},
    textVariants: 2,
    options: [
      opt('head', 0, { rating: 0.5, goalFor: 0.5, by: 'self' }, { rating: -0.25 }),
      opt('keep', 0, { rating: 0.1 }, { rating: 0 }, { risk: 'safe', closes: true }),
    ],
  },
  {
    id: 't_counter',
    phase: 'defense',
    chainOnly: true,
    weights: {},
    textVariants: 1,
    options: [
      opt('tackle', 0, { rating: 0.25 }, { rating: -0.5, goalAgainst: 0.3 }),
      opt('keep', 0, { rating: 0.1 }, { rating: 0 }, { risk: 'safe', closes: true }),
    ],
  },
  {
    id: 't_shot',
    phase: 'attack',
    weights: ALL_ROLES,
    textVariants: 1,
    options: [
      opt('shoot', 0, { rating: 0.5, goalFor: 0.3, by: 'self' }, { rating: -0.25 }),
      opt('safe', -5, { rating: 0.25 }, { rating: 0 }),
    ],
  },
  {
    id: 't_block',
    phase: 'defense',
    weights: ALL_ROLES,
    textVariants: 1,
    options: [
      opt('block', 0, { rating: 0.5 }, { rating: -0.5, goalAgainst: 0.3 }),
      opt('clear', -5, { rating: 0.25 }, { rating: 0 }),
    ],
  },
];

/** Contesto di prova: tipi sopra, nessun modificatore, probabilità libere fra 0 e 1. */
const fctx: GameContext = (() => {
  const match = base.config.match;
  const zeroDyn = { coachTrust: 0, nerves: 0, fatigue: 0, marking: 0 };
  return {
    ...base,
    config: {
      ...base.config,
      match: {
        ...match,
        dyn: { ...match.dyn, chanceWeight: zeroDyn },
        moments: {
          ...match.moments,
          types: TYPES,
          minChance: 0,
          maxChance: 1,
          formWeight: 0,
          moraleWeight: 0,
          energyWeight: 0,
          freshnessWeight: 0,
          qualityMaxBonus: 0,
        },
      },
    },
  };
})();
const cfg = fctx.config.match;

/** Avanza fino alla prima settimana in cui gioca il club del giocatore. */
function toFirstMatch(state: GameState, c: GameContext = fctx): GameState {
  let s = state;
  while (!playerFixture(s)) s = advanceWeek(s, c).state;
  return s;
}

/** Primo seme con un momento aperto nella prima partita (contesto di prova). */
function firstPending(): GameState {
  for (let seed = 1; seed < 200; seed++) {
    const r = beginMatch(toFirstMatch(newCareer(baseOptions, seed, fctx)), fctx);
    if (r.step.kind === 'moment') return r.state;
  }
  throw new Error('no pending moment found');
}

/** Sostituisce il momento aperto con la radice `momentId`, con budget abbondante. */
function withPending(state: GameState, momentId: string, budgetLeft = 6): GameState {
  const m = state.currentMatch!;
  const type = TYPES.find((t) => t.id === momentId)!;
  return {
    ...state,
    currentMatch: {
      ...m,
      director: { ...m.director, budgetLeft },
      pending: {
        momentId,
        minute: m.pending!.minute,
        textVariant: 1,
        options: type.options.map((_, i) => i),
      },
    },
  };
}

const decide = (s: GameState, momentId: string, optionId: string, quality = 0.5) =>
  decideMoment(
    s,
    {
      optionIndex: TYPES.find((t) => t.id === momentId)!.options.findIndex(
        (o) => o.id === optionId,
      ),
      quality,
    },
    fctx,
  );

const asMoment = (step: MatchStep): KeyMoment => {
  if (step.kind !== 'moment') throw new Error('expected a moment');
  return step.moment;
};

/** Eventi della partita dopo una decisione (in corso o finita). */
const eventsOf = (r: { state: GameState; step: MatchStep }): MatchEvent[] =>
  r.step.kind === 'moment' ? r.state.currentMatch!.events : r.step.report.events;

const goalsAt = (events: MatchEvent[], minute: number) =>
  events.filter((e) => e.kind === 'goal' && e.minute === minute);

/** Gioca una partita registrando i momenti mostrati; il decisore sceglie a caso col seme dato. */
function record(state: GameState, seed: number, c: GameContext = fctx) {
  const rng = Rng.fromSeed(seed);
  const seen: KeyMoment[] = [];
  const r = playMatch(
    state,
    (mo) => {
      seen.push(mo);
      return rng.int(0, mo.options.length - 1);
    },
    c,
  );
  return { seen, report: r.matchReport };
}

describe('catene di momenti (contesto di prova)', () => {
  it('pass success leads to cross then header', () => {
    const s0 = withPending(firstPending(), 't_pass');
    const minute = s0.currentMatch!.pending!.minute;
    const r1 = decide(s0, 't_pass', 'pass');
    const m1 = asMoment(r1.step);
    expect(m1.momentId).toBe('t_cross');
    expect(m1.chain).toEqual({ rootId: 't_pass', step: 2 });
    const r2 = decide(r1.state, 't_cross', 'cross');
    const m2 = asMoment(r2.step);
    expect(m2.momentId).toBe('t_header');
    expect(m2.chain).toEqual({ rootId: 't_pass', step: 3 });
    expect([m1.minute, m2.minute]).toEqual([minute, minute]);
    // I passi di catena consumano budget ma non contano come nuovi interventi.
    const d0 = s0.currentMatch!.director;
    const d2 = r2.state.currentMatch!.director;
    expect(d2.budgetLeft).toBe(d0.budgetLeft - 2);
    expect(d2.interventions).toBe(d0.interventions);
    expect(d2.lastAt).toBe(d0.lastAt);
    expect(d2.lastTypes.slice(-2)).toEqual(['t_cross', 't_header']);
  });

  it('failure with next does not apply goalAgainst', () => {
    const s0 = withPending(firstPending(), 't_pass');
    const r = decide(s0, 't_pass', 'lose');
    const mo = asMoment(r.step);
    expect(mo.momentId).toBe('t_counter');
    expect(mo.chain).toEqual({ rootId: 't_pass', step: 2 });
    expect(r.state.currentMatch!.score).toEqual(s0.currentMatch!.score);
  });

  it('failed next.chance applies outcome goals', () => {
    const s0 = withPending(firstPending(), 't_pass');
    const m0 = s0.currentMatch!;
    const minute = m0.pending!.minute;
    const r = decide(s0, 't_pass', 'gamble');
    if (r.step.kind === 'moment') expect(r.step.moment.chain).toBeUndefined();
    const againstOf = (events: MatchEvent[]) =>
      goalsAt(events, minute).filter((e) => e.kind === 'goal' && e.side !== m0.side).length;
    expect(againstOf(eventsOf(r))).toBe(againstOf(m0.events) + 1);
  });

  it('chain is never opened when chainDepth > budgetLeft', () => {
    expect(chainDepth('t_pass', fctx)).toBe(3);
    const m = firstPending().currentMatch!;
    for (let seed = 1; seed <= 300; seed++) {
      for (const maxDepth of [1, 2]) {
        const t = pickMomentType('ATT', m, maxDepth, Rng.fromSeed(seed), fctx);
        expect(t).not.toBeNull();
        expect(chainDepth(t!.id, fctx)).toBeLessThanOrEqual(maxDepth);
      }
    }
    // In partita (tryArm reale): con budget piccolo ogni radice aperta ha chainDepth ≤ budget
    // residuo, t_pass (profondità 3) non apre mai con budget 2 e il budget non va sotto 0.
    let roots = 0;
    for (const budget of [2, 3]) {
      const c: GameContext = {
        ...fctx,
        config: {
          ...fctx.config,
          match: { ...cfg, steps: [budget, budget] },
        },
      };
      for (let seed = 1; seed <= 40; seed++) {
        const s = toFirstMatch(newCareer(baseOptions, seed, c), c);
        // Il budget estratto può essere ridotto (minuti in campo), mai superato.
        const start = beginMatch(s, c).state.currentMatch?.director.budgetStart ?? 0;
        expect(start).toBeLessThanOrEqual(budget);
        const { seen } = record(s, seed, c);
        expect(seen.length).toBeLessThanOrEqual(start);
        seen.forEach((mo, i) => {
          if (mo.chain) return;
          roots++;
          expect(chainDepth(mo.momentId, c)).toBeLessThanOrEqual(start - i);
          if (budget === 2) expect(mo.momentId).not.toBe('t_pass');
        });
      }
    }
    expect(roots).toBeGreaterThan(0);
  });

  it('chain steps share the root minute and depth never exceeds chainMaxSteps', () => {
    let chained = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const { seen } = record(toFirstMatch(newCareer(baseOptions, seed, fctx)), seed);
      seen.forEach((mo, i) => {
        if (!mo.chain) return;
        chained++;
        const prev = seen[i - 1]!;
        expect(mo.minute).toBe(prev.minute);
        expect(mo.chain.step).toBe((prev.chain?.step ?? 1) + 1);
        expect(mo.chain.rootId).toBe(prev.chain?.rootId ?? prev.momentId);
        expect(mo.chain.step).toBeLessThanOrEqual(cfg.director.chainMaxSteps);
      });
    }
    expect(chained).toBeGreaterThan(0);
    for (const t of TYPES.filter((x) => !x.chainOnly)) {
      expect(chainDepth(t.id, fctx)).toBeLessThanOrEqual(cfg.director.chainMaxSteps);
    }
  });

  it('resume mid-chain equals continuous', () => {
    let resumedInChain = 0;
    for (let seed = 1; seed <= 25; seed++) {
      const s = toFirstMatch(newCareer(baseOptions, seed, fctx));
      const pick = (mo: KeyMoment, i: number) => (i * 7 + mo.minute) % mo.options.length;
      let i = 0;
      const shown: KeyMoment[] = [];
      const continuous = playMatch(
        s,
        (mo) => {
          shown.push(mo);
          return pick(mo, i++);
        },
        fctx,
      );
      let j = 0;
      let { state: cur, step } = beginMatch(s, fctx);
      while (step.kind === 'moment') {
        if (step.moment.chain) resumedInChain++;
        cur = deserialize(serialize(cur), fctx);
        // Il momento ricostruito dal salvataggio (radice, passo, variante, opzioni) è lo stesso.
        const pending = getPendingMoment(cur, fctx);
        expect(pending).toEqual(shown[j]);
        ({ state: cur, step } = decideMoment(cur, pick(pending!, j++), fctx));
      }
      expect(j).toBe(shown.length);
      expect(step.report).toEqual(continuous.matchReport);
      expect(cur).toEqual(continuous.state);
    }
    expect(resumedInChain).toBeGreaterThan(0);
  });

  it('closes option ends the chain without goals', () => {
    const r1 = decide(withPending(firstPending(), 't_pass'), 't_pass', 'pass');
    const minute = asMoment(r1.step).minute;
    const before = r1.state.currentMatch!;
    const r2 = decide(r1.state, 't_cross', 'keep');
    const events = eventsOf(r2);
    expect(events.filter((e) => e.kind === 'moment').at(-1)).toMatchObject({
      momentId: 't_cross',
      optionId: 'keep',
      success: true,
    });
    expect(goalsAt(events, minute).length).toBe(goalsAt(before.events, minute).length);
    if (r2.step.kind === 'moment') {
      // La catena è finita: il prossimo momento è una nuova radice, dopo il respiro.
      expect(r2.step.moment.chain).toBeUndefined();
      expect(r2.step.moment.minute).toBeGreaterThanOrEqual(minute + cfg.director.relaxMinutes);
    }
  });

  it('closes option always succeeds without consuming rng', () => {
    const s1 = decide(withPending(firstPending(), 't_pass'), 't_pass', 'pass').state;
    // Riferimento: la gemella non "chiudi" estrae una volta (probabilità 1), poi la partita va
    // avanti. "Chiudi" partendo dal generatore già avanzato di un'estrazione deve coincidere.
    const ref = decide(s1, 't_cross', 'keep_ref');
    const rng = Rng.fromState(s1.rngState);
    rng.next();
    const shifted = { ...s1, rngState: rng.getState() };
    for (const quality of [0, 0.5, 1]) {
      const closed = decide(shifted, 't_cross', 'keep', quality);
      expect(closed.state.rngState).toEqual(ref.state.rngState);
      expect(
        eventsOf(closed).find((e) => e.kind === 'moment' && e.optionId === 'keep'),
      ).toMatchObject({ success: true });
    }
    // La vista mostra la probabilità vera: 1, fascia alta, nessuna conseguenza.
    const keep = getPendingMoment(s1, fctx)!.options.find((o) => o.id === 'keep')!;
    expect(keep).toMatchObject({ chance: 1, chanceBand: 'high', onFail: 'none' });
  });

  it('chanceBand matches real chance', () => {
    const bands = cfg.chanceBands;
    expect(chanceBandOf(bands.low - 0.01, bands)).toBe('low');
    expect(chanceBandOf(bands.low, bands)).toBe('mid');
    expect(chanceBandOf(bands.high - 0.01, bands)).toBe('mid');
    expect(chanceBandOf(bands.high, bands)).toBe('high');
    // Con la config reale: ogni opzione mostrata ha la fascia della sua probabilità.
    let checked = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const s = toFirstMatch(newCareer(baseOptions, seed), base);
      for (const mo of record(s, seed, base).seen) {
        for (const o of mo.options) {
          checked++;
          expect(o.chanceBand).toBe(chanceBandOf(o.chance, base.config.match.chanceBands));
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('onFail is counter when failure.next is counter_recovery', () => {
    const opt2 = (id: string, o: string) =>
      TYPES.find((t) => t.id === id)!.options.find((x) => x.id === o)!;
    expect(onFailOf(opt2('t_pass', 'lose'), fctx)).toBe('counter');
    // next.chance 0: il contropiede non arriva mai, resta il gol avversario dell'esito.
    expect(onFailOf(opt2('t_pass', 'gamble'), fctx)).toBe('lost');
    expect(onFailOf(opt2('t_block', 'block'), fctx)).toBe('lost');
    expect(onFailOf(opt2('t_pass', 'pass'), fctx)).toBe('none');
    // Un seguito in attacco (seconda palla) non è un contropiede.
    expect(onFailOf(opt2('t_cross', 'cross'), fctx)).toBe('none');
    const shown = getPendingMoment(withPending(firstPending(), 't_pass'), fctx)!;
    expect(shown.options.map((o) => o.onFail)).toEqual(['none', 'counter', 'lost']);
  });

  it('content check finds missing moment text keys, chainOnly included', () => {
    const t = base.content.i18n.it;
    const missing = checkMomentKeys(TYPES, t);
    expect(missing.some((e) => e.includes('match.moments.t_counter.options.keep'))).toBe(true);
    const all = Object.fromEntries(
      TYPES.flatMap((ty) => [
        ...Array.from({ length: ty.textVariants }, (_, i) => [
          `match.moments.${ty.id}.text.${i + 1}`,
          'x',
        ]),
        ...ty.options.map((o) => [`match.moments.${ty.id}.options.${o.id}`, 'x']),
      ]),
    );
    expect(checkMomentKeys(TYPES, { ...t, ...all })).toEqual([]);
  });
});

describe('prudentMomentChoice (decisore automatico)', () => {
  const opt = (id: string, chance: number, closes = false): KeyMomentOption => ({
    id,
    textKey: `k.${id}`,
    chance,
    onSuccess: 'rating',
    onFailure: 'rating',
    onFail: 'none',
    chanceBand: chanceBandOf(chance, base.config.match.chanceBands),
    risk: 'balanced',
    value: 0,
    ...(closes ? { closes: true as const } : {}),
  });
  const moment = (options: KeyMomentOption[]): KeyMoment => ({
    momentId: 'm',
    minute: 50,
    textKey: 'k',
    params: {},
    score: { home: 0, away: 0 },
    dyn: { coachTrust: 0, nerves: 0, fatigue: 0, marking: 0 },
    pressure: 0,
    options,
  });
  const { low, high } = base.config.match.chanceBands;

  it('closes when the best open option is in the low band', () => {
    const m = moment([opt('a', low - 0.1), opt('b', low - 0.05), opt('c', 1, true)]);
    expect(prudentMomentChoice(m)).toBe(2);
    expect(autoDecider(m, undefined as never)).toBe(2);
  });

  it('keeps playing when the best open option is mid or high', () => {
    expect(prudentMomentChoice(moment([opt('a', low), opt('c', 1, true)]))).toBe(0);
    expect(
      prudentMomentChoice(moment([opt('c', 1, true), opt('a', low + 0.01), opt('b', high)])),
    ).toBe(2);
  });

  it('without a closes option picks the highest chance', () => {
    expect(prudentMomentChoice(moment([opt('a', 0.1), opt('b', 0.3), opt('c', 0.2)]))).toBe(1);
  });
});
