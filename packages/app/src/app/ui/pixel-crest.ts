import type { Crest, Kit } from '@outstanding/engine';
import { EMPTY, OUTLINE, Pix, css, glyphs, shade } from '../scenes/pix';

/**
 * Stemmi e maglie in pixel: stessa griglia e stesso contorno degli sprite Phaser, così lo stemma
 * dell'interfaccia è lo stesso che si vede nelle scene.
 */

export const CREST_W = 22;
export const CREST_H = 26;
export const KIT_W = 20;
export const KIT_H = 18;
/** Lato della maglia del simbolo araldico. */
export const SYMBOL_SIZE = 10;

const hex = (color: string): number => {
  const h = color.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  return parseInt(full, 16) || 0;
};

// Centro orizzontale tra i pixel 10 e 11: le forme restano simmetriche.
const CX = CREST_W / 2;

function insideCrest(shape: Crest['shape'], x: number, y: number): boolean {
  const px = x + 0.5 - CX;
  const py = y + 0.5;
  if (y < 1 || y > CREST_H - 2) return false;
  switch (shape) {
    case 'shield': {
      // Lati dritti fino a metà, poi la punta.
      const half = y <= 14 ? 10 : 10 - (y - 14) * 1.05;
      return Math.abs(px) < half;
    }
    case 'circle':
      return (px / 10) ** 2 + ((py - 13) / 10) ** 2 <= 1;
    default:
      return (px / 9.6) ** 2 + ((py - 13) / 12) ** 2 <= 1;
  }
}

export function crestPixels(crest: Crest, symbol: Uint8Array): Pix {
  const p = new Pix(CREST_W, CREST_H);
  const primary = hex(crest.primary);
  const secondary = hex(crest.secondary);
  const inside = (x: number, y: number) => insideCrest(crest.shape, x, y);

  for (let y = 0; y < CREST_H; y++)
    for (let x = 0; x < CREST_W; x++) {
      if (!inside(x, y)) continue;
      // Fascia di 2 pixel nel secondo colore lungo il bordo, come lo stemma vettoriale.
      const edge = [-2, -1, 1, 2].some((d) => !inside(x + d, y) || !inside(x, y + d));
      p.set(x, y, edge ? secondary : primary);
    }
  // Riflesso in alto a sinistra: dà volume senza sfumature.
  for (let y = 3; y < 9; y++) if (p.get(3, y) === primary) p.set(3, y, shade(primary, 1.25));

  const initials = crest.initials.trim();
  const showInitials = initials.length > 0;
  const sx = Math.round(CX - SYMBOL_SIZE / 2);
  const sy = showInitials ? 4 : 7;
  for (let y = 0; y < SYMBOL_SIZE; y++)
    for (let x = 0; x < SYMBOL_SIZE; x++)
      if (symbol[y * SYMBOL_SIZE + x] && inside(sx + x, sy + y)) p.set(sx + x, sy + y, secondary);

  if (showInitials) {
    const g = glyphs(initials, secondary);
    const ox = Math.round(CX - g.w / 2);
    const oy = 14;
    // Le iniziali si disegnano solo se stanno tutte dentro la forma senza toccare la fascia.
    let fits = true;
    for (let y = 0; y < g.h && fits; y++)
      for (let x = 0; x < g.w; x++)
        if (g.get(x, y) !== EMPTY && (p.get(ox + x, oy + y) !== primary || !inside(ox + x, oy + y)))
          fits = false;
    if (fits)
      for (let y = 0; y < g.h; y++)
        for (let x = 0; x < g.w; x++) {
          const c = g.get(x, y);
          if (c !== EMPTY) p.set(ox + x, oy + y, c);
        }
  }
  return p.outlined(OUTLINE);
}

/** Sagoma della maglia 20×18: righe come intervalli [da, a] inclusi. */
const SHIRT: readonly (readonly [number, number][])[] = [
  [
    [6, 7],
    [12, 13],
  ],
  [
    [4, 8],
    [11, 15],
  ],
  [[2, 17]],
  [[1, 18]],
  [[0, 18]],
  [[0, 19]],
  [
    [0, 3],
    [4, 15],
    [16, 19],
  ],
  [
    [1, 2],
    [4, 15],
    [17, 18],
  ],
  [[4, 15]],
  [[4, 15]],
  [[4, 15]],
  [[4, 15]],
  [[4, 15]],
  [[4, 15]],
  [[4, 15]],
  [[4, 15]],
];

export function kitPixels(kit: Kit): Pix {
  const p = new Pix(KIT_W, KIT_H);
  const primary = hex(kit.primary);
  const secondary = hex(kit.secondary);
  const top = 1;
  const pattern = (x: number, y: number): boolean => {
    switch (kit.pattern) {
      case 'vstripes':
        return x % 4 >= 2;
      case 'hstripes':
        return y >= 4 && (y - 4) % 4 >= 2;
      case 'sash':
        return Math.abs(x - 3 - y) <= 1;
      default:
        return false;
    }
  };
  SHIRT.forEach((spans, row) => {
    const y = row + top;
    for (const [a, b] of spans)
      for (let x = a; x <= b; x++) p.set(x, y, pattern(x, row) ? secondary : primary);
  });
  // Colletto e bordi delle maniche nel secondo colore.
  for (const x of [8, 9, 10, 11]) p.set(x, top + 1, secondary);
  p.set(9, top + 2, secondary);
  p.set(10, top + 2, secondary);
  for (const x of [0, 1, 2, 17, 18, 19])
    if (p.get(x, top + 6) !== EMPTY) p.set(x, top + 6, secondary);
  // Ombra sul lato destro del busto.
  for (let y = top + 8; y < top + SHIRT.length; y++) {
    const c = p.get(15, y);
    if (c !== EMPTY) p.set(15, y, shade(c, 0.8));
  }
  return p.outlined(OUTLINE);
}

/** Rettangoli SVG di una griglia: pixel orizzontali dello stesso colore uniti in uno. */
export function pixRects(p: Pix): { x: number; y: number; w: number; fill: string }[] {
  const rects: { x: number; y: number; w: number; fill: string }[] = [];
  for (let y = 0; y < p.h; y++) {
    let x = 0;
    while (x < p.w) {
      const c = p.get(x, y);
      if (c === EMPTY) {
        x++;
        continue;
      }
      let w = 1;
      while (x + w < p.w && p.get(x + w, y) === c) w++;
      rects.push({ x, y, w, fill: css(c) });
      x += w;
    }
  }
  return rects;
}
