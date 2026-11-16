import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { GameService } from '../core/game.service';
import { TranslatePipe } from '../core/i18n.service';
import { clubInfo, playerAge } from '../core/views';
import { CrestComponent } from '../ui/crest.component';

/** Schermata iniziale: prima pagina del giornale, continua o nuova carriera. */
@Component({
  selector: 'app-start',
  imports: [IonContent, RouterLink, TranslatePipe, CrestComponent],
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

        <div class="actions">
          @if (summary(); as s) {
            <button class="o-btn" type="button" (click)="continue()">
              {{ 'ui.start.continue' | t }}
            </button>
            <div class="o-card saved">
              @if (s.crest) {
                <app-crest [crest]="s.crest" [size]="32" />
              }
              <div>
                <strong>{{ s.name }}</strong>
                <span class="o-muted">{{ 'ui.start.saved' | t: s.params }}</span>
              </div>
            </div>
            <a class="o-btn o-btn--ghost" routerLink="/crea">{{ 'ui.start.new' | t }}</a>
          } @else {
            <a class="o-btn" routerLink="/crea">{{ 'ui.start.new' | t }}</a>
          }
          <a class="o-btn o-btn--ghost o-btn--small" routerLink="/impostazioni">
            {{ 'ui.settings.title' | t }}
          </a>
        </div>
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
    .actions {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    a.o-btn {
      text-decoration: none;
    }
    .saved {
      flex-direction: row;
      align-items: center;
    }
    .saved div {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 13px;
    }
  `,
})
export class StartPage {
  private readonly game = inject(GameService);
  private readonly router = inject(Router);

  protected readonly summary = computed(() => {
    const s = this.game.state();
    if (!s) return null;
    const info = clubInfo(s, this.game.ctx);
    const age = playerAge(s, this.game.ctx);
    return {
      name: `${s.player.firstName} ${s.player.lastName}`,
      crest: info?.club.crest ?? null,
      params: { club: info?.club.name ?? '—', age, season: s.season },
    };
  });

  protected continue(): void {
    void this.router.navigateByUrl(this.game.state()?.retired ? '/fine' : '/settimana');
  }
}
