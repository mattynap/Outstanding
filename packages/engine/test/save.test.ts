import { describe, expect, it } from 'vitest';
import {
  CURRENT_SAVE_VERSION,
  defaultContext,
  deserialize,
  migrate,
  advanceWeek,
  beginMatch,
  newCareer,
  playerFixture,
  playMatch,
  simulateMatch,
  serialize,
  type GameState,
} from '../src/index';
import fixture from './fixtures/save-v1-midmatch.json';
import v3Plans from './fixtures/save-v3-plans.json';
import v3InjuredParty from './fixtures/save-v3-injured-party.json';
import { baseOptions } from './fixtures';
import { planWeek, repeatPlan } from '../src/index';

type Raw = Record<string, unknown>;
const v1 = (): Raw => JSON.parse(JSON.stringify(fixture)) as Raw;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = Record<string, any>;
const matchOf = (raw: Raw) => raw['currentMatch'] as Loose;

/** Fixture v1 senza momento in attesa: tre blocchi giocati, resta un momento da fare. */
function withoutPending(): Raw {
  const raw = v1();
  const m = matchOf(raw);
  m['pending'] = null;
  m['blocksDone'] = 3;
  m['momentMinutes'] = [55];
  m['score'] = { home: 2, away: 2 };
  return raw;
}

describe('migrazione dei salvataggi v1 -> v2', () => {
  it('la versione corrente è 4', () => {
    expect(CURRENT_SAVE_VERSION).toBe(4);
  });

  it('migrates v1 save without match', () => {
    const out = migrate({ saveVersion: 1, week: 3 }, 2);
    expect(out).toEqual({ saveVersion: 2, week: 3 });
  });

  it('i momenti del fixture esistono nella config', () => {
    const ids = defaultContext.config.match.moments.types.map((t) => t.id);
    const m = matchOf(v1());
    expect(ids).toContain(m['pending'].momentId);
    for (const e of m['events']) if (e.kind === 'moment') expect(ids).toContain(e.momentId);
  });

  it('migrates v1 mid-match without pending: minute = blocksDone·15', () => {
    const m = matchOf(migrate(withoutPending(), 2));
    expect(m['minute']).toBe(45);
    expect(m['blocksDone']).toBeUndefined();
    expect(m['momentMinutes']).toBeUndefined();
    expect(m['pending']).toBeNull();
    expect(m['score']).toEqual({ home: 2, away: 2 });
    expect(m['trace']).toHaveLength(45);
  });

  it('limita a 90 il minuto di un salvataggio a fine partita', () => {
    const raw = withoutPending();
    matchOf(raw)['blocksDone'] = 7;
    expect(matchOf(migrate(raw, 2))['minute']).toBe(90);
  });

  it('migrates v1 mid-match with pending: minute = pending.minute, goals after it removed and score recomputed', () => {
    const m = matchOf(migrate(v1(), 2));
    expect(m['minute']).toBe(28);
    const goals = m['events'].filter((e: { kind: string }) => e.kind === 'goal');
    expect(goals.map((g: { minute: number }) => g.minute)).toEqual([10, 25, 28]);
    expect(m['score']).toEqual({ home: 2, away: 1 });
    expect(m['trace']).toHaveLength(28);
    expect(m['goals']).toBe(0);
    expect(m['ratingDelta']).toBe(0.5);
  });

  it('rifiuta di togliere un gol del giocatore', () => {
    const raw = v1();
    matchOf(raw)['events'].push({
      kind: 'goal',
      minute: 29,
      side: 'home',
      scorerName: 'Io',
      byPlayer: true,
      assistByPlayer: false,
    });
    expect(() => migrate(raw, 2)).toThrow(/goal/);
  });

  it('budgetLeft = momentMinutes.length (the pending moment is already spent)', () => {
    const m = matchOf(migrate(v1(), 2));
    const d = m['director'];
    expect(d.budgetLeft).toBe(2);
    expect(d.interventions).toBe(2); // un momento già giocato più quello in attesa
    expect(d.budgetStart).toBe(4);
    expect(d.lastAt).toBe(28);
    expect(d.lastTypes).toEqual(['att_box_chance', 'att_counter']);
    expect(d).not.toHaveProperty('plannedMinutes');
    expect(d.hotLeft).toBeNull();
    expect(d.armed).toBeNull();
    expect(d.relaxUntil).toBeNull();
    expect(d.legendsUsed).toBe(0);
    expect(d.peak).toBeNull();
  });

  it('senza pending: lastAt è il minuto dell ultimo momento giocato', () => {
    const d = matchOf(migrate(withoutPending(), 2))['director'];
    expect(d.budgetLeft).toBe(1);
    expect(d.interventions).toBe(1);
    expect(d.budgetStart).toBe(2);
    expect(d.lastAt).toBe(12);
    expect(d.lastTypes).toEqual(['att_box_chance']);
  });

  it('pressure 0, trace [], dyn zero, pending kept', () => {
    const m = matchOf(migrate(v1(), 2));
    expect(m['pressure']).toBe(0);
    expect(m['mode']).toBe('full');
    expect(m['stakes']).toBe(0);
    expect(m['legend']).toBeNull();
    expect(m['dyn']).toEqual({ coachTrust: 0, nerves: 0, fatigue: 0, marking: 0 });
    const n = defaultContext.config.match.moments.types.find((t) => t.id === 'att_counter')!.options
      .length;
    expect(m['pending']).toEqual({
      momentId: 'att_counter',
      minute: 28,
      textVariant: 2,
      options: Array.from({ length: n }, (_, i) => i),
    });
    expect(
      matchOf(migrate(v1(), 2))['events'].find((e: Loose) => e.kind === 'moment').quality,
    ).toBe(0.5);
    expect(matchOf(migrate(v1(), 2))['events'].some((e: Loose) => e.kind === 'subIn')).toBe(true);
  });

  it('un salvataggio migrato passa la deserializzazione', () => {
    const base = JSON.parse(serialize(newCareer(baseOptions, 5))) as Raw;
    const raw = { ...base, saveVersion: 1, currentMatch: matchOf(v1()) };
    const s = deserialize(JSON.stringify(raw));
    expect(s.saveVersion).toBe(4);
    expect(s.chapterPlan).toBeNull();
    expect(s.player.condition).not.toHaveProperty('injuryRisk');
    expect(s.currentMatch?.minute).toBe(28);
  });
});

describe('ripresa di una partita migrata', () => {
  it('playMatch riprende da minute senza momento aperto, in modo deterministico', () => {
    let s = newCareer(baseOptions, 5);
    while (!playerFixture(s)) s = advanceWeek(s).state;
    const paused = beginMatch(s).state;
    const cm = paused.currentMatch!;
    // Equivale a un salvataggio v1 migrato senza momento aperto.
    const migrated = {
      ...paused,
      currentMatch: { ...cm, pending: null },
    };
    const first = playMatch(migrated, () => 0);
    const again = playMatch(migrated, () => 0);
    expect(first.matchReport.fixtureId).toBe(cm.fixtureId);
    expect(again).toEqual(first);
  });
});

describe('ripresa v1 a budget esaurito', () => {
  it('un momento in attesa con catena e nessun momento pianificato si gioca fino in fondo', () => {
    let st = newCareer(baseOptions, 5);
    while (!playerFixture(st)) st = advanceWeek(st).state;
    const cm = beginMatch(st).state.currentMatch as unknown as Loose;
    const m = {
      fixtureId: cm['fixtureId'],
      side: cm['side'],
      opponentId: cm['opponentId'],
      selection: cm['selection'],
      minuteIn: 0,
      minuteOut: 90,
      blocksDone: 2,
      score: { home: 0, away: 0 },
      events: [],
      momentMinutes: [],
      pending: { momentId: 'att_counter', minute: 28, textVariant: 0 },
      ratingDelta: 0,
      goals: 0,
      assists: 0,
    };
    const base = JSON.parse(serialize({ ...st, currentMatch: undefined })) as Raw;
    const migrated = deserialize(JSON.stringify({ ...base, saveVersion: 1, currentMatch: m }));
    expect(migrated.currentMatch!.director.budgetLeft).toBeGreaterThanOrEqual(2);
    // Sceglie le opzioni che aprono un seguito (id delle catene), altrimenti la prima.
    const chainy = (mo: { options: { id: string }[] }) =>
      Math.max(
        0,
        mo.options.findIndex((o) =>
          ['aspetta_compagni', 'dribbling', 'cross_teso', 'cross'].includes(o.id),
        ),
      );
    for (let seed = 1; seed <= 40; seed++) {
      const s = {
        ...migrated,
        rngState: [seed, seed + 1, seed + 2, seed + 3] as unknown as GameState['rngState'],
      };
      expect(() => playMatch(s, (mo) => chainy(mo))).not.toThrow();
    }
  });
});

describe('validazione del regista', () => {
  const load = (edit: (m: Loose) => void) => {
    const base = JSON.parse(serialize(newCareer(baseOptions, 5))) as Raw;
    const migrated = migrate({ ...base, saveVersion: 1, currentMatch: matchOf(v1()) }, 2);
    edit(matchOf(migrated));
    return () => deserialize(JSON.stringify(migrated));
  };
  it('accetta il salvataggio migrato intatto', () => {
    expect(load(() => {})).not.toThrow();
  });
  it.each(['lastTypes', 'budgetStart', 'interventions', 'legendsUsed', 'armed', 'peak', 'hotLeft'])(
    'rifiuta director senza %s',
    (field) => {
      expect(load((m) => delete m['director'][field])).toThrow(/currentMatch/);
    },
  );
  it('valida la forma di armed', () => {
    expect(
      load((m) => (m['director']['armed'] = { at: 30, momentId: 'att_counter' })),
    ).not.toThrow();
    expect(
      load((m) => (m['director']['armed'] = { at: 30, momentId: 'att_counter', forced: true })),
    ).not.toThrow();
    expect(load((m) => (m['director']['armed'] = { at: '30', momentId: 'x' }))).toThrow(
      /currentMatch/,
    );
    expect(load((m) => (m['director']['armed'] = { at: 30, momentId: 'x', forced: 1 }))).toThrow(
      /currentMatch/,
    );
  });
  it('rifiuta lastTypes non di stringhe e options non array', () => {
    expect(load((m) => (m['director']['lastTypes'] = [1]))).toThrow(/currentMatch/);
    expect(load((m) => (m['pending']['options'] = 'x'))).toThrow(/currentMatch/);
  });
});

describe('salvataggio v2', () => {
  it('serialize→deserialize v2 is identity', () => {
    const s = newCareer(baseOptions, 7);
    expect(s.saveVersion).toBe(CURRENT_SAVE_VERSION);
    expect(deserialize(serialize(s))).toEqual(s);
  });

  it('rejects CURRENT_SAVE_VERSION + 1', () => {
    const s = newCareer(baseOptions, 7);
    const bad = serialize({ ...s, saveVersion: CURRENT_SAVE_VERSION + 1 } as GameState);
    expect(() => deserialize(bad)).toThrow(/newer/);
  });

  it('rifiuta una partita v2 con forma sbagliata', () => {
    const s = JSON.parse(serialize(newCareer(baseOptions, 7))) as Raw;
    s['currentMatch'] = { minute: 'x' };
    expect(() => deserialize(JSON.stringify(s))).toThrow(/currentMatch/);
  });

  it('keeps the chapter log and stretch after a played match', () => {
    let s: GameState = newCareer(baseOptions, 7);
    while (!playerFixture(s)) s = advanceWeek(s).state;
    s = simulateMatch(s).state;
    expect(s.chapter.log.lastResult).not.toBeNull();
    expect(s.chapter.stretch.lastResult).toEqual(s.chapter.log.lastResult);
    expect(deserialize(serialize(s))).toEqual(s);
  });
});

/** Riporta uno stato v4 alla forma v3: piano ad azioni, rischio infortuni, niente base di disciplina. */
function asV3(s: GameState, plan: unknown[] = []): Loose {
  const raw = JSON.parse(serialize(s)) as Loose;
  delete raw['seasonLoadWeeks'];
  delete raw['weekInProgress'];
  delete raw['player']['persona']['disciplineBase'];
  raw['player']['condition']['injuryRisk'] = 10;
  raw['saveVersion'] = 3;
  raw['chapterPlan'] = plan;
  if (plan.length > 0) raw['lastPlan'] = plan;
  else delete raw['lastPlan'];
  return raw;
}

const discMean = () => {
  const [a, b] = defaultContext.config.player.initial.persona.discipline;
  return (a + b) / 2;
};

describe('migrazione dei salvataggi v3 -> v4', () => {
  it.each(v3Plans.cases.map((c) => [JSON.stringify(c.plan), c] as const))(
    'piano %s',
    (_name, c) => {
      const out = migrate(asV3(newCareer(baseOptions, 5), c.plan)) as unknown as GameState;
      expect(out.saveVersion).toBe(4);
      expect(out.chapterPlan).toEqual(c.expected);
      if (c.expected) expect(out.lastPlan).toEqual(c.expected);
      else expect(out.lastPlan).toBeUndefined();
    },
  );

  it('toglie injuryRisk, fissa la base della disciplina e azzera le settimane di carico', () => {
    const s = newCareer(baseOptions, 5);
    const raw = asV3(s, [{ actionId: 'train_normal' }]);
    raw['player']['persona']['discipline'] = 30;
    const out = migrate(raw) as unknown as GameState;
    expect(out.player.condition).not.toHaveProperty('injuryRisk');
    expect(out.player.persona.disciplineBase).toBe(discMean());
    expect(out.player.persona.discipline).toBe(30);
    expect(out.seasonLoadWeeks).toEqual({ rest: 0, balanced: 0, push: 0 });
    // Sopra la media la base resta il valore attuale.
    const high = asV3(s);
    high['player']['persona']['discipline'] = 80;
    expect((migrate(high) as unknown as GameState).player.persona.disciplineBase).toBe(80);
  });

  it('non riapplica effetti: il giocatore è uguale campo per campo tranne i campi migrati', () => {
    let s = newCareer(baseOptions, 5);
    while (!playerFixture(s)) s = advanceWeek(s).state;
    s = simulateMatch(s).state;
    const raw = asV3({ ...s, plannedWeek: s.week }, [
      { actionId: 'train_intense' },
      { actionId: 'party' },
    ]);
    const out = deserialize(JSON.stringify(raw));
    expect(out.plannedWeek).toBe(s.week);
    expect(out.week).toBe(s.week);
    expect(out.rngState).toEqual(s.rngState);
    const { disciplineBase: _b, ...persona } = out.player.persona;
    const { disciplineBase: _o, ...origPersona } = s.player.persona;
    expect({ ...out.player, persona }).toEqual({ ...s.player, persona: origPersona });
  });

  it('il v1 arriva fino a v4 con la catena intera', () => {
    const raw = asV3(newCareer(baseOptions, 5));
    raw['saveVersion'] = 1;
    delete raw['chapter'];
    delete raw['chapterPlan'];
    raw['lastPlan'] = [{ actionId: 'train_focus', focus: 'pace' }];
    const out = deserialize(JSON.stringify(raw));
    expect(out.saveVersion).toBe(4);
    expect(out.chapterPlan).toEqual({ load: 'balanced', focus: 'pace' });
    expect(out.player.persona.disciplineBase).toBeGreaterThanOrEqual(discMean());
  });

  it('infortunato a metà capitolo con la serata: la serata resta nel piano e il recupero continua', () => {
    let s = newCareer(baseOptions, 5);
    for (let i = 0; i < 3; i++) {
      while (playerFixture(s)) s = simulateMatch(s).state;
      s = advanceWeek(s).state;
    }
    const raw = asV3({ ...s, plannedWeek: s.week });
    const fx = v3InjuredParty as Loose;
    raw['chapterPlan'] = fx['chapterPlan'];
    raw['lastPlan'] = fx['lastPlan'];
    raw['player'] = {
      ...raw['player'],
      condition: fx['player']['condition'],
      persona: fx['player']['persona'],
      injury: fx['player']['injury'],
    };
    const out = deserialize(JSON.stringify(raw));
    expect(out.chapterPlan).toEqual({ load: 'balanced', life: 'party' });
    expect(out.plannedWeek).toBe(s.week);
    // Nessun effetto riapplicato: freschezza, infortunio e disciplina come nel salvataggio.
    expect(out.player.condition).toEqual({ form: 44, energy: 63, morale: 51 });
    expect(out.player.injury).toEqual({ type: 'stiramento', weeksLeft: 3 });
    expect(out.player.persona.discipline).toBe(30);
    expect(out.player.persona.disciplineBase).toBe(discMean());
    // La settimana migrata è già pianificata; quella dopo ripete davvero la serata, in recupero.
    expect(() => planWeek(out, repeatPlan(out))).toThrow(/already/);
    let next = out;
    while (playerFixture(next)) next = simulateMatch(next).state;
    next = advanceWeek(next).state;
    const week = planWeek(next, repeatPlan(next));
    expect(week.report.effectiveLoad).toBe('recovery');
    expect(week.report.plan.life).toBe('party');
    expect(week.report.party).toBeDefined();
  });
});
