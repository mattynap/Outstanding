import { describe, expect, it } from 'vitest';
import { PX_ICONS, pxRuns } from '../src/app/ui/px-icons';

describe('icone pixel', () => {
  it('ogni icona è 16×16 con soli caratteri ammessi', () => {
    for (const rows of Object.values(PX_ICONS)) {
      expect(rows).toHaveLength(16);
      for (const r of rows) expect(r).toMatch(/^[.#o+]{16}$/);
    }
  });

  it('ci sono tutte e 13 le icone e nessuna è vuota', () => {
    expect(Object.keys(PX_ICONS)).toHaveLength(13);
    for (const rows of Object.values(PX_ICONS)) expect(rows.join('')).toMatch(/#/);
  });

  it('pxRuns unisce i pixel adiacenti uguali', () => {
    expect(pxRuns(['##.o', '....'])).toEqual([
      { x: 0, y: 0, w: 2, c: '#' },
      { x: 3, y: 0, w: 1, c: 'o' },
    ]);
  });
});
