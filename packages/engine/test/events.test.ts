import type { GameEvent } from '@outstanding/content';
import { describe, expect, it } from 'vitest';
import {
  advanceWeek,
  beginMatch,
  checkConditions,
  defaultContext,
  deserialize,
  acceptOffer,
  drawWeekEvents,
  endSeason,
  getPendingEvents,
  isSeasonOver,
  newCareer,
  playerFixture,
  playMatch,
  resolveEvent,
  serialize,
  type GameContext,
  type GameState,
} from '../src/index';
import { baseOptions } from './fixtures';

const ctx = defaultContext;

/** Contesto con soli eventi di prova (e una sola estrazione per settimana). */
function testContext(events: GameEvent[], perWeekWeights = [0, 1]): GameContext {
  return {
    config: { ...ctx.config, events: { ...ctx.config.events, perWeekWeights } },
    content: { ...ctx.content, events },
  };
}

const ev = (over: Partial<GameEvent> & { id: string }): GameEvent => ({
  category: 'life',
  weight: 1,
  cooldownWeeks: 0,
  titleKey: 'x.title',
  textKey: 'x.text',
  choices: [{ textKey: 'x.c1', effects: [] }],
  ...over,
});

const start = () => newCareer(baseOptions, 321);

/** Risolve tutti gli eventi in attesa con la prima scelta. */
function resolveAll(state: GameState, c: GameContext = ctx): GameState {
  let s = state;
  for (const e of getPendingEvents(s, c)) s = resolveEvent(s, e.eventId, 0, c).state;
  return s;
}

describe('estrazione degli eventi', () => {
  it('è deterministica e stabile nella stessa settimana', () => {
    const a = drawWeekEvents(start());
    const b = drawWeekEvents(start());
    expect(a.events).toEqual(b.events);
    const again = drawWeekEvents(a.state);
    expect(again.events).toEqual(a.events);
    expect(serialize(again.state)).toBe(serialize(a.state));
  });

  it('rispetta il massimo settimanale e una categoria per settimana', () => {
    // Contesto controllato: una sola estrazione per settimana e un evento sempre idoneo.
    const c = testContext([ev({ id: 'sempre' })], [0, 1]);
    const max = c.config.events.perWeekWeights.length - 1;
    let s = start();
    let total = 0;
    const weeks = 30;
    for (let i = 0; i < weeks; i++) {
      const { state, events } = drawWeekEvents(s, c);
      expect(events.length).toBeLessThanOrEqual(max);
      expect(new Set(events.map((e) => e.category)).size).toBe(events.length);
      total += events.length;
      s = resolveAll(state, c);
      while (playerFixture(s)) s = playMatch(s, () => 0).state;
      s = advanceWeek(s, c).state;
    }
    expect(total).toBe(weeks);
  });

  it('blocca settimana e partita finché gli eventi non hanno risposta', () => {
    const c = testContext([ev({ id: 'blocco' })]);
    let s = start();
    while (!playerFixture(s)) s = advanceWeek(s).state;
    const drawn = drawWeekEvents(s, c).state;
    expect(drawn.pendingEvents).toHaveLength(1);
    expect(() => advanceWeek(drawn, c)).toThrow(/resolveEvent/);
    expect(() => beginMatch(drawn, c)).toThrow(/events/);
    const done = resolveAll(drawn, c);
    expect(() => beginMatch(done, c)).not.toThrow();
  });

  it('applica cooldown ed eventi unici', () => {
    const c = testContext([ev({ id: 'raro', cooldownWeeks: 5 }), ev({ id: 'unico', once: true })]);
    let s = start();
    const seen: string[][] = [];
    for (let i = 0; i < 12; i++) {
      const d = drawWeekEvents(s, c);
      seen.push(d.events.map((e) => e.eventId));
      s = resolveAll(d.state, c);
      s = { ...s, week: s.week + 1 };
    }
    const weeksOf = (id: string) => seen.flatMap((ids, w) => (ids.includes(id) ? [w] : []));
    expect(weeksOf('unico')).toHaveLength(1);
    const raro = weeksOf('raro');
    for (let i = 1; i < raro.length; i++) expect(raro[i]! - raro[i - 1]!).toBeGreaterThanOrEqual(5);
  });

  it('fa arrivare gli eventi in catena alla settimana giusta', () => {
    const c = testContext([
      ev({
        id: 'inizio',
        once: true,
        choices: [
          { textKey: 'x', effects: [{ type: 'schedule', eventId: 'seguito', inWeeks: 3 }] },
        ],
      }),
      ev({ id: 'seguito', chainOnly: true }),
    ]);
    let s = drawWeekEvents(start(), c).state;
    expect(s.pendingEvents.map((p) => p.eventId)).toEqual(['inizio']);
    const startWeek = s.week;
    s = resolveAll(s, c);
    for (let w = 1; w <= 3; w++) {
      s = { ...s, week: s.week + 1 };
      s = drawWeekEvents(s, c).state;
      const ids = s.pendingEvents.map((p) => p.eventId);
      expect(ids.includes('seguito')).toBe(s.week === startWeek + 3);
      s = resolveAll(s, c);
    }
  });
});

describe('effetti', () => {
  const all = ev({
    id: 'tutto',
    choices: [
      {
        textKey: 'x',
        effects: [
          { type: 'stat', path: 'condition.morale', delta: 500 },
          { type: 'stat', path: 'image.followers', delta: -1_000_000 },
          { type: 'money', delta: -100_000 },
          { type: 'flag', flag: 'segnato' },
          { type: 'relationship', target: 'coach', delta: 7 },
          { type: 'startTransfer', to: 'higher_level' },
          { type: 'injury', injuryType: 'stiramento', weeks: [2, 2] },
          { type: 'trait', traitId: 'leader', action: 'add' },
          { type: 'chance', p: 1, effects: [{ type: 'flag', flag: 'fortuna', value: 3 }] },
        ],
      },
    ],
  });
  const c = testContext([all]);
  const drawn = drawWeekEvents(start(), c).state;
  const { state: s, report } = resolveEvent(drawn, 'tutto', 0, c);

  it('modifica statistiche rispettando i limiti', () => {
    expect(s.player.condition.morale).toBe(ctx.config.events.statLimits.pctMax);
    expect(s.player.image.followers).toBe(0);
    expect(s.player.money.cash).toBe(drawn.player.money.cash - 100_000);
  });

  it('applica flag, rapporti, mercato, infortuni, tratti e probabilità', () => {
    const coachId = s.world.clubs.find((cl) => cl.id === s.player.clubId)!.coachId;
    expect(s.player.flags['segnato']).toBe(true);
    expect(s.player.flags['fortuna']).toBe(3);
    expect(s.player.relationships[coachId]).toBe((drawn.player.relationships[coachId] ?? 0) + 7);
    expect(s.transferRequests).toEqual([{ to: 'higher_level', week: s.week }]);
    expect(s.player.injury).toEqual({ type: 'stiramento', weeksLeft: 2 });
    expect(s.player.traits).toContain('leader');
    expect(report.changes.length).toBeGreaterThanOrEqual(9);
    expect(s.pendingEvents).toEqual([]);
    expect(s.eventLog.at(-1)).toEqual({ eventId: 'tutto', week: s.week, choice: 0 });
  });

  it('fa guarire gli infortuni con il passare delle settimane', () => {
    const w1 = advanceWeek(s, c).state;
    expect(w1.player.injury?.weeksLeft).toBe(1);
    const w2 = advanceWeek(w1, c).state;
    expect(w2.player.injury).toBeUndefined();
  });

  it('rimuove un flag con value null', () => {
    const remove = ev({
      id: 'togli',
      choices: [{ textKey: 'x', effects: [{ type: 'flag', flag: 'segnato', value: null }] }],
    });
    const c2 = testContext([remove]);
    const after = resolveEvent(
      drawWeekEvents({ ...s, week: s.week + 1 }, c2).state,
      'togli',
      0,
      c2,
    );
    expect('segnato' in after.state.player.flags).toBe(false);
  });

  it('rifiuta eventi non in attesa e scelte inesistenti', () => {
    expect(() => resolveEvent(s, 'tutto', 0, c)).toThrow();
    expect(() => resolveEvent(drawn, 'tutto', 9, c)).toThrow();
  });

  it('sopravvive a salvataggio e ripresa', () => {
    const restored = deserialize(serialize(drawn));
    expect(resolveEvent(restored, 'tutto', 0, c).state).toEqual(s);
  });
});

describe('condizioni', () => {
  const s = start();

  it('valuta età, statistiche, flag, ruoli, livello e infortuni', () => {
    expect(checkConditions({ age: { max: 16 } }, s)).toBe(true);
    expect(checkConditions({ age: { min: 18 } }, s)).toBe(false);
    expect(checkConditions({ stats: [{ path: 'condition.energy', gte: 0 }] }, s)).toBe(true);
    expect(checkConditions({ stats: [{ path: 'condition.energy', gte: 101 }] }, s)).toBe(false);
    expect(checkConditions({ flags: ['nuovo'] }, s)).toBe(false);
    expect(checkConditions({ flagsNot: ['nuovo'] }, s)).toBe(true);
    expect(checkConditions({ roles: ['ATT'] }, s)).toBe(true);
    expect(checkConditions({ roles: ['GK'] }, s)).toBe(false);
    expect(checkConditions({ level: { min: 5 } }, s)).toBe(true);
    expect(checkConditions({ level: { max: 1 } }, s)).toBe(false);
    expect(checkConditions({ professional: false }, s)).toBe(true);
    expect(checkConditions({ injured: false }, s)).toBe(true);
    expect(checkConditions({ window: 'summer' }, s)).toBe(true);
    expect(checkConditions({ traits: ['bomber_area'] }, s)).toBe(true);
  });
});

describe('eventi del gioco', () => {
  it('reggono tre stagioni di gioco con scelte diverse', () => {
    let s = start();
    const seen = new Set<string>();
    let pick = 0;
    for (let season = 0; season < 3; season++) {
      while (!isSeasonOver(s)) {
        const d = drawWeekEvents(s);
        s = d.state;
        for (const e of d.events) {
          seen.add(e.eventId);
          expect(Object.keys(e.params)).toEqual(expect.arrayContaining(['firstName', 'city']));
          if (s.player.clubId) expect(e.params['club']).toBeDefined();
          s = resolveEvent(s, e.eventId, pick++ % e.choices.length).state;
        }
        while (playerFixture(s)) s = playMatch(s, () => 0).state;
        s = advanceWeek(s).state;
      }
      s = endSeason(s).state;
      // Da svincolato firma la prima offerta che arriva.
      while (!s.player.clubId && !isSeasonOver(s)) {
        const offer = s.offers[0];
        if (offer) s = acceptOffer(s, offer.id);
        else s = advanceWeek(s).state;
      }
    }
    expect(seen.size).toBeGreaterThan(10);
  });
});
