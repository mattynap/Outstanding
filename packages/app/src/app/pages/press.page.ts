import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronBack, mic } from 'ionicons/icons';
import { getPressConference, type PressView, type Tone } from '@outstanding/engine';
import { GameService } from '../core/game.service';
import { I18nService, TranslatePipe } from '../core/i18n.service';
import { formatDelta } from '../core/text';
import { ToastService } from '../core/toast.service';

/**
 * Conferenza stampa: una domanda alla volta su un foglio di giornale, tre toni di risposta. Alla
 * fine il titolo del giorno dopo e, prima di una partita, l'effetto sui momenti chiave.
 */
@Component({
  selector: 'app-press',
  imports: [IonContent, IonIcon, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-content class="o-page">
      <main class="o-wrap o-enter">
        <header class="top">
          <button
            class="o-icon-btn"
            type="button"
            (click)="leave()"
            [attr.aria-label]="'ui.common.back' | t"
          >
            <ion-icon name="chevron-back" aria-hidden="true"></ion-icon>
          </button>
          <h1 class="o-display title">{{ 'ui.press.title' | t }}</h1>
        </header>

        @if (conf(); as c) {
          <div class="mics" aria-hidden="true">
            @for (m of [0, 1, 2, 3, 4]; track m) {
              <span class="mic o-px" [style.--i]="m"><ion-icon name="mic"></ion-icon></span>
            }
          </div>
          <span class="o-label occasion">{{ 'ui.press.kind.' + c.kind | t: c.params }}</span>

          @if (current(); as q) {
            <article class="o-paper question">
              <span class="o-kicker">{{
                'ui.press.counter' | t: { n: step() + 1, total: c.questions.length }
              }}</span>
              <p class="o-headline ask">«{{ q.questionKey | t: c.params }}»</p>
            </article>
            <div class="choices" role="group" [attr.aria-label]="'ui.press.answers' | t">
              @for (a of q.answers; track a.tone; let i = $index) {
                <button class="o-choice" type="button" [disabled]="busy()" (click)="answer(a.tone)">
                  <span class="o-choice__letter">{{ letters[i] }}</span>
                  <span class="o-choice__body">
                    <span>{{ a.textKey | t: c.params }}</span>
                    <span class="o-choice__hint">{{ 'ui.tone.' + a.tone | t }}</span>
                  </span>
                </button>
              }
            </div>
          }
        } @else if (result(); as r) {
          <article class="o-paper question">
            <span class="o-kicker">{{ 'ui.press.tomorrow' | t }}</span>
            <p class="o-headline ask">{{ r.headlineKey | t: r.params }}</p>
            @if (r.chance !== null) {
              <p class="effect" [class.neg]="r.chance < 0">
                {{ 'ui.press.effect' | t: { pct: r.pct } }}
              </p>
            }
          </article>
          <button class="o-btn" type="button" (click)="leave()">
            {{ 'ui.event.backToWeek' | t }}
          </button>
        } @else {
          <p class="o-muted">{{ 'ui.press.none' | t }}</p>
          <button class="o-btn" type="button" (click)="leave()">
            {{ 'ui.event.backToWeek' | t }}
          </button>
        }
      </main>
    </ion-content>
  `,
  styles: `
    .top {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .title {
      font-size: 30px;
    }
    .mics {
      display: flex;
      justify-content: center;
      gap: 10px;
      padding-top: 6px;
    }
    .mic {
      width: 40px;
      height: 40px;
      --px-b: var(--o-border);
      --px-d: var(--o-px);
      display: grid;
      place-items: center;
      background: var(--o-surface-raised);
      font-size: 20px;
      color: var(--o-text-soft);
      transform: translateY(calc(var(--i) * 0px));
      animation: lean 300ms steps(3, end) both;
      animation-delay: calc(var(--i) * 40ms);
    }
    .mic:nth-child(3) {
      --px-b: var(--o-accent);
      color: var(--o-accent-fg);
    }
    @media (prefers-reduced-motion: reduce) {
      .mic {
        animation: none;
      }
    }
    @keyframes lean {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
    }
    .occasion {
      text-align: center;
    }
    .question {
      gap: 8px;
    }
    .ask {
      margin: 0;
      font-size: 26px;
      line-height: 1.1;
    }
    .choices {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .effect {
      margin: 0;
      font-weight: 700;
      color: var(--o-ink-pos);
    }
    .effect.neg {
      color: var(--o-ink-neg);
    }
  `,
})
export class PressPage {
  private readonly game = inject(GameService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly letters = ['A', 'B', 'C'];
  protected readonly busy = signal(false);
  protected readonly step = signal(0);
  private readonly tones = signal<Tone[]>([]);
  /** La conferenza è fissata all'arrivo: rispondendo sparisce dallo stato. */
  protected readonly conf = signal<PressView | null>(null);
  protected readonly result = signal<{
    headlineKey: string;
    params: Record<string, string>;
    chance: number | null;
    pct: string;
  } | null>(null);

  protected readonly current = computed(() => this.conf()?.questions[this.step()] ?? null);

  constructor() {
    addIcons({ chevronBack, mic });
    const s = this.game.state();
    this.conf.set(s ? getPressConference(s, this.game.ctx) : null);
  }

  protected async answer(tone: Tone): Promise<void> {
    const c = this.conf();
    if (!c || this.busy()) return;
    const tones = [...this.tones(), tone];
    this.tones.set(tones);
    if (tones.length < c.questions.length) {
      this.step.update((n) => n + 1);
      return;
    }
    this.busy.set(true);
    try {
      const report = await this.game.answerPress(tones);
      const feed = this.game.state()?.media?.feed[0];
      this.conf.set(null);
      this.result.set({
        headlineKey: feed?.textKey ?? 'ui.press.none',
        params: feed?.params ?? {},
        chance: c.fixtureId ? report.chance : null,
        pct: formatDelta(report.chance * 100),
      });
    } catch {
      await this.toast.show(this.i18n.t('ui.common.error'), 'error');
    } finally {
      this.busy.set(false);
    }
  }

  protected leave(): void {
    void this.router.navigateByUrl('/settimana');
  }
}
