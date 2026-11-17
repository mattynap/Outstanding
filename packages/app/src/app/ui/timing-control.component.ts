import {
  ChangeDetectionStrategy,
  Component,
  NgZone,
  type OnDestroy,
  afterNextRender,
  inject,
  output,
  signal,
} from '@angular/core';
import { TranslatePipe } from '../core/i18n.service';

@Component({
  selector: 'app-timing-control',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="timing">
      <p>{{ 'ui.stage.timingHint' | t }}</p>
      <button class="target" type="button" (click)="stop()" [attr.aria-label]="'ui.stage.stop' | t">
        <span class="sweet"></span><span class="cursor" [style.left.%]="position() * 100"></span>
      </button>
      <div class="o-row">
        <button class="o-btn" type="button" (click)="stop()">{{ 'ui.stage.stop' | t }}</button>
        <button class="o-btn o-btn--ghost" type="button" (click)="choose(0.5)">
          {{ 'ui.stage.neutral' | t }}
        </button>
      </div>
    </section>
  `,
  styles: `
    .timing {
      display: grid;
      gap: 12px;
    }
    .timing p {
      margin: 0;
      font-size: 13px;
      color: var(--o-text-muted);
    }
    .target {
      width: 100%;
      height: 56px;
      border: 1px solid var(--o-border-strong);
      border-radius: 8px;
      background: #152e2b;
      position: relative;
      overflow: hidden;
      touch-action: manipulation;
      cursor: pointer;
    }
    .sweet {
      position: absolute;
      inset: 0 36%;
      background: #c4d99b;
      border-inline: 2px solid #f2c555;
    }
    .cursor {
      position: absolute;
      width: 5px;
      top: 5px;
      bottom: 5px;
      background: #fff6dd;
      transform: translateX(-50%);
      box-shadow: 0 0 0 2px #14241d;
    }
    .o-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
    }
    .o-btn {
      font-size: 14px;
      padding: 10px;
    }
  `,
})
export class TimingControlComponent implements OnDestroy {
  readonly decided = output<number>();
  protected readonly position = signal(0.5);
  private readonly reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private frame = 0;
  private ended = false;
  private readonly zone = inject(NgZone);
  constructor() {
    afterNextRender(() => {
      const started = performance.now();
      if (this.reduced) return;
      this.zone.runOutsideAngular(() => {
        const tick = (now: number) => {
          if (this.ended) return;
          this.position.set((Math.sin((now - started) / 520) + 1) / 2);
          this.frame = requestAnimationFrame(tick);
        };
        this.frame = requestAnimationFrame(tick);
      });
    });
  }
  protected stop(): void {
    this.choose(this.reduced ? 0.5 : 1 - Math.abs(this.position() - 0.5) * 2);
  }
  protected choose(quality: number): void {
    if (this.ended) return;
    this.ended = true;
    cancelAnimationFrame(this.frame);
    this.decided.emit(quality);
  }
  ngOnDestroy(): void {
    this.ended = true;
    cancelAnimationFrame(this.frame);
  }
}
