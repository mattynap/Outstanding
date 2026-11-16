import { describe, expect, it } from 'vitest';
import {
  bigMatchKind,
  defaultContext,
  fastForward,
  isSeasonOver,
  newCareer,
  planWeek,
  playerFixture,
  prudentChoice,
  repeatPlan,
  skipToNextMatch,
  type FastForwardStop,
  type FastForwardTarget,
  type GameState,
} from '../src/index';
import { baseOptions } from './fixtures';

const ctx = defaultContext;
const ev = (id: string) => ctx.content.events.find((e) => e.id === id)!;
const start = (seed = 6): GameState => newCareer(baseOptions, seed);

describe('piano ricordato', () => {
  it('planWeek ricorda il piano scelto e il piano automatico non lo sostituisce', () => {
    const s = planWeek(start(), [{ actionId: 'train_intense' }, { actionId: 'leisure' }]).state;
    expect(s.lastPlan).toEqual([{ actionId: 'train_intense' }, { actionId: 'leisure' }]);
    const skipped = skipToNextMatch({ ...s, week: s.week + 1 }).state;
    expect(skipped.lastPlan).toEqual(s.lastPlan);
  });

  it('il piano da ripetere toglie serate e azioni non disponibili', () => {
    const s = {
      ...start(),
      lastPlan: [{ actionId: 'party' }, { actionId: 'train_normal' }],
    };
    expect(repeatPlan(s)).toEqual([{ actionId: 'train_normal' }]);
    const injured = {
      ...s,
      player: { ...s.player, injury: { type: 'contusione', weeksLeft: 2 } },
    };
    expect(repeatPlan(injured).every((c) => c.actionId !== 'train_normal')).toBe(true);
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
