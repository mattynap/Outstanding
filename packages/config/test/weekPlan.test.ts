import { describe, expect, it } from 'vitest';
import { defaultConfig, parseConfig, rawDefaultConfig } from '../src/index';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const raw = (): any => JSON.parse(JSON.stringify(rawDefaultConfig));

describe('config: settimana a due binari', () => {
  const p = defaultConfig.progression;

  it('espone i carichi con i valori della spec', () => {
    expect(p.loads.push.freshnessCap).toBe(70);
    expect(p.loads.balanced.sessions).toBe(1);
    expect(p.loads.recovery.healChance).toBe(0.5);
    expect(p.loads.rest.healChance).toBeUndefined();
    expect(p.life.leisure.moraleRecoveryFactor).toBe(2);
    expect(p.life.party.discipline).toBe(-1);
    expect(p.skipWeekPlanV4.load).toBe('balanced');
    expect(p.injuries.freshnessCurve).toEqual({ at100: 0.6, at0: 2 });
    expect(p.preview.riskBands).toEqual({ medium: 0.15, high: 0.3 });
  });

  it('espone i parametri nuovi di match', () => {
    const m = defaultConfig.match;
    expect(m.moments.freshnessWeight).toBe(0.06);
    expect(m.selection.freshnessFrom).toBe(60);
    expect(m.selection.freshnessWeight).toBe(0.1);
  });

  it('rifiuta freschezza oltre 100 e sedute negative', () => {
    const cap = raw();
    cap.progression.loads.push.freshnessCap = 101;
    expect(() => parseConfig(cap)).toThrow(/progression\.json/);
    const neg = raw();
    neg.progression.loads.balanced.sessions = -1;
    expect(() => parseConfig(neg)).toThrow(/progression\.json/);
  });
});
