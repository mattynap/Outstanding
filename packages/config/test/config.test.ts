import { describe, expect, it } from 'vitest';
import { defaultConfig, parseConfig, rawDefaultConfig } from '../src/index';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const raw = (): any => JSON.parse(JSON.stringify(rawDefaultConfig));

describe('config', () => {
  it('default config is valid', () => {
    expect(defaultConfig.player.startAge).toBe(16);
  });

  it('rejects inverted ranges', () => {
    const bad = raw();
    bad.player.skillRanges.ATT.pace = [60, 40];
    expect(() => parseConfig(bad)).toThrow(/player\.json/);
  });

  it('rejects a missing skill weight', () => {
    const bad = raw();
    delete bad.ratings.roleWeights.GK.goalkeeping;
    expect(() => parseConfig(bad)).toThrow(/ratings\.json/);
  });

  it('rejects unbalanced promotions and relegations', () => {
    const bad = raw();
    bad.world.levels[0].relegatePerGroup = 4;
    expect(() => parseConfig(bad)).toThrow(/relegations must equal/);
  });

  it('rejects odd group sizes and unknown start levels', () => {
    const odd = raw();
    odd.world.levels[2].clubsPerGroup = 19;
    expect(() => parseConfig(odd)).toThrow(/even/);
    const start = raw();
    start.world.startLevels = [9];
    expect(() => parseConfig(start)).toThrow(/start level/);
  });

  describe('match: regista, catene e rischio', () => {
    const option = (id: string, extra: Record<string, unknown> = {}) => ({
      id,
      skills: { passing: 1 },
      difficulty: 0,
      risk: 'balanced',
      success: { rating: 0.3 },
      failure: { rating: -0.3 },
      ...extra,
    });
    const closer = () => option('z', { closes: true, risk: 'safe' });
    // I tipi chainOnly ricevono di default l'uscita "chiudi" richiesta dallo schema.
    const type = (id: string, extra: Record<string, unknown> = {}, opts?: unknown[]) => {
      const t = {
        id,
        phase: 'attack',
        weights: {},
        textVariants: 1,
        chainOnly: true,
        options: opts ?? [option('a'), option('b')],
        ...extra,
      };
      const list = t.options as { closes?: boolean }[];
      if (t.chainOnly && !opts?.some((o) => (o as { closes?: boolean }).closes)) {
        t.options = [...list, closer()];
      }
      return t;
    };
    const withTypes = (...types: unknown[]) => {
      const bad = raw();
      bad.moments.types.push(...types);
      return bad;
    };
    const nextTo = (momentId: string) => ({
      ...option('a'),
      success: { rating: 0.3, next: { momentId } },
    });

    it('accetta next, effects, risk e phase', () => {
      const ok = withTypes(
        type('step_two'),
        type('step_one', {}, [
          {
            ...option('a'),
            success: { rating: 0.3, next: { momentId: 'step_two', chance: 0.5 } },
            failure: { rating: -0.3, effects: { nerves: 1, pressure: -0.1 } },
          },
          option('b'),
        ]),
      );
      const cfg = parseConfig(ok);
      expect(cfg.match.moments.types.length).toBe(
        (rawDefaultConfig.moments as { types: unknown[] }).types.length + 2,
      );
      const added = cfg.match.moments.types.find((t) => t.id === 'step_one')!;
      expect(added.phase).toBe('attack');
      expect(added.options[0]!.risk).toBe('balanced');
      expect(added.options[0]!.success.next).toEqual({ momentId: 'step_two', chance: 0.5 });
      expect(added.options[0]!.failure.effects).toEqual({ nerves: 1, pressure: -0.1 });
      expect(added.options.some((o) => o.closes && o.risk === 'safe')).toBe(true);
    });

    it('rifiuta next verso un momento sconosciuto', () => {
      const bad = withTypes(type('x', {}, [nextTo('non_esiste'), option('b')]));
      expect(() => parseConfig(bad)).toThrow(/unknown moment/);
    });

    it('rifiuta i cicli di catena', () => {
      const bad = withTypes(
        type('c1', {}, [nextTo('c2'), option('b')]),
        type('c2', {}, [nextTo('c1'), option('b')]),
      );
      expect(() => parseConfig(bad)).toThrow(/cycle/);
    });

    it('rifiuta catene oltre chainMaxSteps', () => {
      const chain = (n: number) => {
        const types = [];
        for (let i = 1; i <= n; i++) {
          types.push(
            type(`s${i}`, i === 1 ? { chainOnly: false, weights: { ATT: 1 } } : {}, [
              i < n ? nextTo(`s${i + 1}`) : option('a'),
              option('b'),
            ]),
          );
        }
        return withTypes(...types);
      };
      expect(() => parseConfig(chain(3))).not.toThrow();
      expect(() => parseConfig(chain(4))).toThrow(/depth/);
    });

    it('rifiuta un tipo chainOnly con pesi di ruolo', () => {
      const bad = withTypes(type('co', { weights: { ATT: 1 } }));
      expect(() => parseConfig(bad)).toThrow(/chainOnly/);
    });

    it('qualityMaxBonus fino a 0.15 accettato, 0.2 rifiutato', () => {
      const ok = raw();
      ok.match.moments.qualityMaxBonus = 0.15;
      expect(() => parseConfig(ok)).not.toThrow();
      const bad = raw();
      bad.match.moments.qualityMaxBonus = 0.2;
      expect(() => parseConfig(bad)).toThrow(/match\.json/);
    });

    it('la tabella close ha chiavi intere', () => {
      const bad = raw();
      bad.match.director.close = { '-1': 1, '0.5': 1 };
      expect(() => parseConfig(bad)).toThrow(/match\.json/);
    });

    it('chanceBands: low < high', () => {
      const bad = raw();
      bad.match.chanceBands = { low: 0.7, high: 0.4 };
      expect(() => parseConfig(bad)).toThrow(/low/);
    });

    it("un'opzione closes non ha next ne gol negli esiti", () => {
      const withNext = withTypes(
        type('t2'),
        type('cl', {}, [
          {
            ...option('a', { closes: true, risk: 'safe' }),
            success: { rating: 0, next: { momentId: 't2' } },
          },
          option('b'),
        ]),
      );
      expect(() => parseConfig(withNext)).toThrow(/closes option cannot have next or goals/);
      const withGoal = withTypes(
        type('cl2', {}, [
          {
            ...option('a', { closes: true, risk: 'safe' }),
            failure: { rating: 0, goalAgainst: 0.2 },
          },
          option('b'),
        ]),
      );
      expect(() => parseConfig(withGoal)).toThrow(/closes option cannot have next or goals/);
      const onlyFailure = withTypes(
        type('t3'),
        type('cl4', {}, [
          {
            ...option('a', { closes: true, risk: 'safe' }),
            failure: { rating: 0, next: { momentId: 't3' } },
          },
          option('b'),
        ]),
      );
      expect(() => parseConfig(onlyFailure)).toThrow(/closes option cannot have next or goals/);
      const fine = withTypes(
        type('cl3', {}, [option('a', { closes: true, risk: 'safe' }), option('b')]),
      );
      expect(() => parseConfig(fine)).not.toThrow();
    });

    it('un tipo chainOnly ha una sola opzione closes e sicura', () => {
      const none = withTypes({
        ...type('nc', { chainOnly: true }),
        options: [option('a'), option('b')],
      });
      expect(() => parseConfig(none)).toThrow(/exactly one safe option with closes/);
      const two = withTypes(
        type('tc', {}, [
          option('a', { closes: true, risk: 'safe' }),
          option('b', { closes: true, risk: 'safe' }),
        ]),
      );
      expect(() => parseConfig(two)).toThrow(/exactly one safe option with closes/);
      const risky = withTypes(
        type('rc', {}, [option('a', { closes: true, risk: 'risky' }), option('b')]),
      );
      expect(() => parseConfig(risky)).toThrow(/exactly one safe option with closes/);
      const ok = withTypes(
        type('oc', {}, [option('a', { closes: true, risk: 'safe' }), option('b')]),
      );
      expect(() => parseConfig(ok)).not.toThrow();
    });

    it('ogni ruolo ha una radice da un passo in attacco e in difesa', () => {
      const bad = raw();
      // Il GK resta senza momenti di attacco: il regista non potrebbe armare.
      bad.moments.types = bad.moments.types.filter(
        (t: { phase: string; weights: Record<string, number> }) =>
          !(t.phase === 'attack' && t.weights.GK),
      );
      expect(() => parseConfig(bad)).toThrow(/no single-step attack root moment for role GK/);
    });

    it('minMinutesForMoment deve superare armLead', () => {
      const bad = raw();
      bad.match.director.armLead = bad.match.moments.minMinutesForMoment;
      expect(() => parseConfig(bad)).toThrow(/minMinutesForMoment must be > director.armLead/);
    });

    it("un'opzione legend deve essere risky", () => {
      const legend = { id: 'leg', minTension: 0.5, skills: { shooting: 1 } };
      const bad = withTypes(type('lg', {}, [option('a', { legend }), option('b')]));
      expect(() => parseConfig(bad)).toThrow(/legend/);
      const ok = withTypes(type('lg', {}, [option('a', { legend, risk: 'risky' }), option('b')]));
      expect(() => parseConfig(ok)).not.toThrow();
    });
  });
});
