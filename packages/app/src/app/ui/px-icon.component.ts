import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PX_ICONS, pxRuns, type PxCell, type PxIconName } from './px-icons';

// Il dettaglio scuro resta scuro in entrambi i temi: sta sempre sopra il colore corrente.
const FILL: Record<PxCell, string> = { '#': 'currentColor', o: '#0b1410', '+': '#ffffff' };

/** Icona pixel 16×16 dalle griglie di `px-icons.ts`; il colore viene da `color` del genitore. */
@Component({
  selector: 'app-px-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 16 16"
      shape-rendering="crispEdges"
      aria-hidden="true"
    >
      @for (r of runs(); track $index) {
        <rect
          [attr.x]="r.x"
          [attr.y]="r.y"
          [attr.width]="r.w"
          height="1"
          [attr.fill]="fill[r.c]"
          [attr.fill-opacity]="r.c === '+' ? 0.6 : null"
        />
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
    }
  `,
})
export class PxIconComponent {
  readonly name = input.required<PxIconName>();
  readonly size = input<16 | 24 | 32>(16);
  protected readonly fill = FILL;
  protected readonly runs = computed(() => pxRuns(PX_ICONS[this.name()]));
}
