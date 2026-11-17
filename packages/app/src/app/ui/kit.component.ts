import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Kit } from '@outstanding/engine';
import { KIT_H, KIT_W, kitPixels, pixRects } from './pixel-crest';

/** Maglia del club in pixel: colori e motivo (tinta unita, strisce verticali od orizzontali, banda). */
@Component({
  selector: 'app-kit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      [attr.viewBox]="viewBox"
      shape-rendering="crispEdges"
      aria-hidden="true"
    >
      @for (r of rects(); track $index) {
        <rect [attr.x]="r.x" [attr.y]="r.y" [attr.width]="r.w" height="1" [attr.fill]="r.fill" />
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
  `,
})
export class KitComponent {
  readonly kit = input.required<Kit>();
  readonly size = input(48);
  // Riquadro quadrato come la maglia vettoriale di prima, così le pagine non cambiano misure.
  protected readonly viewBox = `0 ${-(KIT_W - KIT_H) / 2} ${KIT_W} ${KIT_W}`;
  protected readonly rects = computed(() => pixRects(kitPixels(this.kit())));
}
