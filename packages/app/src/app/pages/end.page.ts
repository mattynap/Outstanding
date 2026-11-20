import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { GameService } from '../core/game.service';
import { TranslatePipe } from '../core/i18n.service';
import { careerSummary, trophyKey } from '../core/career-view';
import { formatAverage, formatInt } from '../core/text';
import { AvatarComponent } from '../ui/avatar.component';
import { PxIconComponent } from '../ui/px-icon.component';

/** Fine carriera: il verdetto del giornale, il punteggio e i numeri di una vita. */
@Component({
  selector: 'app-end',
  imports: [IonContent, TranslatePipe, AvatarComponent, PxIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-content class="o-page">
      @if (view(); as v) {
        <main class="o-wrap o-enter">
          <article class="o-paper">
            <div class="o-masthead">
              <span class="o-masthead__name">{{ 'ui.paper.name' | t }}</span>
              <span class="o-masthead__edition">{{ 'ui.end.edition' | t }}</span>
            </div>
            <div class="lead">
              <app-avatar [appearance]="v.appearance" [size]="84" [label]="v.name" />
              <div class="lead-text">
                <span class="o-kicker">{{ v.tierKey | t }}</span>
                <h1 class="o-headline">{{ 'ui.end.headline' | t: { name: v.lastName } }}</h1>
              </div>
            </div>
            <div class="o-standfirst">
              <p>
                {{ v.reasonKey | t }}
                {{
                  'ui.end.standfirst'
                    | t: { age: v.age, seasons: v.seasons, apps: v.apps, goals: v.goals }
                }}
              </p>
            </div>

            <div class="o-sheet">
              <div class="o-sheet__cell">
                <span class="o-sheet__value o-num">{{ v.apps }}</span>
                <span class="o-sheet__label">{{ 'ui.stats.appearances' | t }}</span>
              </div>
              <div class="o-sheet__cell">
                <span class="o-sheet__value o-num">{{ v.goals }}</span>
                <span class="o-sheet__label">{{ 'ui.stats.goals' | t }}</span>
              </div>
              <div class="o-sheet__cell">
                <span class="o-sheet__value o-num">{{ v.topSeasons }}</span>
                <span class="o-sheet__label">{{ 'ui.stats.topSeasons' | t }}</span>
              </div>
              <div class="o-sheet__cell">
                <span class="o-sheet__value o-num">{{ v.average }}</span>
                <span class="o-sheet__label">{{ 'ui.stats.average' | t }}</span>
              </div>
            </div>

            @if (v.cabinet.length > 0) {
              <h2 class="o-paper-head">{{ 'ui.career.cabinet' | t }}</h2>
              <div class="cabinet">
                @for (tr of v.cabinet; track tr.id) {
                  <span class="o-chip o-px--paper trophy"
                    ><app-px-icon name="career" />{{ trophyKey(tr.id) | t
                    }}{{ tr.count > 1 ? ' ×' + tr.count : '' }}</span
                  >
                }
              </div>
            }
          </article>

          <section class="o-card o-card--hero total">
            <span class="o-label soft">{{ 'ui.career.score' | t }}</span>
            <span class="o-number big o-enter-steps">{{ v.score }}</span>
            <dl class="parts">
              @for (p of v.parts; track p.key) {
                <div class="part">
                  <dt>{{ p.key | t }}</dt>
                  <dd class="o-num">{{ p.value }}</dd>
                </div>
              }
            </dl>
          </section>

          <button class="o-btn" type="button" (click)="newCareer()">
            {{ 'ui.end.newCareer' | t }}
          </button>
        </main>
      }
    </ion-content>
  `,
  styles: `
    .lead {
      display: flex;
      gap: 14px;
      align-items: flex-end;
    }
    .lead-text {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
    }
    .total {
      align-items: center;
      text-align: center;
      gap: 4px;
    }
    .soft {
      color: var(--o-text-soft);
    }
    .big {
      font-size: 64px;
      color: var(--o-accent-fg);
    }
    /* Scontrino del punteggio, come la pagella: una riga per voce. */
    .parts {
      width: 100%;
      margin: 8px 0 0;
      padding-top: 6px;
      border-top: 2px solid var(--o-border-strong);
    }
    .part {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 4px 0;
      border-bottom: 1px dashed var(--o-border);
      font-size: var(--o-text-sm);
      text-align: left;
    }
    .part:last-child {
      border-bottom: none;
    }
    .part dt {
      color: var(--o-text-muted);
    }
    .part dd {
      margin: 0;
      font-size: 22px;
      line-height: 1;
    }
    .cabinet {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .trophy app-px-icon {
      color: var(--o-headline-red);
    }
  `,
})
export class EndPage {
  private readonly game = inject(GameService);
  private readonly router = inject(Router);
  protected readonly trophyKey = trophyKey;

  protected readonly view = computed(() => {
    const s = this.game.state();
    if (!s) return null;
    const sum = careerSummary(s, this.game.ctx);
    const t = sum.totals;
    const p = sum.score.parts;
    return {
      name: `${s.player.firstName} ${s.player.lastName}`,
      lastName: s.player.lastName,
      appearance: s.player.appearance,
      tierKey: sum.score.tierKey,
      reasonKey: s.retired ? `retirement.${s.retired.reason}` : 'ui.end.ongoing',
      age: s.retired?.age ?? 0,
      seasons: t.seasons,
      score: formatInt(sum.score.total),
      parts: [
        { key: 'ui.end.parts.appearances', value: formatInt(p.appearances) },
        { key: 'ui.end.parts.goals', value: formatInt(p.goals + p.assists) },
        { key: 'ui.end.parts.cleanSheets', value: formatInt(p.cleanSheets) },
        { key: 'ui.end.parts.ratings', value: formatInt(p.ratings) },
        { key: 'ui.end.parts.trophies', value: formatInt(p.trophies) },
      ],
      apps: formatInt(t.appearances),
      goals: formatInt(t.goals),
      topSeasons: t.topLevelSeasons,
      average: t.averageRating === null ? '–' : formatAverage(t.averageRating),
      cabinet: sum.cabinet,
    };
  });

  protected newCareer(): void {
    void this.router.navigateByUrl('/crea');
  }
}
