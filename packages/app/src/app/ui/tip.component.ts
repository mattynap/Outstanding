import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { GameService } from '../core/game.service';
import { TranslatePipe } from '../core/i18n.service';
import { TutorialService, type TipId } from '../core/tutorial.service';

/**
 * Consiglio della settimana guidata, come una nota a margine del caporedattore appuntata sulla
 * pagina. Compare solo durante la guida e solo quando tocca a lui.
 */
@Component({
  selector: 'app-tip',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (shown()) {
      <aside class="tip" role="note" [attr.aria-label]="'ui.tutorial.label' | t">
        <svg class="clip" viewBox="0 0 16 36" aria-hidden="true">
          <path d="M5 34V9a3 3 0 0 1 6 0v21a5 5 0 0 1-10 0V6" />
        </svg>
        <span class="kicker">
          {{ 'ui.tutorial.kicker' | t: { n: step(), total: tutorial.total } }}
        </span>
        <h2 class="title">{{ 'ui.tutorial.tips.' + tip() + '.title' | t }}</h2>
        <p class="text">{{ 'ui.tutorial.tips.' + tip() + '.text' | t }}</p>
        @if (tip() === 'week.done') {
          <div class="actions">
            <button class="o-btn o-btn--small" type="button" (click)="keep()">
              {{ 'ui.tutorial.keep' | t }}
            </button>
            <button class="o-btn o-btn--small on-paper" type="button" (click)="restart()">
              {{ 'ui.tutorial.restart' | t }}
            </button>
          </div>
        } @else {
          <div class="actions row">
            <button class="skip" type="button" (click)="skip()">
              {{ 'ui.tutorial.skip' | t }}
            </button>
            <button class="o-btn o-btn--small ok" type="button" (click)="ok()">
              {{ 'ui.tutorial.ok' | t }}
            </button>
          </div>
        }
      </aside>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .tip {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 14px 16px 12px 18px;
      border-radius: var(--o-radius-md);
      background: var(--o-paper);
      color: var(--o-ink);
      box-shadow: var(--o-shadow-paper);
      border-left: 4px solid var(--o-headline-red);
      transform: rotate(-0.6deg);
      animation: tip-in var(--o-normal) var(--o-ease) both;
    }
    .clip {
      position: absolute;
      top: -12px;
      right: 22px;
      width: 14px;
      height: 32px;
      fill: none;
      stroke: var(--o-ink-soft);
      stroke-width: 1.6;
      stroke-linecap: round;
    }
    .kicker {
      font-family: var(--o-font-display);
      font-weight: 700;
      font-size: 11px;
      letter-spacing: var(--o-tracking-label);
      text-transform: uppercase;
      color: var(--o-headline-red);
    }
    .title {
      margin: 0;
      font-family: var(--o-font-display);
      font-weight: 800;
      font-size: 21px;
      line-height: 1.05;
      text-transform: uppercase;
    }
    .text {
      margin: 0;
      font-size: 14px;
      line-height: 1.45;
      color: var(--o-ink-soft);
    }
    .actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 6px;
    }
    .actions.row {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }
    .ok {
      flex: 0 0 auto;
      width: auto;
      padding: 0 32px;
    }
    .on-paper {
      background: transparent;
      color: var(--o-ink);
      border: 1.5px solid var(--o-ink-soft);
      box-shadow: none;
    }
    .skip {
      min-height: var(--o-touch);
      padding: 0 4px;
      border: 0;
      background: none;
      font: inherit;
      font-size: 13px;
      color: var(--o-ink-muted);
      text-decoration: underline;
      text-underline-offset: 3px;
      white-space: nowrap;
      cursor: pointer;
    }
    @keyframes tip-in {
      from {
        opacity: 0;
        transform: translateY(8px) rotate(-0.6deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .tip {
        animation: none;
      }
    }
  `,
})
export class TipComponent {
  readonly tip = input.required<TipId>();

  protected readonly tutorial = inject(TutorialService);
  private readonly game = inject(GameService);
  private readonly router = inject(Router);

  protected readonly shown = computed(() => this.tutorial.visible(this.tip(), this.game.slot()));
  protected readonly step = computed(() => this.tutorial.progress() + 1);

  protected async ok(): Promise<void> {
    await this.tutorial.dismiss(this.tip());
  }

  protected async skip(): Promise<void> {
    await this.tutorial.stop();
  }

  protected async keep(): Promise<void> {
    await this.tutorial.stop();
  }

  /** Torna alla creazione nello stesso slot: la carriera di prova verrà sostituita. */
  protected async restart(): Promise<void> {
    const slot = this.game.slot();
    await this.tutorial.stop();
    await this.router.navigateByUrl(slot === null ? '/crea' : `/crea?slot=${slot}`);
  }
}
