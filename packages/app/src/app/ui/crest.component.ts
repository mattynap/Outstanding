import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Crest } from '@outstanding/engine';
import { symbolPath } from './symbols';

/** Stemma del club disegnato dai dati generati dal motore (forma, colori, simbolo, iniziali). */
@Component({
  selector: 'app-crest',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="(size() * 52) / 44"
      viewBox="0 0 44 52"
      [attr.role]="label() ? 'img' : null"
      [attr.aria-label]="label() || null"
      [attr.aria-hidden]="label() ? null : 'true'"
    >
      @switch (crest().shape) {
        @case ('shield') {
          <path
            [attr.d]="shield"
            [attr.fill]="crest().primary"
            [attr.stroke]="crest().secondary"
            stroke-width="2.5"
          />
        }
        @case ('circle') {
          <circle
            cx="22"
            cy="26"
            r="20"
            [attr.fill]="crest().primary"
            [attr.stroke]="crest().secondary"
            stroke-width="2.5"
          />
        }
        @default {
          <ellipse
            cx="22"
            cy="26"
            rx="18"
            ry="23"
            [attr.fill]="crest().primary"
            [attr.stroke]="crest().secondary"
            stroke-width="2.5"
          />
        }
      }
      <g [attr.transform]="symbolTransform()" [attr.fill]="crest().secondary">
        <path [attr.d]="symbol()" />
      </g>
      @if (showInitials()) {
        <text
          x="22"
          y="42"
          text-anchor="middle"
          font-family="Barlow Condensed, sans-serif"
          font-weight="800"
          font-size="10"
          letter-spacing="0.5"
          [attr.fill]="crest().secondary"
        >
          {{ crest().initials }}
        </text>
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

  protected readonly shield = 'M3 3h38v23c0 12-8.5 20-19 23C11.5 46 3 38 3 26z';
  protected readonly symbol = computed(() => symbolPath(this.crest().symbol));
  protected readonly showInitials = computed(() => this.size() >= 32);
  /** Il simbolo sta più in alto quando sotto ci sono le iniziali. */
  protected readonly symbolTransform = computed(() =>
    this.showInitials() ? 'translate(13 9) scale(0.75)' : 'translate(11 15) scale(0.92)',
  );
}
