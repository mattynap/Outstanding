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
    const top = careerScore([season({ level: 1 })], 'MID');
    const low = careerScore([season({ level: 6 })], 'MID');
    expect(top.total).toBeGreaterThan(low.total);
    const f = cfg.score.roleFactors.MID;
    expect(top.parts.appearances).toBe(Math.round(30 * cfg.score.perLevel[0]!.appearance * f));
  });

  it('somma trofei e voti sopra la media', () => {
    const base = season({ level: 1 });
    const good = {
      ...base,
      trophies: ['continental_major'],
      stats: { ...base.stats, ratingSum: base.stats.ratingSum + 15 },
    };
    const s = careerScore([good], 'MID');
    expect(s.parts.trophies).toBe(cfg.score.trophies['continental_major']);
    expect(s.parts.ratings).toBe(
      Math.round(15 * cfg.score.perLevel[0]!.ratingPoint * cfg.score.roleFactors.MID),
    );
  });

  it('corregge il rendimento per ruolo ma non i trofei', () => {
    const h = [season({ level: 1, trophies: ['L1'] })];
    const gk = careerScore(h, 'GK');
    const att = careerScore(h, 'ATT');
    expect(gk.parts.trophies).toBe(att.parts.trophies);
    const ratio = cfg.score.roleFactors.GK / cfg.score.roleFactors.ATT;
    expect(gk.parts.appearances / att.parts.appearances).toBeCloseTo(ratio, 1);
  });

  it('assegna la fascia giusta, con la leggenda in cima', () => {
    expect(careerScore([], 'MID').tierId).toBe(cfg.tiers[0]!.id);
    const legendTrophies = Array.from(
      { length: Math.ceil(cfg.tiers.at(-1)!.min / cfg.score.trophies['continental_major']!) },
      () => 'continental_major',
    );
    const legend = careerScore([season({ level: 1, trophies: legendTrophies })], 'MID');
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
