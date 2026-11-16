import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AlertController, IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronBack } from 'ionicons/icons';
import { ENGINE_VERSION } from '@outstanding/engine';
import { GameService } from '../core/game.service';
import { I18nService, TranslatePipe } from '../core/i18n.service';
import { PlatformService } from '../core/services/platform.service';
import { SettingsService, type Theme } from '../core/settings.service';
import { ToastService } from '../core/toast.service';

/** Impostazioni: tema, carriera salvata, informazioni e licenze. */
@Component({
  selector: 'app-settings',
  imports: [IonContent, IonIcon, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-content class="o-page">
      <main class="o-wrap o-enter">
        <header class="top">
          <button
            class="o-icon-btn"
            type="button"
            (click)="back()"
            [attr.aria-label]="'ui.common.back' | t"
          >
            <ion-icon name="chevron-back" aria-hidden="true"></ion-icon>
          </button>
          <h1 class="o-display title">{{ 'ui.settings.title' | t }}</h1>
        </header>

        <section class="o-card">
          <h2 class="o-section-title">{{ 'ui.settings.theme' | t }}</h2>
          <div class="o-row" role="radiogroup" [attr.aria-label]="'ui.settings.theme' | t">
            @for (th of themes; track th) {
              <button
                class="o-choice"
                type="button"
                role="radio"
                [attr.aria-checked]="settings.theme() === th"
                [attr.aria-pressed]="settings.theme() === th"
                (click)="setTheme(th)"
              >
                <span class="o-choice__body">{{ 'ui.settings.themes.' + th | t }}</span>
              </button>
            }
          </div>
        </section>

        @if (game.hasGame()) {
          <section class="o-card">
            <h2 class="o-section-title">{{ 'ui.settings.career' | t }}</h2>
            <p class="small o-muted none">
              {{ 'ui.settings.autosave' | t: { slot: game.slot() ?? '–' } }}
            </p>
            <button class="o-btn o-btn--danger o-btn--small" type="button" (click)="deleteCareer()">
              {{ 'ui.settings.delete' | t }}
            </button>
          </section>

          <section class="o-card">
            <h2 class="o-section-title">{{ 'ui.editor.title' | t }}</h2>
            <p class="small o-muted none">{{ 'ui.settings.editorText' | t }}</p>
            <a class="o-btn o-btn--small" routerLink="/editor">{{
              'ui.settings.editorOpen' | t
            }}</a>
          </section>
        }

        <section class="o-card">
          <h2 class="o-section-title">{{ 'ui.settings.full.title' | t }}</h2>
          @if (platform.fullVersion()) {
            <p class="small none">{{ 'ui.settings.full.owned' | t }}</p>
          } @else {
            <p class="small o-muted none">{{ 'ui.settings.full.pitch' | t }}</p>
            <button
              class="o-btn o-btn--small"
              type="button"
              [disabled]="busy()"
              (click)="buyFull()"
            >
              {{ 'ui.settings.full.buy' | t }}
            </button>
          }
          <button
            class="o-btn o-btn--ghost o-btn--small"
            type="button"
            [disabled]="busy()"
            (click)="restore()"
          >
            {{ 'ui.settings.full.restore' | t }}
          </button>
          @if (platform.fakeStore) {
            <p class="small o-muted none">{{ 'ui.settings.full.fake' | t }}</p>
          }
        </section>

        <section class="o-card">
          <h2 class="o-section-title">{{ 'ui.settings.privacy.title' | t }}</h2>
          <p class="small o-muted none">{{ 'ui.settings.privacy.text' | t }}</p>
          <div class="o-row" role="radiogroup" [attr.aria-label]="'ui.settings.privacy.title' | t">
            @for (choice of [false, true]; track choice) {
              <button
                class="o-choice"
                type="button"
                role="radio"
                [attr.aria-checked]="platform.consent() === choice"
                [attr.aria-pressed]="platform.consent() === choice"
                (click)="setConsent(choice)"
              >
                <span class="o-choice__body">{{
                  (choice ? 'ui.settings.privacy.yes' : 'ui.settings.privacy.no') | t
                }}</span>
              </button>
            }
          </div>
        </section>

        <section class="o-card">
          <h2 class="o-section-title">{{ 'ui.settings.about' | t }}</h2>
          <p class="small o-muted none">{{ 'ui.settings.fiction' | t }}</p>
          <p class="small o-muted none">{{ 'ui.settings.fonts' | t }}</p>
          <p class="small o-muted none">{{ 'ui.settings.version' | t: { version: version } }}</p>
        </section>
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
      font-size: 32px;
    }
    .small {
      font-size: 13px;
      line-height: 1.45;
    }
    .none {
      margin: 0;
    }
    a.o-btn {
      text-decoration: none;
    }
  `,
})
export class SettingsPage {
  protected readonly game = inject(GameService);
  protected readonly settings = inject(SettingsService);
  private readonly i18n = inject(I18nService);
  private readonly alerts = inject(AlertController);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  protected readonly themes: Theme[] = ['dark', 'light'];
  protected readonly version = ENGINE_VERSION;
  protected readonly platform = inject(PlatformService);
  private readonly toast = inject(ToastService);
  protected readonly busy = signal(false);

  protected setConsent(value: boolean): void {
    void this.platform.setConsent(value);
  }

  protected async buyFull(): Promise<void> {
    this.busy.set(true);
    try {
      const result = await this.platform.buy('full_version');
      await this.toast.show(
        this.i18n.t('ui.settings.full.result.' + result),
        result === 'failed' ? 'error' : 'info',
      );
    } finally {
      this.busy.set(false);
    }
  }

  protected async restore(): Promise<void> {
    this.busy.set(true);
    try {
      await this.platform.restore();
      await this.toast.show(
        this.i18n.t(
          this.platform.fullVersion() ? 'ui.settings.full.restored' : 'ui.settings.full.nothing',
        ),
      );
    } finally {
      this.busy.set(false);
    }
  }

  constructor() {
    addIcons({ chevronBack });
  }

  protected back(): void {
    if (window.history.length > 1) this.location.back();
    else void this.router.navigateByUrl('/');
  }

  protected setTheme(theme: Theme): void {
    void this.settings.setTheme(theme);
  }

  protected async deleteCareer(): Promise<void> {
    const alert = await this.alerts.create({
      header: this.i18n.t('ui.settings.deleteTitle'),
      message: this.i18n.t('ui.settings.deleteConfirm'),
      buttons: [
        { text: this.i18n.t('ui.common.cancel'), role: 'cancel' },
        { text: this.i18n.t('ui.settings.delete'), role: 'confirm' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'confirm') return;
    const slot = this.game.slot();
    if (slot !== null) await this.game.deleteSlot(slot);
    await this.router.navigateByUrl('/', { replaceUrl: true });
  }
}
