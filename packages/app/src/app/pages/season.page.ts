import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { getAnyClub } from '@outstanding/engine';
import { GameService } from '../core/game.service';
import { I18nService, TranslatePipe } from '../core/i18n.service';
import { formatAverage, ordinal } from '../core/text';
import { CrestComponent } from '../ui/crest.component';

/** Fine stagione: prima pagina con il verdetto, statistiche e trofei. */
@Component({
  selector: 'app-season',
  imports: [IonContent, RouterLink, TranslatePipe, CrestComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-content class="o-page">
      <main class="o-wrap o-enter">
        @if (view(); as v) {
          <article class="o-paper">
            <div class="o-masthead">
              <span class="o-masthead__name">{{ 'ui.paper.name' | t }}</span>
              <span class="o-masthead__edition">{{
                'ui.season.edition' | t: { season: v.season }
              }}</span>
            </div>
            <span class="o-kicker">{{ 'ui.season.kicker' | t }}</span>
            <h1 class="o-headline">{{ v.headline }}</h1>
            <div class="o-standfirst">
              <p>{{ v.standfirst }}</p>
            </div>
          </article>

          @if (v.trophies.length > 0) {
            <section class="o-card trophies">
              <h2 class="o-section-title">{{ 'ui.season.trophies' | t }}</h2>
              <div class="chips">
                @for (t of v.trophies; track t) {
                  <span class="o-chip o-chip--accent">{{ t }}</span>
                }
              </div>
            </section>
          }

          <section class="o-stats">
            <div class="o-stat o-stat--boxed">
              <span class="o-stat__value">{{ v.stats.appearances }}</span><span
                class="o-stat__label"
                >{{ 'ui.stats.appearances' | t }}</span
              >
            </div>
            <div class="o-stat o-stat--boxed">
              <span class="o-stat__value">{{ v.stats.goals }}</span><span class="o-stat__label">{{
                'ui.stats.goals' | t
              }}</span>
            </div>
            <div class="o-stat o-stat--boxed">
              <span class="o-stat__value">{{ v.stats.assists }}</span><span class="o-stat__label">{{
                'ui.stats.assists' | t
              }}</span>
            </div>
            <div class="o-stat o-stat--boxed">
              <span class="o-stat__value">{{ v.average }}</span><span class="o-stat__label">{{
                'ui.stats.average' | t
              }}</span>
            </div>
          </section>

          @if (v.winners.length > 0) {
            <section class="o-card">
              <h2 class="o-section-title">{{ 'ui.season.winners' | t }}</h2>
              <div class="o-lines">
                @for (w of v.winners; track w.label) {
                  <div class="o-line">
                    <app-crest [crest]="w.crest" [size]="24" />
                    <span class="grow">{{ w.club }}</span>
                    <span class="o-muted">{{ w.label }}</span>
                  </div>
                }
              </div>
            </section>
          }

          <a class="o-btn" routerLink="/settimana" replaceUrl="true">{{ 'ui.season.next' | t }}</a>
        } @else {
          <a class="o-btn" routerLink="/settimana">{{ 'ui.event.backToWeek' | t }}</a>
        }
      </main>
    </ion-content>
  `,
  styles: `
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .grow {
      flex: 1 1 auto;
    }
    a.o-btn {
      text-decoration: none;
    }
  `,
})
export class SeasonPage {
  private readonly game = inject(GameService);
  private readonly i18n = inject(I18nService);

  protected readonly view = computed(() => {
    const r = this.game.lastSeason();
    const s = this.game.state();
    if (!r || !s) return null;
    const t = (k: string, p?: Record<string, string | number>) => this.i18n.t(k, p);
    const rec = r.record;
    const club = rec.clubId ? s.world.clubs.find((c) => c.id === rec.clubId) : undefined;
    const trophyName = (id: string) =>
      id.startsWith('L') ? t(`leagues.${id.slice(1)}.name`) : t(`competitions.${id}.name`);

    let headline: string;
    if (rec.trophies.length > 0) headline = t('ui.season.headline.champions');
    else if (rec.promoted) headline = t('ui.season.headline.promoted');
    else if (rec.relegated) headline = t('ui.season.headline.relegated');
    else if (rec.leaguePosition)
      headline = t('ui.season.headline.position', { pos: ordinal(rec.leaguePosition) });
    else headline = t('ui.season.headline.noClub');

    const stats = rec.stats;
    const topLeague = s.world.leagues.find((l) => l.level === 1)!;
    const topChampion = r.champions.find((c) => c.leagueId === topLeague.id);
    const winners = [
      ...(topChampion ? [{ id: topChampion.clubId, label: t(topLeague.nameKey) }] : []),
      ...r.cupWinners.map((w) => ({
        id: w.clubId,
        label: t(`competitions.${w.competitionId}.name`),
      })),
    ].map((w) => {
      const c = getAnyClub(s.world, w.id);
      return { club: c.name, crest: c.crest, label: w.label };
    });

    return {
      season: r.season,
      headline,
      standfirst: t('ui.season.standfirst', {
        club: club?.name ?? t('ui.week.freeAgent'),
        apps: stats.appearances,
        goals: stats.goals,
        ovr: rec.ovr,
      }),
      stats,
      average: stats.ratingCount > 0 ? formatAverage(stats.ratingSum / stats.ratingCount) : '–',
      trophies: rec.trophies.map(trophyName),
      winners,
    };
  });
}
