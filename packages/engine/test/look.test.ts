import { describe, expect, it } from 'vitest';
import {
  changeLook,
  completeAppearance,
  defaultContext,
  deserialize,
  getTattoo,
  lookChangeCost,
  newCareer,
  serialize,
  tattooUnlocked,
  type GameState,
} from '../src/index';
import { baseOptions } from './fixtures';

const ctx = defaultContext;
const look = ctx.config.look;
const rich = (s: GameState): GameState => ({
  ...s,
  player: { ...s.player, money: { ...s.player.money, cash: 100_000 } },
});

describe('aspetto del giocatore', () => {
  it('le parti nuove non cambiano la generazione: stesso seme, stesso mondo', () => {
    const plain = newCareer(baseOptions, 5);
    const styled = newCareer(
      {
        ...baseOptions,
        appearance: { body: 2, eyes: 1, earring: 2, tattoos: { armRight: 'tribale' } },
      },
      5,
    );
    expect(styled.world).toEqual(plain.world);
    expect(styled.player.skills).toEqual(plain.player.skills);
    expect(styled.player.appearance.tattoos).toEqual({ armRight: 'tribale' });
    expect(plain.player.appearance.ageing).toBe(true);
  });

  it('alla creazione accetta solo i tatuaggi senza condizione e nella zona giusta', () => {
    expect(() =>
      newCareer({ ...baseOptions, appearance: { tattoos: { armLeft: 'coppa' } } }, 5),
    ).toThrow();
    expect(() =>
      newCareer({ ...baseOptions, appearance: { tattoos: { neck: 'tribale' } } }, 5),
    ).toThrow();
    expect(() => newCareer({ ...baseOptions, appearance: { body: 99 } }, 5)).toThrow();
  });

  it('completa gli aspetti dei salvataggi vecchi', () => {
    const s = newCareer(baseOptions, 5);
    const { body: _b, tattoos: _t, ageing: _a, ...old } = s.player.appearance;
    const raw = serialize({ ...s, player: { ...s.player, appearance: old as never } });
    const loaded = deserialize(raw).player.appearance;
    expect(loaded).toEqual(completeAppearance(old));
    expect(loaded.tattoos).toEqual({});
  });

  it('sblocca i tatuaggi con età, presenze, trofei e massima serie', () => {
    const s = newCareer(baseOptions, 5);
    const coppa = getTattoo('coppa', ctx);
    const corona = getTattoo('corona', ctx);
    const pallone = getTattoo('pallone', ctx);
    expect(tattooUnlocked(coppa, s, ctx)).toBe(false);
    const record = {
      season: 1,
      age: 22,
      clubId: 'c1',
      leagueLevel: 1,
      position: 3,
      stats: { ...s.player.seasonStats, appearances: 60 },
      trophies: ['national_cup'],
    };
    const veteran = {
      ...s,
      player: { ...s.player, history: [record as never] },
    };
    expect(tattooUnlocked(coppa, veteran, ctx)).toBe(true);
    expect(tattooUnlocked(corona, veteran, ctx)).toBe(true);
    expect(tattooUnlocked(pallone, veteran, ctx)).toBe(true);
  });

  it('il barbiere costa un taglio, il tatuatore un tanto a tatuaggio', () => {
    const s = rich(newCareer(baseOptions, 5));
    const a = s.player.appearance;
    const next = {
      ...a,
      hairStyle: (a.hairStyle + 1) % 3,
      earring: 1,
      tattoos: { armLeft: 'rosa', neck: 'stella' },
    };
    expect(lookChangeCost(a, next, ctx)).toBe(look.styleChangeCost + 2 * look.tattooCost);
    const done = changeLook(s, next, ctx);
    expect(done.cost).toBe(look.styleChangeCost + 2 * look.tattooCost);
    expect(done.state.player.money.cash).toBe(100_000 - done.cost);
    expect(done.state.player.appearance.tattoos).toEqual({ armLeft: 'rosa', neck: 'stella' });
    const removed = changeLook(done.state, { ...next, tattoos: { armLeft: 'rosa' } }, ctx);
    expect(removed.cost).toBe(look.tattooRemovalCost);
    // Togliere l'invecchiamento non costa nulla.
    expect(changeLook(s, { ...a, ageing: false }, ctx).cost).toBe(0);
  });

  it('rifiuta parti fisse, tatuaggi bloccati e conti non pagabili', () => {
    const s = rich(newCareer(baseOptions, 5));
    const a = s.player.appearance;
    expect(() => changeLook(s, { ...a, skin: (a.skin + 1) % 3 }, ctx)).toThrow();
    expect(() => changeLook(s, { ...a, tattoos: { armLeft: 'coppa' } }, ctx)).toThrow();
    const poor = newCareer(baseOptions, 5);
    expect(() =>
      changeLook(poor, { ...poor.player.appearance, tattoos: { armLeft: 'rosa' } }, ctx),
    ).toThrow();
  });
});
