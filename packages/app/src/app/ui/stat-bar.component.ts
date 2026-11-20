import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { levelTone } from '../core/text';

/** Barra etichettata 0–100 (condizione, abilità). `tone` "auto" colora in base al valore. */
@Component({
  selector: 'app-stat-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      <span class="o-muted">{{ label() }}</span>
      <span class="value">
        {{ display() }}
        @if (delta()) {
          <span class="delta" [class.o-pos]="delta()! > 0" [class.o-neg]="delta()! < 0">{{
            deltaText()
          }}</span>
        }
      </span>
    </div>
    <div
      class="o-bar steps"
      role="meter"
      [attr.aria-label]="label()"
      aria-valuemin="0"
      aria-valuemax="100"
      [attr.aria-valuenow]="rounded()"
    >
      <div class="o-bar__fill" [class]="fillClass()" [style.width.%]="rounded()"></div>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }
    /* Dieci tacche pixel: il riempimento resta continuo (valore esatto), la maschera apre le
       fessure trasparenti, così la barra funziona su qualunque fondo. */
    .steps {
      height: 8px;
      border-radius: 0;
      -webkit-mask: repeating-linear-gradient(90deg, #000 0 calc(10% - 2px), transparent 0 10%);
      mask: repeating-linear-gradient(90deg, #000 0 calc(10% - 2px), transparent 0 10%);
    }
    .steps .o-bar__fill {
      border-radius: 0;
      transition: width var(--o-slow) steps(5, end);
    }
    @media (prefers-reduced-motion: reduce) {
      .steps .o-bar__fill {
        transition: none;
      }
    }
    .head {
      display: flex;
      justify-content: space-between;
      font-size: var(--o-text-sm);
    }
    .value {
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .delta {
      font-size: var(--o-text-xs);
      margin-left: 2px;
    }
  `,
})
export class StatBarComponent {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  readonly tone = input<'auto' | 'accent' | 'pos' | 'neg'>('accent');
  readonly delta = input<number | null>(null);

  protected readonly rounded = computed(() => Math.max(0, Math.min(100, Math.round(this.value()))));
  protected readonly display = computed(() => String(Math.round(this.value())));
  protected readonly deltaText = computed(() => {
    const d = this.delta() ?? 0;
    return d > 0 ? `+${Math.round(d)}` : `${Math.round(d)}`;
  });
  protected readonly fillClass = computed(() => {
    const tone = this.tone() === 'auto' ? levelTone(this.value()) : this.tone();
    if (tone === 'pos') return 'o-bar__fill o-bar__fill--pos';
    if (tone === 'neg') return 'o-bar__fill o-bar__fill--neg';
    return 'o-bar__fill';
  });
}
