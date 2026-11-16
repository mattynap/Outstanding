import { describe, expect, it } from 'vitest';
import calendarJson from '../data/calendar.json';
import playerJson from '../data/player.json';
import ratingsJson from '../data/ratings.json';
import { defaultConfig, parseConfig } from '../src/index';

const raw = () => ({
  ratings: JSON.parse(JSON.stringify(ratingsJson)) as typeof ratingsJson,
  player: JSON.parse(JSON.stringify(playerJson)) as typeof playerJson,
  calendar: JSON.parse(JSON.stringify(calendarJson)) as typeof calendarJson,
});

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
    const bad = raw() as { ratings: { roleWeights: { GK: Record<string, number> } } };
    delete bad.ratings.roleWeights.GK['goalkeeping'];
    expect(() => parseConfig(bad as Parameters<typeof parseConfig>[0])).toThrow(/ratings\.json/);
  });
});
