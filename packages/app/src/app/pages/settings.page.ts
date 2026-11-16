import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { AlertController, IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronBack } from 'ionicons/icons';
import { ENGINE_VERSION } from '@outstanding/engine';
import { GameService } from '../core/game.service';
import { I18nService, TranslatePipe } from '../core/i18n.service';
import { SettingsService, type Theme } from '../core/settings.service';

/** Impostazioni: tema, carriera salvata, informazioni e licenze. */
@Component({
  selector: 'app-settings',
  imports: [IonContent, IonIcon, TranslatePipe],
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
            <p class="small o-muted none">{{ 'ui.settings.autosave' | t }}</p>
            <button class="o-btn o-btn--danger o-btn--small" type="button" (click)="deleteCareer()">
              {{ 'ui.settings.delete' | t }}
            </button>
          </section>
        }

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
    await this.game.deleteGame();
    await this.router.navigateByUrl('/', { replaceUrl: true });
  }
}
