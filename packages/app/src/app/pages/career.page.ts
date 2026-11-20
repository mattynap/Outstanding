import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { IonContent } from '@ionic/angular';
import { GameService } from '../core/game.service';
import { TranslatePipe } from '../core/i18n.service';
import { careerSummary, trophyKey } from '../core/career-view';
import { goalHistory, goalView } from '../core/chapter-view';
import { formatAverage, formatInt, ordinal } from '../core/text';
import { CrestComponent } from '../ui/crest.component';
import { PxIconComponent } from '../ui/px-icon.component';
import { TabBarComponent } from '../ui/tab-bar.component';

/** Bacheca: punteggio, obiettivi di capitolo (in corso e chiusi), trofei e stagioni giocate. */
@Component({
  selector: 'app-career',
  imports: [IonContent, TranslatePipe, CrestComponent, PxIconComponent, TabBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-content class="o-page">
      @if (view(); as v) {
        <main class="o-wrap o-enter">
          <h1 class="o-display title">{{ 'ui.career.title' | t }}</h1>

          <section class="o-card o-card--hero score">
            <app-px-icon class="cup" name="career" [size]="32" />
            <div class="grow">
              <span class="o-label soft">{{ 'ui.career.score' | t }}</span>
              <span class="o-number big">{{ v.score }}</span>
              <span class="o-chip o-chip--accent tier">{{ v.tierKey | t }}</span>
            </div>
          </section>

          <section class="o-stats">
            <div class="o-stat o-stat--boxed">
              <span class="o-stat__value">{{ v.totals.seasons }}</span><span
                class="o-stat__label"
                >{{ 'ui.stats.seasons' | t }}</span
              >
            </div>
            <div class="o-stat o-stat--boxed">
              <span class="o-stat__value">{{ v.apps }}</span><span class="o-stat__label">{{
                'ui.stats.appearances' | t
              }}</span>
            </div>
            <div class="o-stat o-stat--boxed">
              <span class="o-stat__value">{{ v.totals.goals }}</span><span class="o-stat__label">{{
                'ui.stats.goals' | t
              }}</span>
            </div>
            <div class="o-stat o-stat--boxed">
              <span class="o-stat__value">{{ v.average }}</span><span class="o-stat__label">{{
                'ui.stats.average' | t
              }}</span>
            </div>
          </section>

          <section class="o-card goals" [attr.aria-label]="'ui.career.goals' | t">
            <div class="o-section-head">
              <h2 class="o-section-title">{{ 'ui.career.goals' | t }}</h2>
              @if (goals().total > 0) {
                <span class="o-muted small">{{
                  'ui.career.goalsCount' | t: { met: goals().met, n: goals().total }
                }}</span>
              }
            </div>
            @if (current(); as g) {
              <div class="goal-row now">
                <span class="grow">
                  <span>{{ g.text.textKey | t: g.text.params }}</span>
                  <span class="o-muted small">{{
                    g.text.progressKey | t: g.text.progressParams
                  }}</span>
                  <span class="small reward">{{ 'ui.chapter.reward' | t: g.text.reward }}</span>
                </span>
                <span class="verdict" [class.ok]="g.text.met">{{
                  (g.text.met ? 'ui.career.goalMet' : 'ui.career.goalNow') | t
                }}</span>
              </div>
            }
            @for (r of goals().rows; track $index) {
              <div class="goal-row">
                <span class="grow">
                  <span>{{ r.textKey | t: r.params }}</span>
                  <span class="o-muted small">{{
                    'ui.career.goalLine' | t: { season: r.season, chapter: (r.chapterKey | t) }
                  }}</span>
                </span>
                <span class="verdict" [class.ok]="r.met" [class.ko]="!r.met">{{
                  (r.met ? 'ui.career.goalMet' : 'ui.career.goalMissed') | t
                }}</span>
              </div>
            } @empty {
              @if (!current()) {
                <p class="o-muted small none">{{ 'ui.career.goalsNone' | t }}</p>
              }
            }
          </section>

          <section class="o-card">
            <h2 class="o-section-title">{{ 'ui.career.cabinet' | t }}</h2>
            @if (v.cabinet.length > 0) {
              <div class="cabinet">
                @for (tr of v.cabinet; track tr.id) {
                  <span class="o-chip o-chip--accent"
                    ><app-px-icon class="cup" name="career" />{{ trophyKey(tr.id) | t }}{{ tr.count > 1 ? ' ×' + tr.count : '' }}</span
                  >
                }
              </div>
            } @else {
              <p class="o-muted small none">{{ 'ui.career.noTrophies' | t }}</p>
            }
          </section>

          <section class="block">
            <h2 class="o-section-title">{{ 'ui.career.seasons' | t }}</h2>
            @for (h of v.seasons; track h.season) {
              <article class="o-card season">
                <div class="season-head">
                  @if (h.crest) {
                    <app-crest [crest]="h.crest" [size]="28" />
                  }
                  <div class="grow">
                    <span class="club">{{ h.club ?? ('ui.week.freeAgent' | t) }}</span>
                    <span class="o-muted small">
                      {{ 'ui.career.seasonLine' | t: { season: h.season, age: h.age } }}
                      @if (h.levelKey) {
                        · {{ h.levelKey | t }}
                      }
                      @if (h.position) {
                        · {{ ordinal(h.position) }}
                      }
                    </span>
                  </div>
                  @if (h.promoted) {
                    <span class="tag up">{{ 'ui.career.promoted' | t }}</span>
                  } @else if (h.relegated) {
                    <span class="tag down">{{ 'ui.career.relegated' | t }}</span>
                  }
                </div>
                <div class="numbers small">
                  <span>{{
                    'ui.career.numbers' | t: { apps: h.apps, goals: h.goals, assists: h.assists }
                  }}</span>
                  <span>{{ 'ui.career.avgOvr' | t: { avg: h.average, ovr: h.ovr } }}</span>
                </div>
                @if (h.trophies.length > 0) {
                  <div class="cabinet">
                    @for (tr of h.trophies; track tr) {
                      <span class="o-chip o-chip--accent mini">{{ trophyKey(tr) | t }}</span>
                    }
                  </div>
                }
              </article>
            } @empty {
              <p class="o-muted small">{{ 'ui.career.firstSeason' | t }}</p>
            }
          </section>
        </main>
      }
    </ion-content>
    <app-tab-bar active="career" />
  `,
  styles: `
    .title {
      font-size: 36px;
    }
    .score {
      flex-direction: row;
      align-items: center;
      gap: 12px;
    }
    .cup {
      color: var(--o-accent-fg);
    }
    .tier {
      align-self: flex-start;
      margin-top: 6px;
    }
    .soft {
      color: var(--o-text-soft);
    }
    .big {
      font-size: 56px;
    }
    .small {
      font-size: var(--o-text-sm);
    }
    .none {
      margin: 0;
    }
    .cabinet {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .mini {
      padding: 3px 9px;
      font-size: 11px;
    }
    .block {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .season {
      gap: 8px;
    }
    .season-head {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .grow {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .club {
      font-family: var(--o-font-display);
      font-weight: 700;
      font-size: 18px;
      text-transform: uppercase;
      line-height: 1.05;
    }
    .tag {
      font-family: var(--o-font-display);
      font-weight: 700;
      font-size: 12px;
      letter-spacing: 1px;
      text-transform: uppercase;
      padding: 3px 8px;
      /* Cornice pixel a gradini nel colore dell'esito. */
      box-shadow:
        0 calc(-1 * var(--o-px)) 0 0 currentColor,
        0 var(--o-px) 0 0 currentColor,
        calc(-1 * var(--o-px)) 0 0 0 currentColor,
        var(--o-px) 0 0 0 currentColor;
    }
    .tag.up {
      color: var(--o-positive);
    }
    .tag.down {
      color: var(--o-negative);
    }
    .goals {
      gap: 0;
    }
    .goal-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 0;
      border-top: 1px solid var(--o-border);
    }
    .goal-row .grow > span:first-child {
      font-family: var(--o-font-display);
      font-weight: 600;
      font-size: 16px;
      line-height: 1.15;
    }
    .reward {
      color: var(--o-accent-text);
    }
    .verdict {
      flex: 0 0 auto;
      padding: 2px 8px;
      font-family: var(--o-font-display);
      font-weight: 800;
      font-size: 12px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--o-text-soft);
      border: 2px solid currentColor;
      /* Timbro: leggermente storto, come apposto a mano. */
      transform: rotate(-3deg);
    }
    .verdict.ok {
      color: var(--o-positive);
      border-width: 3px;
    }
    .verdict.ko {
      color: var(--o-text-muted);
      border-style: dashed;
    }
    .numbers {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      color: var(--o-text-muted);
    }
  `,
})
export class CareerPage {
  private readonly game = inject(GameService);
  protected readonly trophyKey = trophyKey;
  protected readonly ordinal = ordinal;

  protected readonly goals = computed(() => {
    const s = this.game.state();
    return s ? goalHistory(s, this.game.ctx) : { met: 0, total: 0, rows: [] };
  });

  /** L'obiettivo del capitolo in corso, se non è già stato liquidato. */
  protected readonly current = computed(() => {
    const s = this.game.state();
    const text = s && !s.chapter.goal?.settled ? goalView(s, this.game.ctx) : null;
    return text ? { text } : null;
  });

  protected readonly view = computed(() => {
    const s = this.game.state();
    if (!s) return null;
    const sum = careerSummary(s, this.game.ctx);
    const t = sum.totals;
    return {
      score: formatInt(sum.score.total),
      tierKey: sum.score.tierKey,
      totals: t,
      apps: formatInt(t.appearances),
      average: t.averageRating === null ? '–' : formatAverage(t.averageRating),
      cabinet: sum.cabinet,
      seasons: [...s.player.history].reverse().map((h) => {
        const club = h.clubId ? s.world.clubs.find((c) => c.id === h.clubId) : undefined;
        return {
          season: h.season,
          age: h.age,
          club: club?.name ?? null,
          crest: club?.crest ?? null,
          levelKey: h.leagueLevel ? `leagues.${h.leagueLevel}.name` : null,
          position: h.leaguePosition,
          promoted: h.promoted,
          relegated: h.relegated,
          apps: h.stats.appearances,
          goals: h.stats.goals,
          assists: h.stats.assists,
          average: h.stats.ratingCount
            ? formatAverage(h.stats.ratingSum / h.stats.ratingCount)
            : '–',
          ovr: h.ovr,
          trophies: h.trophies,
        };
      }),
    };
  });
}
