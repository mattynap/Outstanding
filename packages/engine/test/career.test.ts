import { describe, expect, it } from 'vitest';
import {
  computeOvr,
  defaultContext,
  deserialize,
  migrate,
  newCareer,
  serialize,
  ageAt,
} from '../src/index';
import { baseOptions } from './fixtures';

describe('newCareer', () => {
  it('is deterministic: same seed and options give the same state', () => {
    expect(newCareer(baseOptions, 42)).toEqual(newCareer(baseOptions, 42));
  });

  it('different seeds give different players', () => {
    expect(newCareer(baseOptions, 1).player.skills).not.toEqual(
      newCareer(baseOptions, 2).player.skills,
    );
  });

  it('creates a 16-year-old with values inside the configured ranges', () => {
    const cfg = defaultContext.config;
    for (let seed = 0; seed < 50; seed++) {
      const s = newCareer(baseOptions, seed);
      const p = s.player;
      expect(ageAt(p.birthWeek, s.week, cfg.calendar)).toBe(cfg.player.startAge);
      expect(p.potential).toBeGreaterThanOrEqual(cfg.player.potential.min);
      expect(p.potential).toBeLessThanOrEqual(cfg.player.potential.max);
      for (const [skill, value] of Object.entries(p.skills)) {
        const [min, max] = cfg.player.skillRanges.ATT[skill as keyof typeof p.skills];
        expect(value).toBeGreaterThanOrEqual(min);
        expect(value).toBeLessThanOrEqual(max);
      }
    }
  });

  it('rejects invalid traits', () => {
    expect(() => newCareer({ ...baseOptions, traits: ['non_esiste'] }, 1)).toThrow(/Unknown/);
    expect(() => newCareer({ ...baseOptions, role: 'GK', traits: ['bomber_area'] }, 1)).toThrow(
      /not available/,
    );
    expect(() =>
      newCareer({ ...baseOptions, traits: ['leader', 'muro', 'fantasista'] }, 1),
    ).toThrow(/At most/);
  });
});

describe('computeOvr', () => {
  it('weights skills by role', () => {
    const skills = {
      pace: 50,
      shooting: 90,
      passing: 50,
      dribbling: 50,
      defending: 10,
      physical: 50,
      vision: 50,
      goalkeeping: 5,
    };
    const ratings = defaultContext.config.ratings;
    expect(computeOvr(skills, 'ATT', ratings)).toBeGreaterThan(computeOvr(skills, 'DEF', ratings));
    expect(computeOvr(skills, 'GK', ratings)).toBeLessThan(30);
  });
});

describe('save', () => {
  it('round-trips through serialize/deserialize', () => {
    const s = newCareer(baseOptions, 77);
    expect(deserialize(serialize(s))).toEqual(s);
  });

  it('rejects garbage and future versions', () => {
    expect(() => deserialize('not json')).toThrow(/JSON/);
    expect(() => deserialize('{}')).toThrow(/saveVersion/);
    const s = newCareer(baseOptions, 1);
    expect(() => deserialize(serialize({ ...s, saveVersion: 999 }))).toThrow(/newer/);
  });

  it('applies migrations in order', () => {
    const table = {
      1: (raw: Record<string, unknown>) => ({ ...raw, a: 1, saveVersion: 2 }),
      2: (raw: Record<string, unknown>) => ({
        ...raw,
        b: (raw['a'] as number) + 1,
        saveVersion: 3,
      }),
    };
    expect(migrate({ saveVersion: 1 }, 3, table)).toEqual({ saveVersion: 3, a: 1, b: 2 });
    expect(() => migrate({ saveVersion: 1 }, 4, table)).toThrow(/No migration/);
  });
});

describe('aspetto del giocatore', () => {
  it('usa le parti scelte e completa a caso le altre, entro le tavolozze', () => {
    const s = newCareer({ ...baseOptions, appearance: { skin: 2, beard: 0 } }, 9);
    const a = defaultContext.content.avatar;
    expect(s.player.appearance.skin).toBe(2);
    expect(s.player.appearance.beard).toBe(0);
    expect(s.player.appearance.hairStyle).toBeLessThan(a.hairStyles.length);
    expect(s.player.appearance.hairColor).toBeLessThan(a.hairColors.length);
  });

  it('rifiuta parti fuori dalle tavolozze', () => {
    expect(() => newCareer({ ...baseOptions, appearance: { skin: 99 } }, 9)).toThrow(/appearance/);
  });
});
