import {
  type AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  NgZone,
  type OnDestroy,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '../core/i18n.service';
import type { StageController } from '../scenes/create-stage';
import type { StageModel } from '../scenes/stage-model';

@Component({
  selector: 'app-game-stage',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="frame" role="img" [attr.aria-label]="label()">
      <div #surface class="surface" aria-hidden="true"></div>
      @if (!loaded()) {
        <div class="fallback" aria-hidden="true"><i></i><b></b><span>●</span></div>
      }
      <span class="live">{{ 'ui.stage.live' | t }}</span>
      @if (fps() > 0) {
        <span class="fps">{{ fps() }} FPS</span>
      }
    </div>
    @if (failed()) {
      <p class="fallback-note" role="status">{{ 'ui.stage.fallback' | t }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
    .frame {
      position: relative;
      aspect-ratio: 5/3;
      background: #101c28;
      overflow: hidden;
      border: 1px solid var(--o-border-strong);
      border-radius: 8px;
      isolation: isolate;
    }
    .surface {
      position: absolute;
      inset: 0;
    }
    .surface:empty {
      visibility: hidden;
    }
    .live,
    .fps {
      position: absolute;
      top: 10px;
      padding: 4px 7px;
      font: 700 10px var(--o-font-body);
      letter-spacing: 1.2px;
      background: #101c28de;
      color: #f4e8cb;
      pointer-events: none;
    }
    .live {
      left: 10px;
      border-left: 3px solid var(--o-accent);
    }
    .fps {
      right: 10px;
      color: #a4c8ad;
    }
    .fallback {
      position: absolute;
      inset: 20% 0 0;
      background: repeating-linear-gradient(90deg, #277550 0 12.5%, #2b8057 12.5% 25%);
    }
    .fallback i {
      position: absolute;
      inset: 10%;
      border: 2px solid #b7d4b1;
    }
    .fallback b {
      position: absolute;
      left: 50%;
      top: 10%;
      height: 80%;
      border-left: 2px solid #b7d4b1;
    }
    .fallback span {
      position: absolute;
      left: 65%;
      top: 48%;
      color: #f2c555;
    }
    .fallback-note {
      font-size: 12px;
      color: var(--o-text-muted);
      margin: 8px 0 0;
    }
  `,
})
export class GameStageComponent implements AfterViewInit, OnDestroy {
  readonly model = input.required<StageModel>();
  readonly label = input('');
  readonly active = input(true);
  private readonly surface = viewChild.required<ElementRef<HTMLElement>>('surface');
  private readonly zone = inject(NgZone);
  protected readonly loaded = signal(false);
  protected readonly failed = signal(false);
  protected readonly fps = signal(0);
  private controller: StageController | undefined;
  private disposed = false;
  private metricsTimer: ReturnType<typeof setInterval> | undefined;
  private readonly motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly visibility = () => this.controller?.pause(document.hidden || !this.active());
  private readonly motionChange = () => this.controller?.show(this.model(), this.motion.matches);

  constructor() {
    effect(() => {
      const model = this.model();
      this.controller?.show(model, this.motion.matches);
    });
    effect(() => {
      const active = this.active();
      this.controller?.pause(!active || document.hidden);
    });
  }
  ngAfterViewInit(): void {
    document.addEventListener('visibilitychange', this.visibility);
    this.motion.addEventListener('change', this.motionChange);
    void this.boot();
  }
  private async boot(): Promise<void> {
    try {
      const { createStage } = await import('../scenes/create-stage');
      if (this.disposed) return;
      this.zone.runOutsideAngular(() => {
        this.controller = createStage(
          this.surface().nativeElement,
          this.model(),
          this.motion.matches,
        );
      });
      this.loaded.set(true);
      this.metricsTimer = setInterval(() => {
        if (this.active() && !document.hidden) this.fps.set(this.controller?.fps() ?? 0);
      }, 1000);
      this.visibility();
    } catch {
      if (!this.disposed) this.failed.set(true);
    }
  }
  ngOnDestroy(): void {
    this.disposed = true;
    document.removeEventListener('visibilitychange', this.visibility);
    this.motion.removeEventListener('change', this.motionChange);
    clearInterval(this.metricsTimer);
    this.controller?.destroy();
  }
}
