import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { GameService } from '../core/game.service';
import { TranslatePipe } from '../core/i18n.service';
import { careerSummary, trophyKey } from '../core/career-view';
import { formatAverage, formatInt } from '../core/text';
import { AvatarComponent } from '../ui/avatar.component';

/** Fine carriera: il verdetto del giornale, il punteggio e i numeri di una vita. */
@Component({
  selector: 'app-end',
  imports: [IonContent, TranslatePipe, AvatarComponent],
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
          </article>

          <section class="o-card o-card--hero total">
            <span class="o-label soft">{{ 'ui.career.score' | t }}</span>
            <span class="o-number big">{{ v.score }}</span>
            <div class="parts">
              @for (p of v.parts; track p.key) {
                <div class="part">
                  <span class="o-muted">{{ p.key | t }}</span><span class="o-number">{{
                    p.value
                  }}</span>
                </div>
              }
            </div>
          </section>

          <section class="o-stats">
            <div class="o-stat o-stat--boxed">
              <span class="o-stat__value">{{ v.apps }}</span><span class="o-stat__label">{{
                'ui.stats.appearances' | t
              }}</span>
            </div>
            <div class="o-stat o-stat--boxed">
              <span class="o-stat__value">{{ v.goals }}</span><span class="o-stat__label">{{
                'ui.stats.goals' | t
              }}</span>
            </div>
            <div class="o-stat o-stat--boxed">
              <span class="o-stat__value">{{ v.topSeasons }}</span><span class="o-stat__label">{{
                'ui.stats.topSeasons' | t
              }}</span>
            </div>
            <div class="o-stat o-stat--boxed">
              <span class="o-stat__value">{{ v.average }}</span><span class="o-stat__label">{{
                'ui.stats.average' | t
              }}</span>
            </div>
          </section>

          @if (v.cabinet.length > 0) {
            <section class="o-card">
              <h2 class="o-section-title">{{ 'ui.career.cabinet' | t }}</h2>
              <div class="cabinet">
                @for (tr of v.cabinet; track tr.id) {
                  <span class="o-chip o-chip--accent"
                    >{{ trophyKey(tr.id) | t }}{{ tr.count > 1 ? ' ×' + tr.count : '' }}</span
                  >
                }
              </div>
            </section>
          }

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
    .parts {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      margin-top: 8px;
    }
    .part {
      display: flex;
      flex-direction: column;
      font-size: var(--o-text-xs);
      gap: 2px;
    }
    .part .o-number {
      font-size: 20px;
    }
    .cabinet {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
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
