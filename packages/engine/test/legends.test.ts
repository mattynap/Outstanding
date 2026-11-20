import { describe, expect, it } from 'vitest';
import type {
  MomentOptionConfig,
  MomentOutcomeConfig,
  MomentTypeConfig,
} from '@outstanding/config';
import { checkMomentKeys } from '@outstanding/content';
import {
  advanceWeek,
  beginMatch,
  decideMoment,
  defaultContext,
  deserialize,
  getPendingMoment,
  newCareer,
  playerFixture,
  playMatch,
  serialize,
  type GameContext,
  type GameState,
  type KeyMoment,
  type MatchStep,
} from '../src/index';
import { Rng } from '../src/rng';
import { availableOptions } from '../src/match/match';
import { baseOptions } from './fixtures';

const base = defaultContext;
const SURE = -1000;
const ALL_ROLES = { GK: 1, DEF: 1, MID: 1, ATT: 1 };

const opt = (
  id: string,
  success: MomentOutcomeConfig,
  failure: MomentOutcomeConfig,
  extra: Partial<MomentOptionConfig> = {},
): MomentOptionConfig => ({
  id,
  skills: { shooting: 1 },
  difficulty: SURE,
  risk: 'balanced',
  success,
  failure,
  ...extra,
});
const zero: MomentOutcomeConfig = { rating: 0 };
const keep = opt('keep', { rating: 0.1 }, zero, { risk: 'safe', closes: true });

interface LegendSpec {
  minTension: number;
  skill: number;
  perMatch: number;
}

/** Catena l_root → l_mid → l_end; il gesto da leggenda sta in l_end (e, con un seguito, in l_mid). */
function typesFor(l: LegendSpec): MomentTypeConfig[] {
  const legend = { id: 'test_gesto', minTension: l.minTension, skills: { shooting: l.skill } };
  return [
    {
      id: 'l_root',
      phase: 'attack',
      weights: ALL_ROLES,
      textVariants: 1,
      options: [
        opt('go', { rating: 0, next: { momentId: 'l_mid' } }, zero),
        opt('stay', zero, zero),
      ],
    },
    {
      id: 'l_defense',
      phase: 'defense',
      weights: ALL_ROLES,
      textVariants: 1,
      options: [opt('clear', zero, zero)],
    },
    {
      id: 'l_mid',
      phase: 'attack',
      chainOnly: true,
      weights: {},
      textVariants: 1,
      options: [
        opt('go', { rating: 0, next: { momentId: 'l_end' } }, zero),
        // Fuori schema: un gesto con seguito non deve mai comparire.
        opt('legnext', { rating: 0, next: { momentId: 'l_end' } }, zero, {
          risk: 'risky',
          legend: { ...legend, id: 'test_next' },
        }),
        keep,
      ],
    },
    {
      id: 'l_end',
      phase: 'attack',
      chainOnly: true,
      weights: {},
      textVariants: 1,
      options: [
        opt('twin', { rating: 0.25 }, { rating: -0.25 }, { risk: 'risky' }),
        opt('legend', { rating: 0.25 }, { rating: -0.25 }, { risk: 'risky', legend }),
        keep,
      ],
    },
  ];
}

function ctxFor(l: LegendSpec): GameContext {
  const match = base.config.match;
  const zeroDyn = { coachTrust: 0, nerves: 0, fatigue: 0, marking: 0 };
  return {
    ...base,
    config: {
      ...base.config,
      match: {
        ...match,
        legends: { ...match.legends, perMatch: l.perMatch },
        dyn: { ...match.dyn, chanceWeight: zeroDyn },
        moments: {
          ...match.moments,
          types: typesFor(l),
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
}

const OPEN: LegendSpec = { minTension: 0, skill: 1, perMatch: 1 };
const octx = ctxFor(OPEN);

function toFirstMatch(state: GameState, c: GameContext): GameState {
  let s = state;
  while (!playerFixture(s)) s = advanceWeek(s, c).state;
  return s;
}

function firstPending(c: GameContext): GameState {
  for (let seed = 1; seed < 200; seed++) {
    const r = beginMatch(toFirstMatch(newCareer(baseOptions, seed, c), c), c);
    if (r.step.kind === 'moment') return r.state;
  }
  throw new Error('no pending moment found');
}

function withRoot(state: GameState): GameState {
  const m = state.currentMatch!;
  return {
    ...state,
    currentMatch: {
      ...m,
      director: { ...m.director, budgetLeft: 6, legendsUsed: 0 },
      pending: { momentId: 'l_root', minute: m.pending!.minute, textVariant: 1, options: [0, 1] },
    },
  };
}

const typeOf = (c: GameContext, id: string) =>
  c.config.match.moments.types.find((t) => t.id === id)!;
const idx = (c: GameContext, typeId: string, optId: string) =>
  typeOf(c, typeId).options.findIndex((o) => o.id === optId);

/** Dalla radice fino all'ultimo passo (l_end), sempre con l'opzione "go". */
function toEnd(c: GameContext, mutate: (s: GameState) => GameState = (s) => s) {
  const s = mutate(withRoot(firstPending(c)));
  let r = decideMoment(s, idx(c, 'l_root', 'go'), c);
  r = decideMoment(r.state, idx(c, 'l_mid', 'go'), c);
  const step = r.step;
  if (step.kind !== 'moment') throw new Error('expected the last step');
  return { state: r.state, moment: step.moment };
}

const ids = (mo: KeyMoment) => mo.options.map((o) => o.id);

describe('momenti da leggenda', () => {
  it('legend option hidden below minTension', () => {
    expect(ids(toEnd(octx).moment)).toContain('legend');
    const high = ctxFor({ ...OPEN, minTension: 1e6 });
    expect(ids(toEnd(high).moment)).not.toContain('legend');
  });

  it('legend option hidden when skills too low', () => {
    const weak = ctxFor({ ...OPEN, skill: 101 });
    expect(ids(toEnd(weak).moment)).toEqual(['twin', 'keep']);
  });

  it('legend only on last chain step, never on a root', () => {
    const { state, moment } = toEnd(octx);
    expect(moment.chain!.step).toBe(3);
    // Il gesto con un seguito in l_mid (passo 2) non compare.
    const s = withRoot(firstPending(octx));
    const mid = decideMoment(s, idx(octx, 'l_root', 'go'), octx);
    expect(ids((mid.step as Extract<MatchStep, { kind: 'moment' }>).moment)).toEqual([
      'go',
      'keep',
    ]);
    // Lo stesso tipo aperto come radice (nessuna catena) non offre il gesto.
    const asRoot: GameState = {
      ...state,
      currentMatch: {
        ...state.currentMatch!,
        pending: {
          momentId: 'l_end',
          minute: state.currentMatch!.pending!.minute,
          textVariant: 1,
          options: [0, 2],
        },
      },
    };
    expect(ids(getPendingMoment(asRoot, octx)!)).toEqual(['twin', 'keep']);
  });

  it('at most legends.perMatch per match', () => {
    const { state } = toEnd(octx);
    expect(state.currentMatch!.director.legendsUsed).toBe(1);
    // Con la quota già usata il gesto non viene più offerto.
    const used = toEnd(octx, (s) => {
      const m = s.currentMatch!;
      return { ...s, currentMatch: { ...m, director: { ...m.director, legendsUsed: 1 } } };
    });
    expect(ids(used.moment)).toEqual(['twin', 'keep']);
    expect(used.state.currentMatch!.director.legendsUsed).toBe(1);
  });

  it('offering a legend consumes legendsUsed even if not chosen', () => {
    const { state, moment } = toEnd(octx);
    expect(state.currentMatch!.director.legendsUsed).toBe(1);
    const r = decideMoment(state, ids(moment).indexOf('twin'), octx);
    const after = r.step.kind === 'moment' ? r.state.currentMatch! : null;
    if (after) expect(after.director.legendsUsed).toBe(1);
    expect(r.state.currentMatch?.legend ?? null).toBeNull();
  });

  it('optionIndex maps through pending.options', () => {
    const { state } = toEnd(octx);
    const m = state.currentMatch!;
    const full = idx(octx, 'l_end', 'legend');
    // Indici della config offerti nell'ordine: twin, legend, keep.
    expect(m.pending!.options).toEqual([0, full, 2]);
    // Senza il gesto la posizione 1 è "keep", non il gesto.
    const hidden = toEnd(ctxFor({ ...OPEN, skill: 101 }));
    expect(hidden.state.currentMatch!.pending!.options).toEqual([0, 2]);
    const r = decideMoment(hidden.state, 1, ctxFor({ ...OPEN, skill: 101 }));
    expect(r.state.currentMatch?.legend ?? null).toBeNull();
    expect(() => decideMoment(hidden.state, 2, ctxFor({ ...OPEN, skill: 101 }))).toThrow(
      /Invalid option/,
    );
    const ev = (
      r.step.kind === 'moment' ? r.state.currentMatch!.events : r.step.report.events
    ).filter((e) => e.kind === 'moment');
    expect(ev.at(-1)).toMatchObject({ momentId: 'l_end', optionId: 'keep' });
  });

  it('resume keeps the same available options and legend result', () => {
    const { state, moment } = toEnd(octx);
    const resumed = deserialize(serialize(state), octx);
    expect(getPendingMoment(resumed, octx)).toEqual(moment);
    const pos = ids(moment).indexOf('legend');
    const a = decideMoment(state, pos, octx);
    const b = decideMoment(resumed, pos, octx);
    expect(b.state.rngState).toEqual(a.state.rngState);
    const legendOf = (r: typeof a) =>
      r.step.kind === 'moment' ? r.state.currentMatch!.legend : r.step.report.legend;
    expect(legendOf(b)).toEqual(legendOf(a));
    expect(legendOf(a)).toEqual({ id: 'test_gesto', success: true });
  });

  it('legend chance equals optionChance (no hidden bonus)', () => {
    const real = ctxFor({ ...OPEN });
    // Difficoltà reale: la gemella "twin" e il gesto hanno stesse abilità e difficoltà.
    const types = real.config.match.moments.types.map((t) =>
      t.id === 'l_end'
        ? {
            ...t,
            options: t.options.map((o) => ({ ...o, difficulty: o.closes ? o.difficulty : 0 })),
          }
        : t,
    );
    const c: GameContext = {
      ...real,
      config: {
        ...real.config,
        match: { ...real.config.match, moments: { ...real.config.match.moments, types } },
      },
    };
    const { moment } = toEnd(c);
    const legend = moment.options.find((o) => o.id === 'legend')!;
    const twin = moment.options.find((o) => o.id === 'twin')!;
    // Stesse abilità e difficoltà della gemella: la stessa probabilità, senza bonus nascosti.
    expect(legend.chance).toBe(twin.chance);
    expect(legend.chance).toBeGreaterThan(0);
    expect(legend.chance).toBeLessThan(1);
  });

  it('success adds rating and popularity', () => {
    const { state, moment } = toEnd(octx);
    const rate = (name: string) => {
      const r = decideMoment(state, ids(moment).indexOf(name), octx);
      return r;
    };
    const a = rate('legend');
    const b = rate('twin');
    // Finito il passo, la partita prosegue: confronto sul voto e sulla popolarità finali.
    const finish = (r: typeof a) => {
      const done = playMatch(r.state, (mo) => mo.options.length - 1, octx);
      return done;
    };
    const fa = finish(a);
    const fb = finish(b);
    expect(fa.matchReport.legend).toEqual({ id: 'test_gesto', success: true });
    expect(fb.matchReport.legend).toBeUndefined();
    const pop = (r: typeof fa) => r.state.player.image.popularity;
    expect(pop(fa) - pop(fb)).toBe(octx.config.match.legends.popularity);
    const parts = (r: typeof fa) =>
      r.matchReport.ratingParts!.find((p) => p.key === 'moments')?.delta ?? 0;
    expect(parts(fa) - parts(fb)).toBeCloseTo(octx.config.match.legends.ratingBonus, 9);
  });

  it('matchReport.legend set on success and failure', () => {
    // Fallimento: difficoltà impossibile sul gesto.
    const real = ctxFor(OPEN);
    const types = real.config.match.moments.types.map((t) =>
      t.id === 'l_end'
        ? { ...t, options: t.options.map((o) => (o.legend ? { ...o, difficulty: 1000 } : o)) }
        : t,
    );
    const c: GameContext = {
      ...real,
      config: {
        ...real.config,
        match: { ...real.config.match, moments: { ...real.config.match.moments, types } },
      },
    };
    const { state, moment } = toEnd(c);
    const r = decideMoment(state, ids(moment).indexOf('legend'), c);
    const done = playMatch(r.state, (mo) => mo.options.length - 1, c);
    expect(done.matchReport.legend).toEqual({ id: 'test_gesto', success: false });
    expect(done.state.player.image.popularity).toBeLessThanOrEqual(
      state.player.image.popularity + 10,
    );
  });

  it('content:check finds legend keys', () => {
    const t = base.content.i18n.it;
    const missing = checkMomentKeys(typesFor(OPEN).slice(3), t);
    for (const part of ['option', 'success', 'failure', 'headline']) {
      expect(missing.some((e) => e.includes(`match.legends.test_gesto.${part}`))).toBe(true);
    }
    const all = Object.fromEntries(
      ['option', 'success', 'failure', 'headline'].map((p) => [
        `match.legends.test_gesto.${p}`,
        'x',
      ]),
    );
    const rest = checkMomentKeys(typesFor(OPEN).slice(3), {
      ...t,
      ...all,
      'match.moments.l_end.text.1': 'x',
      'match.moments.l_end.options.twin': 'x',
      'match.moments.l_end.options.keep': 'x',
    });
    expect(rest).toEqual([]);
  });
});

describe('più gesti idonei sullo stesso passo', () => {
  /** l_end con un secondo gesto: soglie sulla stessa abilità, margini diversi. */
  const twoLegends = (thresholdA: number, thresholdB: number, perMatch = 1): GameContext => {
    const c = ctxFor({ ...OPEN, perMatch });
    const types = c.config.match.moments.types.map((t) => {
      if (t.id !== 'l_end') return t;
      const mk = (id: string, min: number): MomentTypeConfig['options'][number] => ({
        ...t.options[1]!,
        id,
        legend: { id, minTension: 0, skills: { shooting: min } },
      });
      return {
        ...t,
        options: [t.options[0]!, mk('leg_a', thresholdA), mk('leg_b', thresholdB), t.options[2]!],
      };
    });
    return {
      ...c,
      config: {
        ...c.config,
        match: { ...c.config.match, moments: { ...c.config.match.moments, types } },
      },
    };
  };
  const shooting60 = (s: GameState): GameState => ({
    ...s,
    player: { ...s.player, skills: { ...s.player.skills, shooting: 60 } },
  });

  it('offers only the legend with the larger margin over its thresholds', () => {
    const a = twoLegends(10, 50);
    expect(ids(toEnd(a, shooting60).moment)).toEqual(['twin', 'leg_a', 'keep']);
    const b = twoLegends(50, 10);
    expect(ids(toEnd(b, shooting60).moment)).toEqual(['twin', 'leg_b', 'keep']);
    expect(toEnd(b, shooting60).state.currentMatch!.director.legendsUsed).toBe(1);
  });

  it('ties go to the config order', () => {
    expect(ids(toEnd(twoLegends(30, 30), shooting60).moment)).toEqual(['twin', 'leg_a', 'keep']);
  });

  it('one legend per step even with perMatch 2; a later step can offer another', () => {
    const c = twoLegends(10, 50, 2);
    const first = toEnd(c, shooting60);
    expect(ids(first.moment)).toEqual(['twin', 'leg_a', 'keep']);
    expect(first.state.currentMatch!.director.legendsUsed).toBe(1);
    // Con una quota già usata, un passo successivo ne offre ancora uno (ma uno solo).
    const m = first.state.currentMatch!;
    const type = c.config.match.moments.types.find((t) => t.id === 'l_end')!;
    const player = shooting60(first.state).player;
    const chain = { rootId: 'l_root', step: 3 };
    const later = availableOptions(m, type, chain, player, 1, c);
    expect(later.legendsOffered).toBe(1);
    const spent = { ...m, director: { ...m.director, legendsUsed: 2 } };
    expect(availableOptions(spent, type, chain, player, 1, c).legendsOffered).toBe(0);
  });

  it('every catalog legend can be offered with a profile that favours it', () => {
    const start = firstPending(base);
    const m = start.currentMatch!;
    const all = base.config.match.moments.types.flatMap((t) =>
      t.options.filter((o) => o.legend).map((o) => ({ t, o })),
    );
    expect(all.length).toBe(12);
    for (const { t, o } of all) {
      const th = o.legend!.skills as Record<string, number>;
      // Profili: soglie esatte e, per ogni abilità del gesto, quella abilità al massimo.
      const profiles = [th, ...Object.keys(th).map((k) => ({ ...th, [k]: 99 }))];
      const offered = profiles.some((p) => {
        const skills = Object.fromEntries(
          Object.keys(start.player.skills).map((k) => [k, p[k] ?? 0]),
        ) as typeof start.player.skills;
        const { options } = availableOptions(
          m,
          t,
          { rootId: 'x', step: 2 },
          { ...start.player, skills },
          1,
          base,
        );
        return options.includes(t.options.indexOf(o));
      });
      expect(offered, o.id).toBe(true);
    }
  });
});

describe('rarità dei gesti da leggenda (config reale)', () => {
  const ROLES = ['GK', 'DEF', 'MID', 'ATT'] as const;
  it("legends appear in < 10% of full matches with player on pitch 90'", () => {
    const N = 2000;
    for (const role of ROLES) {
      const start = toFirstMatch(newCareer({ ...baseOptions, role, traits: [] }, 7, base), base);
      // Caso peggiore: abilità al massimo, così le soglie delle abilità non frenano.
      const skills = Object.fromEntries(
        Object.keys(start.player.skills).map((k) => [k, 99]),
      ) as typeof start.player.skills;
      let full = 0;
      let offered = 0;
      for (let i = 0; i < N; i++) {
        const s: GameState = {
          ...start,
          player: { ...start.player, skills },
          rngState: Rng.fromSeed(1000 + i).getState(),
        };
        let seen = false;
        // Decisore a caso: copre anche le scelte che prolungano le catene.
        const pick = Rng.fromSeed(5000 + i);
        const r = playMatch(
          s,
          (mo) => {
            if (mo.options.some((o) => o.legendId)) seen = true;
            return pick.int(0, mo.options.length - 1);
          },
          base,
        );
        if (r.matchReport.minutesPlayed < 90) continue;
        full++;
        if (seen) offered++;
      }
      expect(full).toBeGreaterThan(N / 2);
      expect(offered / full, `${role}: ${offered}/${full}`).toBeLessThan(0.1);
    }
  }, 120_000);
});
