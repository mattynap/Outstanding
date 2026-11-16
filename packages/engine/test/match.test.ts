import { describe, expect, it } from 'vitest';
import {
  advanceWeek,
  autoDecider,
  beginMatch,
  decideMoment,
  defaultContext,
  deserialize,
  getPendingMoment,
  isSeasonOver,
  newCareer,
  optionChance,
  playerFixture,
  playMatch,
  serialize,
  simulateMatch,
  type GameState,
  type KeyMomentDecider,
  type MatchReport,
} from '../src/index';
import { baseOptions } from './fixtures';

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
      for (const o of type.options) need(`match.moments.${type.id}.options.${o.id}`);
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

describe('partita simulata', () => {
  it("sceglie sempre l'opzione più probabile", () => {
    const moment = {
      momentId: 'x',
      minute: 10,
      textKey: 'k',
      params: {},
      score: { home: 0, away: 0 },
      options: [
        { id: 'a', textKey: 'a', chance: 0.3 },
        { id: 'b', textKey: 'b', chance: 0.8 },
        { id: 'c', textKey: 'c', chance: 0.5 },
      ],
    };
    expect(autoDecider(moment, toFirstMatch(newCareer(baseOptions, 3)))).toBe(1);
  });

  it('equivale a giocare la partita con la scelta automatica', () => {
    const s = toFirstMatch(newCareer(baseOptions, 3));
    const simulated = simulateMatch(s);
    expect(simulated).toEqual(playMatch(s, autoDecider));
    expect(
      simulated.state.calendar.find((f) => f.id === simulated.matchReport.fixtureId)!.result,
    ).toBeDefined();
  });
});
