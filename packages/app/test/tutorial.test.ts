import { describe, expect, it } from 'vitest';
import {
  parseTutorial,
  TIP_IDS,
  TIPS,
  tipVisible,
  type TutorialData,
} from '../src/app/core/tutorial';

describe('settimana guidata', () => {
  it('ogni consiglio dipende solo da consigli che esistono e vengono prima', () => {
    TIP_IDS.forEach((id, i) => {
      for (const prev of TIPS[id] as readonly string[]) {
        expect(TIP_IDS.indexOf(prev as (typeof TIP_IDS)[number])).toBeGreaterThanOrEqual(0);
        expect(TIP_IDS.indexOf(prev as (typeof TIP_IDS)[number])).toBeLessThan(i);
      }
    });
  });

  it('mostra un consiglio solo nello slot della guida, dopo i precedenti', () => {
    const data: TutorialData = { slot: 2, seen: [] };
    expect(tipVisible(data, 2, 'week.welcome')).toBe(true);
    expect(tipVisible(data, 1, 'week.welcome')).toBe(false);
    expect(tipVisible(data, 2, 'week.condition')).toBe(false);
    expect(tipVisible(null, 2, 'week.welcome')).toBe(false);
    const later: TutorialData = { slot: 2, seen: ['week.welcome'] };
    expect(tipVisible(later, 2, 'week.welcome')).toBe(false);
    expect(tipVisible(later, 2, 'week.condition')).toBe(true);
    // I consigli delle altre schermate non aspettano quelli della settimana.
    expect(tipVisible(data, 2, 'event.choice')).toBe(true);
  });

  it('scarta dati rovinati e consigli sconosciuti', () => {
    expect(parseTutorial(null)).toBeNull();
    expect(parseTutorial('non json')).toBeNull();
    expect(parseTutorial('{"slot":"a","seen":[]}')).toBeNull();
    expect(parseTutorial('{"slot":1,"seen":["week.welcome","vecchio"]}')).toEqual({
      slot: 1,
      seen: ['week.welcome'],
    });
  });
});
