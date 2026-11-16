import { describe, expect, it } from 'vitest';
import { defaultContext, newCareer } from '../src/index';
import { clubVisuals } from '../src/world/club';
import { baseOptions } from './fixtures';

const ctx = defaultContext;
const state = newCareer(baseOptions, 2024);
const { world } = state;

describe('world generation', () => {
  it('creates every configured level with the right number of groups and clubs', () => {
    expect(world.leagues).toHaveLength(ctx.config.world.levels.length);
    for (const levelCfg of ctx.config.world.levels) {
      const league = world.leagues.find((l) => l.level === levelCfg.level)!;
      expect(league.groups).toHaveLength(levelCfg.groups);
      for (const g of league.groups) expect(g.clubIds).toHaveLength(levelCfg.clubsPerGroup);
    }
    const total = ctx.config.world.levels.reduce((a, l) => a + l.groups * l.clubsPerGroup, 0);
    expect(world.clubs).toHaveLength(total);
  });

  it('uses real cities with matching areas and unique invented names', () => {
    const cityNames = new Set(ctx.content.cities.map((c) => c.name));
    const names = new Set<string>();
    const shortNames = new Set<string>();
    for (const club of world.clubs) {
      expect(cityNames.has(club.city)).toBe(true);
      expect(names.has(club.name)).toBe(false);
      expect(shortNames.has(club.shortName)).toBe(false);
      names.add(club.name);
      shortNames.add(club.shortName);
    }
    for (const league of world.leagues) {
      for (const g of league.groups) {
        if (!g.area) continue;
        for (const id of g.clubIds) {
          expect(world.clubs.find((c) => c.id === id)!.area).toBe(g.area);
        }
      }
    }
  });

  it('gives each club a full roster, a coach and a rating consistent with its level', () => {
    const comp = ctx.config.world.roster.composition;
    const size = comp.GK + comp.DEF + comp.MID + comp.ATT;
    const avgByLevel = world.leagues.map((l) => {
      const clubs = world.clubs.filter((c) => l.groups.some((g) => g.id === c.groupId));
      return clubs.reduce((a, c) => a + c.rating, 0) / clubs.length;
    });
    for (const club of world.clubs) {
      expect(club.roster).toHaveLength(size);
      expect(world.npcs.find((n) => n.id === club.coachId)?.role).toBe('coach');
    }
    // I livelli più alti sono in media più forti.
    for (let i = 1; i < avgByLevel.length; i++) {
      expect(avgByLevel[i - 1]!).toBeGreaterThan(avgByLevel[i]!);
    }
  });

  it('has unique ids across clubs, roster players and npcs', () => {
    const ids = [
      ...world.clubs.map((c) => c.id),
      ...world.clubs.flatMap((c) => c.roster.map((r) => r.id)),
      ...world.npcs.map((n) => n.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect(state.nextId).toBeGreaterThan(ids.length);
  });

  it('has text keys for every league, group and competition', () => {
    const t = ctx.content.i18n.it;
    for (const league of world.leagues) {
      expect(t[league.nameKey]).toBeDefined();
      for (const g of league.groups) expect(t[g.nameKey]).toBeDefined();
    }
    for (const comp of world.competitions) expect(t[comp.nameKey]).toBeDefined();
  });

  it('generates deterministic crest and kit data from the club seed', () => {
    const club = world.clubs[0]!;
    const again = clubVisuals(
      club.seed,
      club.crest.initials,
      ctx.content.clubs,
      ctx.config.world.kitPatternWeights,
    );
    expect(again).toEqual({ crest: club.crest, kit: club.kit });
    expect(club.crest.primary).not.toBe(club.crest.secondary);
  });
});

describe('career start', () => {
  it('signs the player with a club of the start level in his area', () => {
    const club = world.clubs.find((c) => c.id === state.player.clubId)!;
    expect(club.groupId).toBe(`L${ctx.config.world.defaultStartLevel}N`); // Bergamo è al Nord
    expect(state.player.contract?.clubId).toBe(club.id);
    expect(state.player.contract?.amateur).toBe(true);
    expect(state.player.relationships[club.coachId]).toBeDefined();
  });

  it('honours the chosen start level and rejects invalid ones', () => {
    const s = newCareer({ ...baseOptions, hometown: 'Palermo', startLevel: 5 }, 9);
    const club = s.world.clubs.find((c) => c.id === s.player.clubId)!;
    expect(club.groupId).toBe('L5S');
    expect(() => newCareer({ ...baseOptions, startLevel: 1 }, 9)).toThrow(/not allowed/);
    expect(() => newCareer({ ...baseOptions, hometown: 'Atlantide' }, 9)).toThrow(/hometown/);
  });

  it('is deterministic including the whole world', () => {
    expect(newCareer(baseOptions, 5)).toEqual(newCareer(baseOptions, 5));
  });
});
