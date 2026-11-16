import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Kit } from '@outstanding/engine';

let nextId = 0;

/** Maglia del club: colori e motivo (tinta unita, strisce verticali od orizzontali, banda). */
@Component({
  selector: 'app-kit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 60 60" aria-hidden="true">
      <defs>
        <clipPath [attr.id]="clipId">
          <path [attr.d]="shirt" />
        </clipPath>
      </defs>
      <path [attr.d]="shirt" [attr.fill]="kit().primary" />
      <g [attr.clip-path]="'url(#' + clipId + ')'" [attr.fill]="kit().secondary">
        @switch (kit().pattern) {
          @case ('vstripes') {
            @for (x of stripes; track x) {
              <rect [attr.x]="x" y="0" width="5" height="60" />
            }
          }
          @case ('hstripes') {
            @for (y of stripes; track y) {
              <rect x="0" [attr.y]="y + 4" width="60" height="5" />
            }
          }
          @case ('sash') {
            <path d="M8 4h12L56 56H44z" />
          }
        }
      </g>
      <path [attr.d]="shirt" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="1.2" />
      <path
        d="M24 6c2 3 4 4 6 4s4-1 6-4"
        fill="none"
        [attr.stroke]="kit().secondary"
        stroke-width="2"
      />
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
  protected readonly clipId = `kit-clip-${nextId++}`;
  protected readonly shirt =
    'M22 4L8 10 2 24l9 4 3-6v34h32V22l3 6 9-4-6-14L44 4c-2 4-8 6-14 6S24 8 22 4z';
  protected readonly stripes = [9, 19, 29, 39, 49];
}
