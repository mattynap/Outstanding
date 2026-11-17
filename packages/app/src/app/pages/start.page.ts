import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AlertController, IonContent } from '@ionic/angular';
import { GameService } from '../core/game.service';
import { I18nService, TranslatePipe } from '../core/i18n.service';
import type { SlotSummary } from '../core/saves/slots';
import { ToastService } from '../core/toast.service';

const savedFormat = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** Schermata iniziale: prima pagina del giornale e le carriere salvate negli slot. */
@Component({
  selector: 'app-start',
  imports: [IonContent, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-content class="o-page">
      <main class="o-wrap o-enter start">
        <p class="wordmark">{{ 'ui.app.name' | t }}</p>

        <article class="o-paper front">
          <div class="o-masthead">
            <span class="o-masthead__name">{{ 'ui.paper.name' | t }}</span>
            <span class="o-masthead__edition">{{ 'ui.start.edition' | t }}</span>
          </div>
          <span class="o-kicker">{{ 'ui.start.kicker' | t }}</span>
          <h1 class="o-headline">{{ 'ui.start.headline' | t }}</h1>
          <div class="o-standfirst">
            <p>{{ 'ui.start.standfirst' | t }}</p>
          </div>
        </article>

        <a class="o-btn" routerLink="/campo-prova">{{ 'ui.stage.open' | t }}</a>

        @if (latest(); as l) {
          <button class="o-btn" type="button" [disabled]="busy()" (click)="open(l.slot)">
            {{ 'ui.start.continue' | t }}
          </button>
        }

        <section class="slots" [attr.aria-label]="'ui.slots.title' | t">
          <h2 class="o-section-title">{{ 'ui.slots.title' | t }}</h2>
          @for (v of game.slots(); track v.slot) {
            @if (v.summary; as s) {
              <article class="o-card slot" [class.current]="v.slot === game.slot()">
                <div class="slot-head">
                  <span class="o-number num">{{ v.slot }}</span>
                  <div class="grow">
                    <span class="name">{{ s.playerName }}</span>
                    <span class="o-muted small">{{ line(s) }}</span>
                    <span class="o-muted tiny">{{
                      'ui.slots.saved' | t: { when: when(s.savedAt) }
                    }}</span>
                  </div>
                </div>
                <div class="o-row">
                  <button
                    class="o-btn o-btn--ghost o-btn--small"
                    type="button"
                    [disabled]="busy()"
                    (click)="remove(v.slot)"
                  >
                    {{ 'ui.slots.delete' | t }}
                  </button>
                  <button
                    class="o-btn o-btn--small"
                    type="button"
                    [disabled]="busy()"
                    (click)="open(v.slot)"
                  >
                    {{ (s.retired ? 'ui.slots.summary' : 'ui.slots.play') | t }}
                  </button>
                </div>
              </article>
            } @else {
              <a class="o-card slot empty" routerLink="/crea" [queryParams]="{ slot: v.slot }">
                <span class="o-number num">{{ v.slot }}</span>
                <span class="grow o-muted">{{ 'ui.slots.empty' | t }}</span>
                <span class="new">{{ 'ui.start.new' | t }}</span>
              </a>
            }
          }
        </section>

        <a class="o-btn o-btn--ghost o-btn--small" routerLink="/impostazioni">
          {{ 'ui.settings.title' | t }}
        </a>
      </main>
    </ion-content>
  `,
  styles: `
    .start {
      min-height: 100%;
      justify-content: center;
      gap: var(--o-space-5);
    }
    .wordmark {
      margin: 0;
      text-align: center;
      font-family: var(--o-font-display);
      font-weight: 800;
      font-size: 22px;
      letter-spacing: 6px;
      text-transform: uppercase;
      color: var(--o-accent-fg);
    }
    .front {
      transform: rotate(-1.2deg);
    }
    .front .o-headline {
      font-size: 46px;
    }
    .slots {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .slot.current {
      border-color: var(--o-accent);
    }
    .slot-head,
    .empty {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .empty {
      flex-direction: row;
      text-decoration: none;
      color: var(--o-text);
      border-style: dashed;
      min-height: 64px;
    }
    .num {
      width: 28px;
      font-size: 30px;
      color: var(--o-text-muted);
      text-align: center;
    }
    .grow {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .name {
      font-family: var(--o-font-display);
      font-weight: 700;
      font-size: 20px;
      text-transform: uppercase;
      line-height: 1.05;
    }
    .small {
      font-size: var(--o-text-sm);
    }
    .tiny {
      font-size: var(--o-text-xs);
    }
    .new {
      font-family: var(--o-font-display);
      font-weight: 700;
      text-transform: uppercase;
      color: var(--o-accent-fg);
    }
    a.o-btn {
      text-decoration: none;
    }
  `,
})
export class StartPage {
  protected readonly game = inject(GameService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly alerts = inject(AlertController);
  protected readonly busy = signal(false);

  /** La carriera salvata più di recente (non ritirata) per il pulsante "Continua". */
  protected readonly latest = computed(
    () =>
      this.game
        .slots()
        .flatMap((v) => (v.summary && !v.summary.retired ? [v.summary] : []))
        .sort((a, b) => b.savedAt - a.savedAt)[0] ?? null,
  );

  constructor() {
    void this.game.refreshSlots();
  }

  protected line(s: SlotSummary): string {
    const club = s.clubName ?? this.i18n.t('ui.week.freeAgent');
    return this.i18n.t(s.retired ? 'ui.slots.lineRetired' : 'ui.slots.line', {
      club,
      season: s.season,
      week: s.week,
      age: s.age,
    });
  }

  protected when(ms: number): string {
    return savedFormat.format(ms);
  }

  protected async open(slot: number): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.game.loadSlot(slot);
      await this.router.navigateByUrl(this.game.state()?.retired ? '/fine' : '/settimana');
    } catch {
      await this.toast.show(this.i18n.t('ui.slots.unreadable'), 'error');
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(slot: number): Promise<void> {
    const alert = await this.alerts.create({
      header: this.i18n.t('ui.settings.deleteTitle'),
      message: this.i18n.t('ui.settings.deleteConfirm'),
      buttons: [
        { text: this.i18n.t('ui.common.cancel'), role: 'cancel' },
        { text: this.i18n.t('ui.slots.delete'), role: 'confirm' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role === 'confirm') await this.game.deleteSlot(slot);
  }
}
