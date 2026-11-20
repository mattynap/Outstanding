import { describe, expect, it } from 'vitest';
import {
  careerDifficulty,
  defaultContext,
  deserialize,
  DIFFICULTIES,
  difficultyMods,
  newCareer,
  optionChance,
  planWeek,
  refreshMarket,
  serialize,
  type Difficulty,
  type GameState,
} from '../src/index';
import { baseOptions } from './fixtures';

const ctx = defaultContext;
const career = (difficulty?: Difficulty) => newCareer({ ...baseOptions, difficulty }, 21);

describe('difficoltà', () => {
  it('si sceglie alla creazione, con la predefinita se manca', () => {
    expect(career('hard').difficulty).toBe('hard');
    expect(career().difficulty).toBe(ctx.config.difficulty.default);
    // Il mondo generato non dipende dalla difficoltà.
    expect(career('easy').world).toEqual(career('hard').world);
  });

  it('i salvataggi senza difficoltà valgono come la predefinita', () => {
    const { difficulty: _d, ...old } = career('hard');
    const loaded = deserialize(serialize(old as GameState));
    expect(careerDifficulty(loaded, ctx)).toBe(ctx.config.difficulty.default);
  });

  it('ha modificatori ordinati da facile a difficile', () => {
    const [easy, normal, hard] = DIFFICULTIES.map((d) => ctx.config.difficulty.levels[d]);
    expect(normal).toEqual({ growth: 1, injury: 1, offerChance: 1, salary: 1, matchChance: 0 });
    for (const key of ['growth', 'offerChance', 'salary', 'matchChance'] as const) {
      expect(easy![key]).toBeGreaterThan(normal![key]);
      expect(hard![key]).toBeLessThan(normal![key]);
    }
    expect(easy!.injury).toBeLessThan(hard!.injury);
  });

  it("l'allenamento rende di più in facile e di meno in difficile", () => {
    const gain = (d: Difficulty) => {
      const s = career(d);
      const before = s.player.skills.shooting;
      const after = planWeek(s, { load: 'balanced' }, ctx).state.player.skills.shooting;
      return after - before;
    };
    expect(gain('easy')).toBeGreaterThan(gain('normal'));
    expect(gain('normal')).toBeGreaterThan(gain('hard'));
  });

  it('cambia la probabilità dei momenti chiave entro i limiti', () => {
    const s = career('normal');
    const option = ctx.config.match.moments.types[0]!.options[0]!;
    const chance = (d: Difficulty) =>
      optionChance(
        s.player,
        option,
        50,
        ctx,
        difficultyMods({ ...s, difficulty: d }, ctx).matchChance,
      );
    expect(chance('easy')).toBeGreaterThan(chance('normal'));
    expect(chance('hard')).toBeLessThan(chance('normal'));
    expect(chance('hard')).toBeGreaterThanOrEqual(ctx.config.match.moments.minChance);
  });

  it('gli stipendi offerti seguono la difficoltà', () => {
    // Svincolato in finestra: riceve sempre almeno un'offerta di ripiego.
    const offerFor = (d: Difficulty) => {
      const s = career(d);
      const { clubId: _c, contract: _k, ...player } = s.player;
      const free = refreshMarket({ ...s, player }, ctx);
      return free.offers[0]!;
    };
    const easy = offerFor('easy');
    const hard = offerFor('hard');
    expect(easy.clubId).toBe(hard.clubId);
    expect(easy.salaryWeekly).toBeGreaterThanOrEqual(hard.salaryWeekly);
  });
});
