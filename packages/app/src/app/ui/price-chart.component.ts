import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

const W = 300;
const H = 80;
const PAD = 6;

/**
 * Andamento di un prezzo nelle ultime settimane: una sola linea (il titolo la nomina), area
 * leggera, punto finale evidenziato. Toccando o passando sopra si legge il prezzo di quella
 * settimana.
 */
@Component({
  selector: 'app-price-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="chart"
      (pointermove)="hover($event)"
      (pointerdown)="hover($event)"
      (pointerleave)="active.set(null)"
    >
      <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" preserveAspectRatio="none" aria-hidden="true">
        <line
          [attr.x1]="0"
          [attr.x2]="w"
          [attr.y1]="baseY()"
          [attr.y2]="baseY()"
          class="base"
          vector-effect="non-scaling-stroke"
        />
        <path [attr.d]="area()" class="area" />
        <path [attr.d]="line()" class="line" vector-effect="non-scaling-stroke" />
        @if (active(); as a) {
          <line
            [attr.x1]="a.x"
            [attr.x2]="a.x"
            y1="0"
            [attr.y2]="h"
            class="cross"
            vector-effect="non-scaling-stroke"
          />
        }
      </svg>
      @if (last(); as l) {
        <span class="dot" [style.left.%]="(l.x / w) * 100" [style.top.%]="(l.y / h) * 100"></span>
      }
      @if (active(); as a) {
        <span
          class="dot hot"
          [style.left.%]="(a.x / w) * 100"
          [style.top.%]="(a.y / h) * 100"
        ></span>
        <span class="tip" [style.left.%]="clampPct((a.x / w) * 100)">
          <b>{{ format()(a.value) }}</b> · {{ weeksAgoLabel()(a.ago) }}
        </span>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .chart {
      position: relative;
      height: 80px;
      touch-action: pan-y;
    }
    svg {
      width: 100%;
      height: 100%;
      display: block;
      overflow: visible;
    }
    .base {
      stroke: var(--o-border);
      stroke-width: 1;
      stroke-dasharray: 3 3;
    }
    .area {
      fill: var(--o-accent);
      opacity: 0.12;
    }
    .line {
      fill: none;
      stroke: var(--o-accent);
      stroke-width: 2;
      stroke-linejoin: round;
      stroke-linecap: round;
    }
    .cross {
      stroke: var(--o-text-muted);
      stroke-width: 1;
    }
    .dot {
      position: absolute;
      width: 8px;
      height: 8px;
      margin: -4px 0 0 -4px;
      border-radius: 50%;
      background: var(--o-accent);
      box-shadow: 0 0 0 2px var(--o-surface);
      pointer-events: none;
    }
    .tip {
      position: absolute;
      top: -30px;
      transform: translateX(-50%);
      padding: 3px 8px;
      border-radius: 6px;
      background: var(--o-surface-raised);
      border: 1px solid var(--o-border);
      font-size: 12px;
      color: var(--o-text-soft);
      white-space: nowrap;
      pointer-events: none;
      font-variant-numeric: tabular-nums;
    }
    .tip b {
      color: var(--o-text);
    }
  `,
})
export class PriceChartComponent {
  /** Prezzi in ordine di tempo, l'ultimo è quello attuale. */
  readonly values = input.required<readonly number[]>();
  /** Prezzo di riferimento (linea tratteggiata), per esempio quello di acquisto. */
  readonly reference = input<number | null>(null);
  readonly format = input<(v: number) => string>((v) => v.toFixed(2));
  readonly weeksAgoLabel = input<(n: number) => string>((n) => `-${n}`);

  protected readonly w = W;
  protected readonly h = H;
  protected readonly active = signal<{ x: number; y: number; value: number; ago: number } | null>(
    null,
  );

  private readonly scale = computed(() => {
    const v = this.values();
    const ref = this.reference();
    const all = ref === null ? v : [...v, ref];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const span = max - min || 1;
    const n = Math.max(1, v.length - 1);
    return {
      x: (i: number) => (i / n) * W,
      y: (val: number) => PAD + (1 - (val - min) / span) * (H - 2 * PAD),
    };
  });

  protected readonly points = computed(() => {
    const s = this.scale();
    return this.values().map((v, i) => ({ x: s.x(i), y: s.y(v), value: v }));
  });
  protected readonly line = computed(() =>
    this.points()
      .map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' '),
  );
  protected readonly area = computed(() => {
    const pts = this.points();
    if (pts.length < 2) return '';
    return `${this.line()} L${W} ${H} L0 ${H}Z`;
  });
  protected readonly last = computed(() => this.points().at(-1) ?? null);
  protected readonly baseY = computed(() => {
    const ref = this.reference() ?? this.values()[0] ?? 0;
    return this.scale().y(ref);
  });

  protected hover(e: PointerEvent): void {
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const pts = this.points();
    if (pts.length === 0 || rect.width === 0) return;
    const i = Math.round(((e.clientX - rect.left) / rect.width) * (pts.length - 1));
    const idx = Math.min(pts.length - 1, Math.max(0, i));
    const p = pts[idx]!;
    this.active.set({ ...p, ago: pts.length - 1 - idx });
  }

  protected clampPct(v: number): number {
    return Math.min(82, Math.max(18, v));
  }
}
