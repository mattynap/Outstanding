import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Crest } from '@outstanding/engine';
import { CREST_H, CREST_W, SYMBOL_SIZE, crestPixels, pixRects } from './pixel-crest';
import { symbolPath } from './symbols';

const masks = new Map<string, Uint8Array>();
// Il simbolo si rasterizza 4 volte più grande e poi si riduce: a 10×10 diretto le punte sparirebbero.
const SUPER = 4;

/** Maschera 10×10 del simbolo araldico (1 = pieno), calcolata una volta per id. */
export function symbolMask(id: string): Uint8Array {
  const cached = masks.get(id);
  if (cached) return cached;
  const mask = new Uint8Array(SYMBOL_SIZE * SYMBOL_SIZE);
  const side = SYMBOL_SIZE * SUPER;
  const ctx =
    typeof document === 'undefined'
      ? null
      : Object.assign(document.createElement('canvas'), { width: side, height: side }).getContext(
          '2d',
          { willReadFrequently: true },
        );
  if (ctx) {
    ctx.scale(side / 24, side / 24);
    ctx.fill(new Path2D(symbolPath(id)));
    const alpha = ctx.getImageData(0, 0, side, side).data;
    for (let y = 0; y < SYMBOL_SIZE; y++)
      for (let x = 0; x < SYMBOL_SIZE; x++) {
        let sum = 0;
        for (let dy = 0; dy < SUPER; dy++)
          for (let dx = 0; dx < SUPER; dx++)
            sum += alpha[((y * SUPER + dy) * side + x * SUPER + dx) * 4 + 3]!;
        mask[y * SYMBOL_SIZE + x] = sum / (SUPER * SUPER) >= 128 ? 1 : 0;
      }
  }
  masks.set(id, mask);
  return mask;
}

/** Stemma del club in pixel, dai dati generati dal motore (forma, colori, simbolo, iniziali). */
@Component({
  selector: 'app-crest',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="(size() * h) / w"
      [attr.viewBox]="'0 0 ' + w + ' ' + h"
      shape-rendering="crispEdges"
      [attr.role]="label() ? 'img' : null"
      [attr.aria-label]="label() || null"
      [attr.aria-hidden]="label() ? null : 'true'"
    >
      @for (r of rects(); track $index) {
        <rect [attr.x]="r.x" [attr.y]="r.y" [attr.width]="r.w" height="1" [attr.fill]="r.fill" />
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: 0 0 auto;
    }
  `,
})
export class CrestComponent {
  readonly crest = input.required<Crest>();
  readonly size = input(40);
  /** Testo alternativo; vuoto = decorativo. */
  readonly label = input('');

  protected readonly w = CREST_W;
  protected readonly h = CREST_H;
  /** Sotto i 32 px le iniziali non si leggerebbero: resta solo il simbolo, più in basso. */
  protected readonly rects = computed(() => {
    const c = this.crest();
    const shown = this.size() >= 32 ? c : { ...c, initials: '' };
    return pixRects(crestPixels(shown, symbolMask(c.symbol)));
  });
}
