import { describe, expect, it } from 'vitest';
import {
  advanceToStop,
  defaultContext,
  deserialize,
  endSeason,
  migrate,
  newCareer,
  prudentChoice,
  resolveEvent,
  serialize,
  setChapterPlan,
  simulateMatch,
  CURRENT_SAVE_VERSION,
  type FastForwardReport,
  type GameState,
} from '../src/index';
import { getEvent } from '../src/events/events';
import { Rng } from '../src/rng';
import {
  evaluateChapterGoal,
  pickChapterGoal,
  settleChapter,
  chapterGoalDef,
} from '../src/season/goals';
import { getClub } from '../src/world/queries';
import { baseOptions } from './fixtures';

const ctx = defaultContext;
const cfg = ctx.config.calendar.chapterGoals;

interface Stop {
  state: GameState;
  report: FastForwardReport;
}

/** Guida una stagione con advanceToStop e restituisce lo stato a ogni stop di capitolo e di fine stagione. */
function driveSeason(seed: number, role: 'ATT' | 'GK' | 'DEF' | 'MID' = 'ATT'): Stop[] {
  let s = setChapterPlan(
    newCareer({ ...baseOptions, role, traits: [] }, seed),
    { load: 'balanced' },
    ctx,
  );
  const out: Stop[] = [];
  for (let i = 0; i < 300; i++) {
    const r = advanceToStop(s, ctx);
    s = r.state;
    if (r.report.stop === 'chapterEnd' || r.report.stop === 'seasonEnd') {
      out.push({ state: s, report: r.report });
    }
    if (r.report.stop === 'seasonEnd' || r.report.stop === 'retired') break;
    if (r.report.stop === 'pick') s = simulateMatch(s, ctx).state;
    if (r.report.stop === 'news') {
      for (const pe of [...s.pendingEvents]) {
        s = resolveEvent(s, pe.eventId, prudentChoice(getEvent(pe.eventId, ctx), s), ctx).state;
      }
    }
  }
  return out;
}

const coachRel = (s: GameState) =>
  s.player.relationships[getClub(s.world, s.player.clubId!).coachId] ?? 0;

/** Stato con un obiettivo su `starts` già raggiunto o no, morale a metà. */
function withGoal(met: boolean): GameState {
  const base = newCareer(baseOptions, 6);
  return {
    ...base,
    player: { ...base.player, condition: { ...base.player.condition, morale: 50 } },
    chapter: {
      ...base.chapter,
      id: 'autumn',
      goal: { id: 'presenza_costante', target: 7, settled: false },
      log: { ...base.chapter.log, starts: met ? 7 : 6 },
    },
  };
}

describe('obiettivo del capitolo', () => {
  it('preseason has no goal', () => {
    const s = newCareer(baseOptions, 6);
    expect(s.chapter.id).toBe('preseason');
    expect(s.chapter.goal).toBeNull();
    const seasons = driveSeason(6);
    const end = endSeason(seasons[seasons.length - 1]!.state, ctx).state;
    expect(end.chapter.id).toBe('preseason');
    expect(end.chapter.goal).toBeNull();
    const rng = Rng.fromState(s.rngState);
    expect(pickChapterGoal(s, 'preseason', rng, ctx)).toBeNull();
    expect(rng.getState()).toEqual(s.rngState);
  });

  it('goal picked at chapter start and not repeated', () => {
    for (const seed of [1, 6, 9]) {
      const stops = driveSeason(seed).filter((x) => x.report.stop === 'chapterEnd');
      expect(stops.length).toBeGreaterThanOrEqual(3);
      let before: string | null = null;
      for (const { state } of stops) {
        expect(state.chapter.goal).not.toBeNull();
        expect(state.chapter.goal!.settled).toBe(false);
        expect(state.chapter.goal!.id).not.toBe(before);
        expect(state.chapter.lastGoalId).toBe(before);
        before = state.chapter.goal!.id;
      }
    }
  });

  it('conditions filter by role', () => {
    const gk = newCareer({ ...baseOptions, role: 'GK', traits: [] }, 3);
    const ids = new Set<string>();
    for (let seed = 1; seed < 80; seed++) {
      const g = pickChapterGoal(gk, 'autumn', Rng.fromSeed(seed), ctx);
      expect(g).not.toBeNull();
      expect(['goals', 'assists']).not.toContain(g!.metric);
      ids.add(g!.id);
    }
    expect(ids.size).toBeGreaterThan(1);
  });

  it('never repeats the previous goal and returns null with nothing eligible', () => {
    const s = newCareer(baseOptions, 3);
    const only = {
      ...ctx,
      content: { ...ctx.content, chapterGoals: [ctx.content.chapterGoals[1]!] },
    };
    const last = only.content.chapterGoals[0]!.id;
    const again = { ...s, chapter: { ...s.chapter, lastGoalId: last } };
    expect(pickChapterGoal(again, 'autumn', Rng.fromSeed(1), only)).toBeNull();
  });

  it('met goal applies rewards', () => {
    const s = withGoal(true);
    const { state, headline } = settleChapter(s, ctx);
    expect(state.chapter.goal!.settled).toBe(true);
    expect(coachRel(state)).toBe(coachRel(s) + cfg.rewardTrust);
    expect(state.player.condition.morale).toBe(50 + cfg.rewardMorale);
    expect(headline?.kind).toBe('event');
    expect(headline?.textKey).toBe('chapterGoals.presenza_costante.met');
    expect(state.goalRecords).toEqual([
      ...(s.goalRecords ?? []),
      {
        season: s.season,
        chapter: s.chapter.id,
        goalId: 'presenza_costante',
        target: s.chapter.goal!.target,
        met: true,
      },
    ]);
  });

  it('missed goal applies only missMorale', () => {
    const s = withGoal(false);
    const { state, headline } = settleChapter(s, ctx);
    expect(coachRel(state)).toBe(coachRel(s));
    expect(state.player.condition.morale).toBe(50 + cfg.missMorale);
    expect(headline?.textKey).toBe('chapterGoals.presenza_costante.missed');
    expect(state.goalRecords?.at(-1)?.met).toBe(false);
  });

  it('settling twice changes nothing', () => {
    const once = settleChapter(withGoal(true), ctx).state;
    const twice = settleChapter(once, ctx);
    expect(twice.state).toEqual(once);
    expect(twice.headline).toBeNull();
  });

  it('evaluates each metric from the chapter log', () => {
    const s = withGoal(true);
    const at = (id: string, log: Partial<GameState['chapter']['log']>) =>
      evaluateChapterGoal(
        {
          ...s,
          chapter: {
            ...s.chapter,
            goal: { id, target: chapterGoalDef(id, ctx).target, settled: false },
            log: { ...s.chapter.log, ...log },
          },
        },
        ctx,
      );
    expect(at('attaccante_gol', { goals: 2 })).toEqual({ met: false, progress: 2 });
    expect(at('attaccante_gol', { goals: 3 }).met).toBe(true);
    expect(at('centrocampista_ultimo_passaggio', { assists: 2 }).met).toBe(true);
    expect(at('difensore_porte_inviolate', { cleanSheets: 2 }).met).toBe(true);
    expect(at('punta_gol_partita_scelta', { pickedGoals: 1 }).met).toBe(true);
    // Senza voti la media non è raggiunta; con i voti è somma / numero.
    expect(at('pagella_senza_strappi', {}).met).toBe(false);
    expect(at('pagella_senza_strappi', { ratingSum: 13, ratingCount: 2 })).toEqual({
      met: true,
      progress: 6.5,
    });
    expect(at('pagella_senza_strappi', { ratingSum: 12, ratingCount: 2 }).met).toBe(false);
  });

  it('prints the rating target with a decimal comma', () => {
    const s = withGoal(true);
    const rated = {
      ...s,
      chapter: { ...s.chapter, goal: { id: 'pagella_giovane', target: 6, settled: false } },
    };
    expect(settleChapter(rated, ctx).headline?.params.target).toBe('6,0');
    const starts = {
      ...s,
      chapter: { ...s.chapter, goal: { id: 'presenza_costante', target: 7, settled: false } },
    };
    expect(settleChapter(starts, ctx).headline?.params.target).toBe('7');
  });

  it('table goal uses the position and is never met without a club', () => {
    const s = withGoal(true);
    const goal = { id: 'classifica_meta_classifica', target: 10, settled: false };
    const noClub = {
      ...s,
      player: { ...s.player, clubId: undefined },
      chapter: { ...s.chapter, goal },
    };
    expect(evaluateChapterGoal(noClub, ctx)).toEqual({ met: false, progress: 0 });
    const withClub = { ...s, chapter: { ...s.chapter, goal } };
    const r = evaluateChapterGoal(withClub, ctx);
    expect(r.progress).toBeGreaterThanOrEqual(1);
    expect(r.met).toBe(r.progress <= 10);
  });

  it('goal result appears in headlines', () => {
    const ends = driveSeason(6).filter((x) => x.report.stop === 'chapterEnd');
    // Dal secondo cambio di capitolo c'è un obiettivo da liquidare.
    const second = ends[1]!;
    const h = second.report.headlines.find((x) => x.textKey.startsWith('chapterGoals.'));
    expect(h?.kind).toBe('event');
    expect(h?.textKey).toMatch(/\.(met|missed)$/);
    expect(second.report.headlines.length).toBeLessThanOrEqual(ctx.config.calendar.headlines.max);
  });

  it('deterministic from seed', () => {
    const a = driveSeason(9).map((x) => [
      x.state.chapter.goal,
      x.state.rngState,
      x.report.headlines,
    ]);
    const b = driveSeason(9).map((x) => [
      x.state.chapter.goal,
      x.state.rngState,
      x.report.headlines,
    ]);
    expect(a).toEqual(b);
  });

  it('migration adds goal null', () => {
    const v3 = newCareer(baseOptions, 6);
    const raw = JSON.parse(JSON.stringify(v3)) as Record<string, unknown>;
    raw['saveVersion'] = 2;
    delete raw['chapter'];
    delete raw['chapterPlan'];
    const m = migrate(raw, CURRENT_SAVE_VERSION) as unknown as GameState;
    expect(m.chapter.goal).toBeNull();
    expect(m.chapter.lastGoalId).toBeNull();
  });

  it('resume mid-chapter keeps progress', () => {
    const s = withGoal(true);
    const back = deserialize(serialize(s));
    expect(back.chapter.goal).toEqual(s.chapter.goal);
    expect(evaluateChapterGoal(back, ctx)).toEqual(evaluateChapterGoal(s, ctx));
  });

  it('goal settled once even if season ends in the same week', () => {
    const last = driveSeason(6).at(-1)!;
    expect(last.report.stop).toBe('seasonEnd');
    // Fine stagione: l'obiettivo del finale è già liquidato e il titolo è nel report dello stop.
    expect(last.state.chapter.goal?.settled).toBe(true);
    expect(last.report.headlines.some((h) => h.textKey.startsWith('chapterGoals.'))).toBe(true);
    // Un secondo passaggio da endSeason non applica ricompense in più.
    const pending = (settled: boolean): GameState => ({
      ...last.state,
      player: {
        ...last.state.player,
        condition: { ...last.state.player.condition, morale: 50 },
      },
      chapter: {
        ...last.state.chapter,
        goal: { id: 'presenza_costante', target: 1, settled },
        log: { ...last.state.chapter.log, starts: 1 },
      },
    });
    const viaEnd = endSeason(pending(false), ctx);
    const done = endSeason(pending(true), ctx);
    const before = settleChapter(pending(false), ctx).state;
    const viaBoth = endSeason(before, ctx);
    expect(viaEnd.state.player.condition.morale - done.state.player.condition.morale).toBe(
      cfg.rewardMorale,
    );
    expect(viaBoth.state.player.condition.morale).toBe(viaEnd.state.player.condition.morale);
    expect(viaEnd.seasonReport.headlines.some((h) => h.textKey.endsWith('.met'))).toBe(true);
    expect(done.seasonReport.headlines).toEqual([]);
  });

  it('all goals have valid text and a known metric', () => {
    const t = ctx.content.i18n.it;
    for (const g of ctx.content.chapterGoals) {
      for (const k of [
        g.textKey,
        g.textKey.replace('.text', '.met'),
        g.textKey.replace('.text', '.missed'),
      ]) {
        expect(t[k], k).toBeTruthy();
      }
    }
    const goals = ctx.content.chapterGoals;
    expect(new Set(goals.map((g) => g.id)).size).toBe(goals.length);
    for (const role of ['GK', 'DEF', 'MID', 'ATT'] as const) {
      const some = goals.some((g) => !g.conditions?.roles || g.conditions.roles.includes(role));
      expect(some, role).toBe(true);
    }
  });
});
