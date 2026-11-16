import { describe, expect, it } from 'vitest';
import {
  careerScore,
  careerTotals,
  defaultContext,
  isLegend,
  type SeasonRecord,
} from '../src/index';

const cfg = defaultContext.config.career;

function season(
  over: Partial<SeasonRecord> & { level: number | null; apps?: number },
): SeasonRecord {
  const apps = over.apps ?? 30;
  return {
    season: 1,
    age: 20,
    clubId: 'c1',
    leagueLevel: over.level,
    ovr: 60,
    stats: {
      appearances: apps,
      starts: apps,
      minutes: apps * 90,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      ratingSum: apps * cfg.score.baseRating,
      ratingCount: apps,
    },
    leaguePosition: 1,
    promoted: false,
    relegated: false,
    trophies: [],
    ...over,
  };
}

describe('punteggio di carriera', () => {
  it('vale di più giocare ai livelli alti', () => {
    const top = careerScore([season({ level: 1 })]);
    const low = careerScore([season({ level: 6 })]);
    expect(top.total).toBeGreaterThan(low.total);
    expect(top.parts.appearances).toBe(Math.round(30 * cfg.score.perLevel[0]!.appearance));
  });

  it('somma trofei e voti sopra la media', () => {
    const base = season({ level: 1 });
    const good = {
      ...base,
      trophies: ['continental_major'],
      stats: { ...base.stats, ratingSum: base.stats.ratingSum + 15 },
    };
    const s = careerScore([good]);
    expect(s.parts.trophies).toBe(cfg.score.trophies['continental_major']);
    expect(s.parts.ratings).toBe(Math.round(15 * cfg.score.perLevel[0]!.ratingPoint));
  });

  it('assegna la fascia giusta, con la leggenda in cima', () => {
    expect(careerScore([]).tierId).toBe(cfg.tiers[0]!.id);
    const legendTrophies = Array.from(
      { length: Math.ceil(cfg.tiers.at(-1)!.min / cfg.score.trophies['continental_major']!) },
      () => 'continental_major',
    );
    const legend = careerScore([season({ level: 1, trophies: legendTrophies })]);
    expect(isLegend(legend)).toBe(true);
    expect(legend.tierKey).toBe(`career.tiers.${cfg.tiers.at(-1)!.id}`);
  });

  it("calcola i totali e l'esordio in massima serie", () => {
    const t = careerTotals([
      season({ level: 3, age: 19 }),
      season({ level: 1, age: 23, trophies: ['L1'] }),
      season({ level: 1, age: 24, apps: 0 }),
    ]);
    expect(t.topLevelDebutAge).toBe(23);
    expect(t.topLevelSeasons).toBe(1);
    expect(t.appearances).toBe(60);
    expect(t.trophies).toEqual(['L1']);
    expect(t.averageRating).toBe(cfg.score.baseRating);
  });
});
