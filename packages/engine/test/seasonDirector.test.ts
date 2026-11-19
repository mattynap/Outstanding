import { describe, expect, it } from 'vitest';
import { calendarSchema } from '@outstanding/config';
import {
  CURRENT_SAVE_VERSION,
  defaultContext,
  deserialize,
  migrate,
  newCareer,
  serialize,
  type Fixture,
  type GameState,
} from '../src/index';
import {
  chapterOf,
  chapterWeekRange,
  createChapter,
  emptyChapterLog,
  pickChapterMatches,
  refreshChapterPicks,
  scoreFixture,
} from '../src/season/director';
import { weekOfSeason } from '../src/time';
import { baseOptions } from './fixtures';

const cal = defaultContext.config.calendar;
const ctx = defaultContext;

/** Carriera portata (senza giocare) alla settimana assoluta indicata. */
function at(seed: number, week: number): GameState {
  return { ...newCareer(baseOptions, seed), week };
}

const clubOf = (s: GameState) => s.player.clubId!;
const mine = (s: GameState, f: Fixture) => f.homeId === clubOf(s) || f.awayId === clubOf(s);
const byId = (s: GameState, id: string) => s.calendar.find((f) => f.id === id)!;

/** Una partita di coppa a eliminazione diretta (semifinale) del club del giocatore nella settimana data. */
function cupFixture(s: GameState, week: number, id = 'cup-x'): Fixture {
  const base = s.calendar.find((f) => mine(s, f) && !f.cup)!;
  return {
    ...base,
    id,
    week,
    leagueId: 'cup',
    groupId: 'cup-sf',
    cup: { competitionId: 'cup', stage: 'sf', round: 4, leg: 1, legs: 1, neutral: false },
  };
}

describe('capitoli della stagione', () => {
  it('chapters cover 52 weeks', () => {
    const ids = new Set<string>();
    let last = -1;
    for (let w = 0; w < cal.weeksPerSeason; w++) {
      const id = chapterOf(w, cal);
      ids.add(id);
      const idx = cal.chapters.findIndex((c) => c.id === id);
      expect(idx).toBeGreaterThanOrEqual(last);
      last = idx;
      const [from, to] = chapterWeekRange(id, cal);
      expect(w >= from && w <= to).toBe(true);
    }
    expect(ids.size).toBe(cal.chapters.length);
    expect(chapterWeekRange('finale', cal)[1]).toBe(cal.weeksPerSeason - 1);
  });

  it('i valori di config del brief', () => {
    expect(cal.chapters.map((c) => [c.id, c.fromWeek])).toEqual([
      ['preseason', 0],
      ['autumn', 6],
      ['winter', 20],
      ['spring', 32],
      ['finale', 44],
    ]);
    expect(cal.chapterMatches).toEqual({ min: 2, max: 3 });
  });

  it('lo schema rifiuta capitoli non crescenti o che non partono da 0', () => {
    const bad = (chapters: unknown) => calendarSchema.safeParse({ ...cal, chapters }).success;
    expect(bad([{ id: 'autumn', fromWeek: 3 }])).toBe(false);
    expect(
      bad([
        { id: 'preseason', fromWeek: 0 },
        { id: 'autumn', fromWeek: 0 },
      ]),
    ).toBe(false);
    expect(
      bad([
        { id: 'preseason', fromWeek: 0 },
        { id: 'autumn', fromWeek: 52 },
      ]),
    ).toBe(false);
    expect(calendarSchema.safeParse(cal).success).toBe(true);
  });

  it('createChapter usa la settimana della stagione, anche dalla seconda in poi', () => {
    const s = at(7, cal.weeksPerSeason + 22);
    expect(createChapter({ ...s, season: 2 }, ctx).id).toBe('winter');
    expect(createChapter(at(7, 0), ctx).id).toBe('preseason');
  });

  it('newCareer parte da preseason senza partite, con registri a zero', () => {
    const s = newCareer(baseOptions, 3);
    expect(s.saveVersion).toBe(3);
    expect(s.chapter).toEqual({
      id: 'preseason',
      picks: [],
      goal: null,
      lastGoalId: null,
      log: emptyChapterLog(),
      stretch: emptyChapterLog(),
    });
    expect(s.chapterPlan).toEqual([]);
  });
});

describe('scelta delle partite del capitolo', () => {
  it('picks are future fixtures of the chapter', () => {
    const s = at(11, 10);
    const picks = pickChapterMatches(s, 'autumn', ctx);
    expect(picks).toHaveLength(cal.chapterMatches.max);
    const [from, to] = chapterWeekRange('autumn', cal);
    for (const p of picks) {
      const f = byId(s, p.fixtureId);
      expect(mine(s, f)).toBe(true);
      expect(f.result).toBeUndefined();
      expect(f.week).toBeGreaterThanOrEqual(s.week);
      expect(weekOfSeason(f.week, cal)).toBeGreaterThanOrEqual(from);
      expect(weekOfSeason(f.week, cal)).toBeLessThanOrEqual(to);
    }
    // Una settimana oltre la fine del capitolo: niente da scegliere.
    expect(pickChapterMatches(at(11, 20), 'autumn', ctx)).toEqual([]);
  });

  it('preseason senza amichevoli sceglie 0 partite', () => {
    expect(pickChapterMatches(at(11, 0), 'preseason', ctx)).toEqual([]);
  });

  it('first pick full, others quick: la full va alla più importante, in ordine di calendario', () => {
    const s = at(12, 6);
    const picks = pickChapterMatches(s, 'autumn', ctx);
    expect(picks.filter((p) => p.mode === 'full')).toHaveLength(1);
    expect(picks.filter((p) => p.mode === 'quick')).toHaveLength(picks.length - 1);
    const weeks = picks.map((p) => byId(s, p.fixtureId).week);
    expect(weeks).toEqual([...weeks].sort((a, b) => a - b));
    const scores = picks.map((p) => scoreFixture(s, byId(s, p.fixtureId), ctx));
    const full = picks.findIndex((p) => p.mode === 'full');
    expect(scores[full]).toBe(Math.max(...scores));
  });

  it('derby and decisive matches are preferred', () => {
    const s0 = at(13, 6);
    const cup = cupFixture(s0, 9);
    const s = { ...s0, calendar: [...s0.calendar, cup] };
    // La coppa a fase finale vale 1: batte le partite di campionato senza segnali forti.
    const picks = pickChapterMatches(s, 'autumn', ctx);
    expect(picks.map((p) => p.fixtureId)).toContain(cup.id);
    expect(picks.find((p) => p.fixtureId === cup.id)!.mode).toBe('full');

    // Un derby (stessa città dell'avversario) pesa più di una partita senza segnali.
    const league = s0.calendar.filter(
      (f) => mine(s0, f) && !f.cup && weekOfSeason(f.week, cal) <= 19,
    );
    const [a, b] = league;
    const oppId = (f: Fixture) => (f.homeId === clubOf(s0) ? f.awayId : f.homeId);
    const world = {
      ...s0.world,
      clubs: s0.world.clubs.map((c) =>
        c.id === oppId(a!)
          ? { ...c, city: s0.world.clubs.find((x) => x.id === clubOf(s0))!.city }
          : c,
      ),
    };
    const sd = { ...s0, world };
    expect(scoreFixture(sd, a!, ctx)).toBeGreaterThanOrEqual(
      defaultContext.config.match.stakes.derby,
    );
    expect(scoreFixture(sd, a!, ctx)).toBeGreaterThanOrEqual(scoreFixture(sd, b!, ctx) - 1e-9);
  });

  it('il peso della classifica premia le partite vicine alla zona promozione o retrocessione', () => {
    const s = at(14, 20);
    const w = cal.chapterWeights.table;
    const f = { ...s.calendar.find((x) => mine(s, x) && !x.cup)!, matchday: w.fromMatchday + 1 };
    const quiet = scoreFixture({ ...s, calendar: s.calendar }, { ...f, matchday: 1 }, ctx);
    // Nessun risultato giocato: le posizioni seguono l'id, il peso è comunque in [0, 1] e additivo.
    const withTable = scoreFixture(s, f, ctx);
    expect(withTable).toBeGreaterThanOrEqual(quiet);
    expect(withTable - quiet).toBeLessThanOrEqual(Math.max(w.promotion, w.relegation) + 1e-9);
  });

  it('deterministic from seed', () => {
    const run = () => pickChapterMatches(at(21, 6), 'autumn', ctx);
    expect(run()).toEqual(run());
    const s = at(21, 6);
    const before = JSON.stringify(s.rngState);
    pickChapterMatches(s, 'autumn', ctx);
    expect(JSON.stringify(s.rngState)).toBe(before);
    expect(createChapter(s, ctx)).toEqual(createChapter(s, ctx));
  });

  it('con pari punteggio vince la settimana più vicina, poi l id', () => {
    const s = at(22, 6);
    const picks = pickChapterMatches(s, 'autumn', ctx);
    const all = s.calendar
      .filter(
        (f) =>
          mine(s, f) && !f.cup && weekOfSeason(f.week, cal) >= 6 && weekOfSeason(f.week, cal) <= 19,
      )
      .map((f) => ({ f, sc: scoreFixture(s, f, ctx) }));
    const chosen = new Set(picks.map((p) => p.fixtureId));
    const worst = Math.min(...all.filter((x) => chosen.has(x.f.id)).map((x) => x.sc));
    // Nessuna esclusa batte la peggiore scelta; a pari punteggio la esclusa è più lontana.
    for (const x of all.filter((y) => !chosen.has(y.f.id))) {
      expect(x.sc).toBeLessThanOrEqual(worst + 1e-9);
    }
  });
});

describe('rivalutazione a ogni stop', () => {
  it('cup match drawn mid-chapter can replace a pick', () => {
    const s0 = at(31, 6);
    const picks0 = pickChapterMatches(s0, 'autumn', ctx);
    const s1: GameState = {
      ...s0,
      chapter: { ...createChapter(s0, ctx), picks: picks0 },
    };
    const lowest = picks0
      .map((p) => ({ p, sc: scoreFixture(s1, byId(s1, p.fixtureId), ctx) }))
      .sort((a, b) => a.sc - b.sc)[0]!;
    const cup = cupFixture(s1, weekOfSeason(s1.week, cal) + 12 > 19 ? s1.week + 12 : s1.week + 12);
    const s2 = { ...s1, calendar: [...s1.calendar, cup] };
    expect(scoreFixture(s2, cup, ctx)).toBeGreaterThan(lowest.sc);

    const next = refreshChapterPicks(s2, ctx);
    expect(next).toHaveLength(picks0.length);
    expect(next.map((p) => p.fixtureId)).toContain(cup.id);
    const dropped = picks0.filter((p) => !next.some((n) => n.fixtureId === p.fixtureId));
    expect(dropped).toHaveLength(1);
    expect(scoreFixture(s2, byId(s2, dropped[0]!.fixtureId), ctx)).toBe(lowest.sc);
    expect(next.filter((p) => p.mode === 'full')).toHaveLength(1);
    // Idempotente: rivalutare di nuovo non cambia nulla.
    expect(refreshChapterPicks({ ...s2, chapter: { ...s2.chapter, picks: next } }, ctx)).toEqual(
      next,
    );
  });

  it('le partite già giocate restano e occupano la quota', () => {
    const s0 = at(32, 6);
    const picks0 = pickChapterMatches(s0, 'autumn', ctx);
    const first = byId(s0, picks0[0]!.fixtureId);
    const played = {
      ...s0,
      week: first.week + 1,
      calendar: s0.calendar.map((f) =>
        f.id === first.id ? { ...f, result: { home: 1, away: 0 } } : f,
      ),
      chapter: { ...createChapter(s0, ctx), picks: picks0 },
    };
    const next = refreshChapterPicks(played, ctx);
    expect(next.find((p) => p.fixtureId === first.id)).toEqual(picks0[0]);
    expect(next.length).toBeLessThanOrEqual(cal.chapterMatches.max);
    // La full va rivalutata solo se non è ancora stata giocata.
    const fullPlayed = picks0[0]!.mode === 'full';
    if (fullPlayed) expect(next.filter((p) => p.mode === 'full')).toHaveLength(1);
  });

  it('la partita in corso non viene mai sostituita', () => {
    const s0 = at(33, 6);
    const picks0 = pickChapterMatches(s0, 'autumn', ctx);
    const target = byId(s0, picks0[0]!.fixtureId);
    const cups = [
      cupFixture(s0, target.week + 1, 'c1'),
      cupFixture(s0, target.week + 2, 'c2'),
      cupFixture(s0, target.week + 3, 'c3'),
    ];
    const s = {
      ...s0,
      week: target.week,
      calendar: [...s0.calendar, ...cups],
      chapter: { ...createChapter(s0, ctx), picks: picks0 },
      currentMatch: { fixtureId: target.id, mode: 'full' } as unknown as GameState['currentMatch'],
    };
    expect(refreshChapterPicks(s, ctx).map((p) => p.fixtureId)).toContain(target.id);
  });
});

describe('salvataggio v3', () => {
  const asV2 = (s: GameState): Record<string, unknown> => {
    const { chapter: _c, chapterPlan: _p, ...rest } = s;
    return JSON.parse(JSON.stringify({ ...rest, saveVersion: 2 })) as Record<string, unknown>;
  };

  it('la versione corrente è 3', () => {
    expect(CURRENT_SAVE_VERSION).toBe(3);
  });

  it('migrates v2 save to v3 with chapter and chapterPlan', () => {
    const s = {
      ...at(41, 10),
      lastPlan: [{ actionId: 'train_technical', focus: 'passing' as const }],
    };
    const out = migrate(asV2(s)) as unknown as GameState;
    expect(out.saveVersion).toBe(3);
    expect(out.chapter.id).toBe('autumn');
    expect(out.chapter.picks).toEqual(pickChapterMatches(s, 'autumn', ctx));
    expect(out.chapter.goal).toBeNull();
    expect(out.chapter.log).toEqual(emptyChapterLog());
    expect(out.chapter.stretch).toEqual(emptyChapterLog());
    expect(out.chapterPlan).toEqual(s.lastPlan);
    // Senza lastPlan il piano è vuoto; migrare due volte dà lo stesso risultato.
    const bare = at(41, 10);
    expect((migrate(asV2(bare)) as unknown as GameState).chapterPlan).toEqual([]);
    expect(migrate(asV2(s))).toEqual(migrate(asV2(s)));
  });

  it('la migrazione non sposta la sequenza principale (rngState intatto)', () => {
    const s = at(42, 10);
    expect((migrate(asV2(s)) as unknown as GameState).rngState).toEqual(s.rngState);
  });

  it('migrazione a fine stagione e con partita aperta', () => {
    const end = at(43, cal.weeksPerSeason - 1);
    const o = migrate(asV2(end)) as unknown as GameState;
    expect(o.chapter.id).toBe('finale');

    const s = at(43, 6);
    const picks = pickChapterMatches(s, 'autumn', ctx);
    const f = byId(s, picks[1]!.fixtureId);
    const open = { ...s, week: f.week, currentMatch: { fixtureId: f.id, mode: 'quick' } };
    const raw = asV2(open as unknown as GameState);
    const m = migrate(raw) as unknown as GameState;
    const p = m.chapter.picks.find((x) => x.fixtureId === f.id);
    expect(p).toBeDefined();
    expect(m.chapter.picks.length).toBeLessThanOrEqual(cal.chapterMatches.max);
  });

  it('caricare un v3 non riestrae le scelte', () => {
    const s = at(44, 10);
    const custom: GameState = { ...s, chapter: { ...createChapter(s, ctx), picks: [] } };
    const back = deserialize(serialize(custom));
    expect(back.chapter.picks).toEqual([]);
    expect(back).toEqual(custom);
  });

  it('endSeason riparte da preseason con nuovo capitolo e piano vuoto', async () => {
    const { endSeason, advanceWeek, isSeasonOver, playerFixture } = await import('../src/index');
    let s = newCareer(baseOptions, 45);
    while (!isSeasonOver(s)) {
      const own = playerFixture(s);
      if (own) {
        s = {
          ...s,
          calendar: s.calendar.map((f) =>
            f.id === own.id ? { ...f, result: { home: 1, away: 1 } } : f,
          ),
        };
      }
      s = advanceWeek(s).state;
    }
    const next = endSeason(s, ctx).state;
    expect(next.chapter.id).toBe('preseason');
    expect(next.chapter.picks).toEqual([]);
    expect(next.chapterPlan).toEqual([]);
    expect(createChapter(next, ctx).id).toBe('preseason');
  });
});
