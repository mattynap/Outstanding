import { describe, expect, it } from 'vitest';
import { checkMomentKeys } from '@outstanding/content';
import {
  advanceWeek,
  defaultContext,
  newCareer,
  playerFixture,
  playMatch,
  type GameState,
  type KeyMoment,
  type Role,
} from '../src/index';
import { chainDepth } from '../src/match/moments';
import { Rng } from '../src/rng';
import { baseOptions } from './fixtures';

const ctx = defaultContext;
const cfg = ctx.config.match;
const types = cfg.moments.types;
const ROLES: Role[] = ['GK', 'DEF', 'MID', 'ATT'];

describe('catene dei momenti (config reale)', () => {
  it('content:check finds all moment text keys', () => {
    expect(checkMomentKeys(types, ctx.content.i18n.it)).toEqual([]);
  });

  it('every chainOnly type has exactly one closes option', () => {
    for (const t of types.filter((x) => x.chainOnly)) {
      const closers = t.options.filter((o) => o.closes);
      expect(closers.length, t.id).toBe(1);
      const c = closers[0]!;
      expect(c.risk, t.id).toBe('safe');
      for (const out of [c.success, c.failure]) {
        expect(out.next, t.id).toBeUndefined();
        expect(out.goalFor, t.id).toBeUndefined();
        expect(out.goalAgainst, t.id).toBeUndefined();
      }
    }
  });

  it('every role has a 2-step chain in attack and in defense', () => {
    for (const role of ROLES) {
      for (const phase of ['attack', 'defense'] as const) {
        const roots = types.filter(
          (t) => !t.chainOnly && t.phase === phase && (t.weights[role] ?? 0) > 0,
        );
        expect(
          roots.some((t) => chainDepth(t.id, ctx) >= 2),
          `${role} ${phase}`,
        ).toBe(true);
      }
    }
  });

  it('counter_recovery is a defensive chain step reached with chance 0.6', () => {
    const counter = types.find((t) => t.id === 'counter_recovery');
    expect(counter?.chainOnly).toBe(true);
    expect(counter?.phase).toBe('defense');
    const links = types.flatMap((t) =>
      t.options.flatMap((o) =>
        o.failure.next?.momentId === 'counter_recovery' ? [o.failure.next] : [],
      ),
    );
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) expect(l.chance).toBe(0.6);
  });

  it("full mode: 5–7 steps in ≥ 80% of matches with player on pitch 90'", () => {
    let full = 0;
    let inRange = 0;
    for (const role of ROLES) {
      for (let seed = 1; seed <= 60; seed++) {
        let s: GameState = newCareer({ ...baseOptions, role, traits: [] }, seed);
        const rng = Rng.fromSeed(seed);
        // Alcune partite per carriera: contano solo quelle giocate dall'inizio alla fine.
        for (let match = 0; match < 4; match++) {
          while (!playerFixture(s)) s = advanceWeek(s).state;
          const seen: KeyMoment[] = [];
          const r = playMatch(s, (mo) => {
            seen.push(mo);
            return rng.int(0, mo.options.length - 1);
          });
          s = advanceWeek(r.state).state;
          if (r.matchReport.minutesPlayed !== 90) continue;
          full++;
          if (seen.length >= 5 && seen.length <= 7) inRange++;
        }
      }
    }
    expect(full).toBeGreaterThan(100);
    expect(inRange / full).toBeGreaterThanOrEqual(0.8);
    // ~1000 partite reali: sotto carico supera i 5 s predefiniti.
  }, 60_000);
});
