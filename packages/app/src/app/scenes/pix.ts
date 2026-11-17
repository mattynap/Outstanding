/**
 * Pixel art disegnata dal codice: ogni sprite è una griglia di pixel con contorno scuro calcolato,
 * così i colori cambiano senza ridisegnare nulla e non servono asset esterni. Niente Phaser qui:
 * la stessa griglia serve alle scene e agli SVG dell'interfaccia (stemmi, maglie).
 */

export const OUTLINE = 0x1a1423;
export const EMPTY = -1;

export function shade(color: number, f: number): number {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return (c((color >> 16) & 255) << 16) | (c((color >> 8) & 255) << 8) | c(color & 255);
}

export const css = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

/** Griglia di pixel con colori interi; -1 è trasparente. */
export class Pix {
  readonly data: Int32Array;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Int32Array(w * h).fill(EMPTY);
  }
  set(x: number, y: number, c: number): void {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.data[y * this.w + x] = c;
  }
  get(x: number, y: number): number {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.data[y * this.w + x]! : EMPTY;
  }
  line(x0: number, y0: number, x1: number, y1: number, color: (t: number) => number, thick = 1) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(x0 + (x1 - x0) * t);
      const y = Math.round(y0 + (y1 - y0) * t);
      for (let k = 0; k < thick; k++) this.set(x + k, y, color(t));
    }
  }
  /** Contorno di un pixel attorno alle parti piene: è ciò che dà l'aspetto "sprite". */
  outlined(color = OUTLINE): Pix {
    const out = new Pix(this.w, this.h);
    out.data.set(this.data);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y) !== EMPTY) continue;
        const near =
          this.get(x - 1, y) !== EMPTY ||
          this.get(x + 1, y) !== EMPTY ||
          this.get(x, y - 1) !== EMPTY ||
          this.get(x, y + 1) !== EMPTY;
        if (near) out.set(x, y, color);
      }
    return out;
  }
  blit(ctx: CanvasRenderingContext2D, ox: number, oy: number, tint?: number): void {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const c = this.get(x, y);
        if (c === EMPTY) continue;
        ctx.fillStyle = css(tint ?? c);
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
  }
}

/* ------------------------------------------------------------------ carattere pixel */

const GLYPHS: Record<string, string[]> = {
  A: ['.##.', '#..#', '####', '#..#', '#..#'],
  B: ['###.', '#..#', '###.', '#..#', '###.'],
  C: ['.###', '#...', '#...', '#...', '.###'],
  D: ['###.', '#..#', '#..#', '#..#', '###.'],
  E: ['####', '#...', '###.', '#...', '####'],
  F: ['####', '#...', '###.', '#...', '#...'],
  G: ['.###', '#...', '#.##', '#..#', '.###'],
  H: ['#..#', '#..#', '####', '#..#', '#..#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  L: ['#...', '#...', '#...', '#...', '####'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  O: ['.##.', '#..#', '#..#', '#..#', '.##.'],
  P: ['###.', '#..#', '###.', '#...', '#...'],
  R: ['###.', '#..#', '###.', '#.#.', '#..#'],
  S: ['.###', '#...', '.##.', '...#', '###.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#..#', '#..#', '#..#', '#..#', '.##.'],
  V: ['#..#', '#..#', '#..#', '.##.', '.##.'],
  J: ['...#', '...#', '...#', '#..#', '.##.'],
  K: ['#..#', '#.#.', '##..', '#.#.', '#..#'],
  Q: ['.##.', '#..#', '#..#', '#.#.', '.#.#'],
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#..#', '#..#', '.##.', '#..#', '#..#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['####', '..#.', '.#..', '#...', '####'],
  '!': ['#', '#', '#', '.', '#'],
  ' ': ['..', '..', '..', '..', '..'],
};

export function glyphs(text: string, color: number, low = color): Pix {
  const chars = [...text.toUpperCase()].map((ch) => GLYPHS[ch] ?? GLYPHS[' ']!);
  const width = chars.reduce((sum, g) => sum + g[0]!.length + 1, 0) - 1;
  const p = new Pix(width + 2, 7);
  let x = 1;
  for (const g of chars) {
    g.forEach((row, y) => {
      for (let c = 0; c < row.length; c++)
        if (row[c] === '#') p.set(x + c, y + 1, y > 2 ? low : color);
    });
    x += g[0]!.length + 1;
  }
  return p;
}
