import { describe, expect, it } from 'vitest';
import { checkContent, defaultContent, parseContent } from '../src/index';

describe('content', () => {
  it('default content passes all cross checks', () => {
    expect(checkContent(defaultContent)).toEqual([]);
  });

  it('rejects malformed data with a readable error', () => {
    expect(() =>
      parseContent({ names: { firstNames: [], lastNames: [] }, traits: [], i18n: { it: {} } }),
    ).toThrow(/names\.json/);
  });

  it('reports missing text keys', () => {
    const broken = { ...defaultContent, i18n: { it: {} } };
    expect(checkContent(broken).some((e) => e.includes('missing text key'))).toBe(true);
  });
});
