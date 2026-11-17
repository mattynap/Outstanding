import { describe, expect, it } from 'vitest';
import type { Crest, Kit } from '@outstanding/engine';
import { EMPTY, OUTLINE } from '../src/app/scenes/pix';
import { crestPixels, kitPixels, pixRects } from '../src/app/ui/pixel-crest';

const crest: Crest = {
  shape: 'shield',
  primary: '#1d4e89',
  secondary: '#f2b830',
  symbol: 'star',
  initials: 'RM',
};
const full = new Uint8Array(100).fill(1);

describe('stemmi e maglie in pixel', () => {
  it('è deterministico', () => {
    expect(crestPixels(crest, full).data).toEqual(crestPixels(crest, full).data);
  });

  it('griglie di 22×26 e 20×18', () => {
    const c = crestPixels(crest, full);
    const k = kitPixels({ primary: '#fff', secondary: '#000', pattern: 'solid' } as Kit);
    expect([c.w, c.h, k.w, k.h]).toEqual([22, 26, 20, 18]);
  });

  it('scudo, cerchio e ovale danno griglie diverse', () => {
    const shield = crestPixels(crest, full).data;
    const circle = crestPixels({ ...crest, shape: 'circle' }, full).data;
    const oval = crestPixels({ ...crest, shape: 'oval' }, full).data;
    expect(shield).not.toEqual(circle);
    expect(circle).not.toEqual(oval);
  });

  it('ha il contorno e usa i due colori', () => {
    const colors = new Set(crestPixels(crest, full).data);
    expect(colors).toContain(OUTLINE);
    expect(colors).toContain(0x1d4e89);
    expect(colors).toContain(0xf2b830);
  });

  it('i quattro motivi della maglia sono diversi', () => {
    const k = (pattern: Kit['pattern']) =>
      [...kitPixels({ primary: '#ffffff', secondary: '#000000', pattern }).data].join();
    const all = new Set(
      ['solid', 'vstripes', 'hstripes', 'sash'].map((p) => k(p as Kit['pattern'])),
    );
    expect(all.size).toBe(4);
  });

  it('pixRects copre tutti i pixel pieni', () => {
    const p = kitPixels({ primary: '#ffffff', secondary: '#000000', pattern: 'vstripes' });
    const filled = [...p.data].filter((c) => c !== EMPTY).length;
    expect(pixRects(p).reduce((s, r) => s + r.w, 0)).toBe(filled);
  });
});
