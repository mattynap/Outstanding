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
});
