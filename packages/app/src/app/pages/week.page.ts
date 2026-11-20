import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  arrowForward,
  chatbubblesOutline,
  medkitOutline,
  micOutline,
  settingsOutline,
} from 'ionicons/icons';
import {
  getTransferWindow,
  getPressConference,
  getWeekOptions,
  SKILLS,
  type Skill,
} from '@outstanding/engine';
import { chapterPicks, goalView, needsPlan } from '../core/chapter-view';
import { GameService } from '../core/game.service';
import { I18nService, TranslatePipe } from '../core/i18n.service';
import { kickoffHintKey } from '../core/match-mode';
import { formatMoney, formatRating, ordinal } from '../core/text';
import { ToastService } from '../core/toast.service';
import { clubInfo, playerAge, seasonWeekNumber } from '../core/views';
import { CrestComponent } from '../ui/crest.component';
import { PxIconComponent } from '../ui/px-icon.component';
import { StatBarComponent } from '../ui/stat-bar.component';
import { TabBarComponent } from '../ui/tab-bar.component';
import { TipComponent } from '../ui/tip.component';

/**
 * Home del capitolo: prima pagina dell'ultimo stop, obiettivo, partite scelte dal regista, piano
 * del capitolo e il pulsante che porta al prossimo stop.
 */
@Component({
  selector: 'app-week',
  imports: [
    IonContent,
    IonIcon,
    RouterLink,
    TranslatePipe,
    CrestComponent,
    PxIconComponent,
    StatBarComponent,
    TabBarComponent,
    TipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-content class="o-page">
      @if (view(); as v) {
        <header class="club">
          @if (v.club) {
            <app-crest [crest]="v.club.club.crest" [size]="44" [label]="v.club.club.name" />
            <div class="club-text">
              <span class="club-name">{{ v.club.club.name }}</span>
              <span class="o-muted small">
                {{ v.club.leagueKey | t }} · {{ v.club.groupKey | t }}
                @if (v.played) {
                  · {{ ordinal(v.club.position) }} {{ 'ui.week.place' | t }}
                }
              </span>
            </div>
          } @else {
            <div class="club-text">
              <span class="club-name">{{ 'ui.week.freeAgent' | t }}</span>
              <span class="o-muted small">{{ 'ui.week.freeAgentHint' | t }}</span>
            </div>
          }
          <a class="o-icon-btn" routerLink="/social" [attr.aria-label]="'ui.social.title' | t">
            <ion-icon name="chatbubbles-outline" aria-hidden="true"></ion-icon>
          </a>
          <a
            class="o-icon-btn"
            routerLink="/impostazioni"
            [attr.aria-label]="'ui.settings.title' | t"
          >
            <ion-icon name="settings-outline" aria-hidden="true"></ion-icon>
          </a>
        </header>

        <main class="o-wrap o-enter">
          <section class="headline">
            <div class="when">
              <span class="o-label">{{ 'ui.week.seasonWeek' | t: { season: v.season } }}</span>
              <span class="o-num big">{{ v.week }}</span>
            </div>
            <div class="who">
              <span class="name">{{ v.name }}</span>
              <span class="o-muted small"
                >{{ 'roles.' + v.role | t }} · {{ 'ui.common.years' | t: { n: v.age } }} · OVR
                {{ v.ovr }}</span
              >
              <a class="o-chip cash" routerLink="/vita">
                <app-px-icon name="cash" aria-hidden="true" />{{ v.cash }}
              </a>
            </div>
          </section>

          <app-tip tip="week.welcome" />

          @if (frontPage(); as fp) {
            <section class="front" [attr.aria-label]="'ui.stop.title' | t">
              <div class="front-mast">
                <span class="o-kicker">{{ 'ui.stop.' + fp.stop | t }}</span>
                <span class="news-paper">{{ 'ui.paper.name' | t }}</span>
              </div>
              @for (h of fp.headlines; track $index; let first = $first) {
                <p class="front-title" [class.lead]="first">{{ h.textKey | t: h.params }}</p>
              } @empty {
                <p class="front-title quiet">{{ 'ui.stop.quiet' | t }}</p>
              }
              @if (fp.weeks > 0) {
                <div class="front-foot">
                  <span>{{
                    'ui.stop.record'
                      | t
                        : {
                            n: fp.weeks,
                            win: fp.record.win,
                            draw: fp.record.draw,
                            loss: fp.record.loss,
                          }
                  }}</span>
                  @if (fp.ratings.length) {
                    <span class="front-ratings" [attr.aria-label]="'ui.stop.ratings' | t">
                      @for (r of fp.ratings; track $index) {
                        <span class="o-num rating" [attr.data-tone]="r.tone">{{ r.text }}</span>
                      }
                    </span>
                  }
                </div>
              }
            </section>
          }

          <section
            class="o-card goal"
            [class.met]="goal()?.met"
            [attr.aria-label]="'ui.chapter.goal' | t"
          >
            <div class="goal-top">
              <span class="o-label">{{
                'ui.chapter.kicker' | t: { name: ('ui.chapter.name.' + chapterId() | t) }
              }}</span>
              @if (goal()?.met) {
                <span class="stamp">{{ 'ui.chapter.met' | t }}</span>
              }
            </div>
            @if (goal(); as g) {
              <p class="goal-text">{{ g.textKey | t: g.params }}</p>
              @if (g.ticks; as tk) {
                <div class="ticks" aria-hidden="true">
                  @for (i of range(tk.total); track i) {
                    <span class="tick" [class.on]="i < tk.done"></span>
                  }
                </div>
              }
              <span class="o-muted small">{{ g.progressKey | t: g.progressParams }}</span>
            } @else {
              <p class="goal-text">{{ 'ui.chapter.noGoal' | t }}</p>
            }
          </section>

          @if (nextPick(); as np) {
            @let f = np.view;
            <section class="o-card o-card--hero match" [attr.aria-label]="'ui.week.nextMatch' | t">
              <div class="match-top o-label">
                <span>{{ whenKey(f.inWeeks) | t: { n: f.inWeeks } }}</span>
                <span class="mode-tag" [class.quick]="np.mode === 'quick'">{{
                  'ui.chapter.mode.' + np.mode | t
                }}</span>
              </div>
              <div class="match-comp">
                {{ f.competitionKey | t }} ·
                @if (f.stageKey) {
                  {{ f.stageKey | t }}
                } @else {
                  {{ ordinal(f.fixture.matchday) }} {{ 'ui.week.matchday' | t }}
                }
                · {{ (f.side === 'home' ? 'ui.match.home' : 'ui.match.away') | t }}
              </div>
              <div class="teams">
                <div class="team">
                  <app-crest [crest]="f.home.crest" [size]="48" />
                  <span>{{ f.home.shortName }}</span>
                </div>
                <span class="vs o-num">VS</span>
                <div class="team">
                  <app-crest [crest]="f.away.crest" [size]="48" />
                  <span>{{ f.away.shortName }}</span>
                </div>
              </div>
              <div class="match-foot">
                <span>
                  @if (f.opponentPosition) {
                    {{ 'ui.week.opponentPos' | t: { pos: ordinal(f.opponentPosition) } }} ·
                  }
                  {{ 'ui.week.opponentRating' | t: { rating: f.opponent.rating } }}
                </span>
              </div>
              @if (step() === 'matchInProgress' || step() === 'match') {
                <div class="kickoff">
                  <button class="o-btn" type="button" [disabled]="busy()" (click)="playMatch()">
                    {{ (step() === 'match' ? 'ui.week.play' : 'ui.week.cta.resume') | t }}
                    <ion-icon name="arrow-forward" aria-hidden="true"></ion-icon>
                  </button>
                </div>
              } @else if (f.inWeeks === 0 && kickoffHint(); as hint) {
                <div class="kickoff">
                  <p class="o-muted small after-plan">{{ hint | t }}</p>
                </div>
              }
            </section>
          } @else if (view()?.club && step() !== 'seasonOver') {
            <p class="o-muted small none">{{ 'ui.chapter.picksNone' | t }}</p>
          }

          @if (picks().length > 1) {
            <section class="picks" [attr.aria-label]="'ui.chapter.picks' | t">
              <h2 class="o-section-title">{{ 'ui.chapter.picks' | t }}</h2>
              <ol class="o-lines">
                @for (pk of picks(); track pk.view.fixture.id) {
                  <li class="o-line pick" [class.next]="pk.next" [class.done]="pk.outcome">
                    <app-crest [crest]="pk.view.opponent.crest" [size]="24" />
                    <span class="grow">{{ pk.view.opponent.shortName }}</span>
                    @if (pk.outcome; as o) {
                      <span class="o-num result" [attr.data-outcome]="o">{{
                        'ui.chapter.outcome.' + o | t
                      }}</span>
                    } @else {
                      <span class="o-muted small">{{
                        whenKey(pk.view.inWeeks) | t: { n: pk.view.inWeeks }
                      }}</span>
                      <span class="mode-tag" [class.quick]="pk.mode === 'quick'">{{
                        'ui.chapter.mode.' + pk.mode | t
                      }}</span>
                    }
                  </li>
                }
              </ol>
            </section>
          }

          @if (press(); as pr) {
            <a class="o-card press-call" routerLink="/conferenza">
              <ion-icon name="mic-outline" aria-hidden="true"></ion-icon>
              <span class="grow">
                <span class="o-section-title">{{ 'ui.press.title' | t }}</span>
                <span class="o-muted small">{{ 'ui.press.kind.' + pr.kind | t: pr.params }}</span>
              </span>
              <ion-icon name="arrow-forward" aria-hidden="true"></ion-icon>
            </a>
          }

          @if (v.injury; as inj) {
            <div class="o-card injury" role="status">
              <ion-icon name="medkit-outline" aria-hidden="true"></ion-icon>
              <span>{{
                'ui.week.injured'
                  | t: { injury: ('injuries.' + inj.type | t), weeks: inj.weeksLeft }
              }}</span>
            </div>
          }

          @if (saveFailed()) {
            <div class="o-card injury" role="alert">{{ 'ui.week.saveFailed' | t }}</div>
          }

          <section class="o-card condition" [attr.aria-label]="'ui.week.condition' | t">
            @for (c of conditionRows; track c.key) {
              <div class="cond">
                <app-px-icon [name]="c.icon" [size]="24" aria-hidden="true" />
                <app-stat-bar [label]="c.label | t" [value]="v.condition[c.key]" tone="auto" />
              </div>
            }
          </section>
          <app-tip tip="week.condition" />

          @if (planOpen()) {
            <section class="plan" [attr.aria-label]="'ui.chapter.plan' | t">
              <div class="o-section-head">
                <h2 class="o-section-title">{{ 'ui.chapter.plan' | t }}</h2>
                <span class="o-muted small">{{
                  'ui.week.actionsCount' | t: { n: choices().length, max: maxActions }
                }}</span>
              </div>
              <app-tip tip="week.plan" />
              <p class="o-muted small last-plan">
                {{
                  (lastStopKind() === 'chapterEnd' ? 'ui.chapter.planNew' : 'ui.chapter.planHint')
                    | t
                }}
              </p>
              <div class="actions">
                @for (o of options(); track o.id) {
                  <button
                    class="o-choice action"
                    type="button"
                    [attr.aria-pressed]="isChosen(o.id)"
                    [disabled]="!isChosen(o.id) && (!o.available || choices().length >= maxActions)"
                    (click)="toggle(o.id, o.needsFocus)"
                  >
                    <span class="o-choice__body">
                      <span>{{ o.nameKey | t }}</span>
                      <span class="o-choice__hint clamp">{{ o.reasonKey ?? o.descKey | t }}</span>
                    </span>
                  </button>
                }
              </div>
              @if (needsFocus()) {
                <div class="focus" role="radiogroup" [attr.aria-label]="'ui.week.focus' | t">
                  <span class="o-label">{{ 'ui.week.focus' | t }}</span>
                  <div class="chips">
                    @for (s of skills; track s) {
                      <button
                        class="o-chip"
                        type="button"
                        role="radio"
                        [class.o-chip--accent]="focus() === s"
                        [attr.aria-checked]="focus() === s"
                        (click)="focus.set(s)"
                      >
                        {{ 'skills.' + s | t }}
                      </button>
                    }
                  </div>
                </div>
              }
              @if (editing() && !mustPlan()) {
                <button class="o-btn o-btn--ghost o-btn--small" type="button" (click)="keepPlan()">
                  {{ 'ui.chapter.planKeep' | t }}
                </button>
              }
            </section>
          } @else if (planSummary().length) {
            <section class="o-card plan-sum">
              <span class="grow">
                <span class="o-label">{{ 'ui.chapter.plan' | t }}</span>
                <span class="small">
                  @for (p of planSummary(); track p.id; let last = $last) {
                    {{ p.nameKey | t }}
                    @if (p.focus) {
                      ({{ 'skills.' + p.focus | t }})
                    }
                    @if (!last) {
                      ·
                    }
                  }
                </span>
              </span>
              <button
                class="o-btn o-btn--ghost o-btn--small"
                type="button"
                [disabled]="busy() || !canEditPlan()"
                (click)="editing.set(true)"
              >
                {{ 'ui.chapter.planChange' | t }}
              </button>
            </section>
          }

          @if (v.pendingNews > 0) {
            <a class="news" routerLink="/evento">
              <span class="news-mast">
                <span class="o-kicker">{{ 'ui.week.breaking' | t }}</span>
                <span class="news-paper">{{ 'ui.paper.name' | t }}</span>
              </span>
              <span class="news-title">{{ 'ui.week.newsWaiting' | t: { n: v.pendingNews } }}</span>
            </a>
          }

          @if (v.window || v.offers > 0) {
            <a class="o-card window" routerLink="/mercato">
              <span class="o-label">{{
                (v.window ? 'ui.market.window.' + v.window : 'ui.market.title') | t
              }}</span>
              <span>{{ 'ui.week.offers' | t: { n: v.offers } }}</span>
            </a>
          }

          @if (!planOpen() && !matchFirst()) {
            <app-tip tip="week.cta" />
          }
          <app-tip tip="week.tabs" />
          <app-tip tip="week.done" />

          <div class="cta">
            @if (!matchFirst()) {
              <button class="o-btn" type="button" [disabled]="busy() || !canAct()" (click)="act()">
                {{ ctaKey() | t }}
                <ion-icon name="arrow-forward" aria-hidden="true"></ion-icon>
              </button>
            }
          </div>
        </main>
      }
    </ion-content>
    <app-tab-bar active="week" />
  `,
  styles: `
    .last-plan {
      margin: 0;
    }
    .press-call {
      flex-direction: row;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      color: var(--o-text);
      --px-b: var(--o-accent);
    }
    .press-call > ion-icon:first-child {
      font-size: 26px;
      color: var(--o-accent-fg);
    }
    .press-call .grow {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .club {
      display: flex;
      align-items: center;
      gap: var(--o-space-3);
      padding: 18px var(--o-space-4) 14px;
      border-bottom: 1px solid var(--o-border);
      max-width: 480px;
      margin: 0 auto;
    }
    .club-text {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .club-name {
      font-family: var(--o-font-display);
      font-weight: 700;
      font-size: 22px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      line-height: 1;
    }
    .small {
      font-size: var(--o-text-sm);
    }
    .headline {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--o-space-3);
    }
    .when,
    .who {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .who {
      align-items: flex-end;
      text-align: right;
    }
    .big {
      font-size: 64px;
      line-height: 0.85;
    }
    .name {
      font-family: var(--o-font-display);
      font-weight: 700;
      font-size: 20px;
    }
    .cash {
      margin-top: 6px;
      text-decoration: none;
      padding: 4px 10px;
      font-size: 12px;
      gap: 6px;
      color: var(--o-text);
    }
    .cash app-px-icon {
      color: #f2b830;
    }
    .injury {
      flex-direction: row;
      align-items: center;
      --px-b: var(--o-negative);
      font-size: 13px;
    }
    .injury ion-icon {
      font-size: 20px;
      color: var(--o-negative);
      flex: 0 0 auto;
    }
    .condition {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }
    .cond {
      display: flex;
      align-items: flex-end;
      gap: 6px;
      min-width: 0;
    }
    .cond app-px-icon {
      flex: 0 0 auto;
      color: var(--o-accent-fg);
      margin-bottom: 2px;
    }
    .cond app-stat-bar {
      flex: 1 1 auto;
    }
    .match {
      padding: 0;
      gap: 0;
      overflow: hidden;
    }
    .match-top {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 12px 16px 0;
      color: var(--o-text-soft);
    }
    .match-comp {
      padding: 2px 16px 0;
      font-family: var(--o-font-display);
      font-weight: 600;
      font-size: 15px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .teams {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px 14px;
    }
    .team {
      width: 130px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      font-family: var(--o-font-display);
      font-weight: 700;
      font-size: 17px;
      text-transform: uppercase;
      text-align: center;
    }
    .vs {
      font-size: 32px;
      color: var(--o-accent-fg);
    }
    .kickoff {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 14px 16px 16px;
      border-top: 1px solid var(--o-border);
    }
    .after-plan {
      margin: 0;
      text-align: center;
    }
    .match-foot {
      padding: 10px 16px;
      font-size: var(--o-text-sm);
      color: var(--o-text-soft);
      background: var(--o-hero-foot);
    }
    .plan {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .action {
      min-height: 72px;
      align-items: flex-start;
    }
    .clamp {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .focus {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    /* Prima pagina dello stop: testata, filetto doppio, titolo d'apertura e due di spalla. */
    .front {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 12px 16px 12px;
      background: var(--o-paper);
      color: var(--o-ink);
      box-shadow: 4px 4px 0 0 var(--o-ink);
      animation: o-front-in 240ms ease-out both;
    }
    .front-mast {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding-bottom: 6px;
      margin-bottom: 2px;
      border-bottom: 3px double var(--o-ink);
    }
    .front-title {
      margin: 0;
      font-family: var(--o-font-display);
      font-weight: 700;
      font-size: 17px;
      line-height: 1.1;
      text-transform: uppercase;
    }
    .front-title + .front-title {
      padding-top: 6px;
      border-top: 1px solid var(--o-paper-rule);
    }
    .front-title.lead {
      font-weight: 800;
      font-size: 26px;
      line-height: 1.02;
    }
    .front-title.quiet {
      font-size: 18px;
      color: var(--o-ink-muted);
    }
    .front-foot {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px 10px;
      padding-top: 8px;
      border-top: 1px solid var(--o-ink);
      font-size: 12px;
      font-weight: 600;
      color: var(--o-ink-muted);
    }
    .front-ratings {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }
    .rating {
      min-width: 28px;
      padding: 1px 4px;
      text-align: center;
      font-size: 15px;
      color: var(--o-ink);
      border: 1.5px solid var(--o-ink);
    }
    .rating[data-tone='good'] {
      color: var(--o-ink-pos);
      border-color: var(--o-ink-pos);
    }
    .rating[data-tone='bad'] {
      color: var(--o-ink-neg);
      border-color: var(--o-ink-neg);
    }
    @keyframes o-front-in {
      from {
        opacity: 0;
        transform: translateY(-6px) rotate(-0.6deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .front {
        animation: none;
      }
    }
    /* Obiettivo del capitolo: tacche come le giornate segnate a matita sul calendario. */
    .goal {
      gap: 8px;
      --px-b: var(--o-accent);
    }
    .goal-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .goal-text {
      margin: 0;
      font-family: var(--o-font-display);
      font-weight: 600;
      font-size: 18px;
      line-height: 1.2;
    }
    .ticks {
      display: flex;
      gap: 4px;
    }
    .tick {
      flex: 1 1 0;
      max-width: 36px;
      height: 10px;
      background: var(--o-border-strong);
    }
    .tick.on {
      background: var(--o-accent);
    }
    .stamp {
      padding: 2px 8px;
      font-family: var(--o-font-display);
      font-weight: 800;
      font-size: 13px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--o-positive);
      border: 2px solid var(--o-positive);
      transform: rotate(-3deg);
    }
    .goal.met {
      --px-b: var(--o-positive);
    }
    .mode-tag {
      padding: 1px 6px;
      font-size: 11px;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      color: var(--o-accent-fg);
      border: 1px solid currentColor;
    }
    .mode-tag.quick {
      color: var(--o-text-soft);
    }
    .none {
      margin: 0;
      text-align: center;
    }
    .picks {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .picks ol {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .pick {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 44px;
    }
    .pick .grow {
      flex: 1 1 auto;
      font-family: var(--o-font-display);
      font-weight: 600;
      text-transform: uppercase;
    }
    .pick.next .grow {
      color: var(--o-accent-fg);
    }
    .pick.done {
      opacity: 0.7;
    }
    .result {
      min-width: 20px;
      text-align: right;
      font-size: 18px;
    }
    .result[data-outcome='win'] {
      color: var(--o-positive);
    }
    .result[data-outcome='loss'] {
      color: var(--o-negative);
    }
    .plan-sum {
      flex-direction: row;
      align-items: center;
      gap: 12px;
    }
    .plan-sum > .o-btn {
      flex: 0 0 auto;
      width: auto;
    }
    .plan-sum .grow {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    /* Striscia di prima pagina: testata sottile, filetto doppio, titolo grande. */
    .news {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px 16px 14px;
      background: var(--o-paper);
      color: var(--o-ink);
      text-decoration: none;
      box-shadow: 4px 4px 0 0 var(--o-ink);
    }
    .news-mast {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding-bottom: 6px;
      border-bottom: 3px double var(--o-ink);
    }
    .news-paper {
      font-family: var(--o-font-display);
      font-weight: 800;
      font-size: 13px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--o-ink-muted);
    }
    .news-title {
      font-family: var(--o-font-display);
      font-weight: 800;
      font-size: 24px;
      line-height: 1.05;
      text-transform: uppercase;
    }
    .window {
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      text-decoration: none;
      color: var(--o-text);
      font-size: 13px;
      --px-b: var(--o-accent);
    }
    .last {
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
    }
    .cta {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: var(--o-space-2);
    }
  `,
})
export class WeekPage {
  protected readonly game = inject(GameService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly ctx = this.game.ctx;
  /** Capitolo (stagione:capitolo:apertura) per cui il piano è già stato proposto. */
  private prefilledKey = '';

  protected readonly ordinal = ordinal;
  protected readonly skills = SKILLS;
  protected readonly maxActions = this.ctx.config.progression.actionsPerWeek;
  protected readonly step = this.game.nextStep;
  protected readonly kickoffHint = computed(() => kickoffHintKey(this.step()));
  protected readonly saveFailed = this.game.saveFailed;
  protected readonly busy = signal(false);
  protected readonly choices = signal<string[]>([]);
  protected readonly focus = signal<Skill | null>(null);
  /** Il giocatore ha aperto il piano per cambiarlo a uno stop qualsiasi. */
  protected readonly editing = signal(false);
  protected readonly conditionRows = [
    { key: 'form', icon: 'form', label: 'ui.stats.form' },
    { key: 'energy', icon: 'energy', label: 'ui.stats.energy' },
    { key: 'morale', icon: 'morale', label: 'ui.stats.morale' },
  ] as const;

  protected readonly view = computed(() => {
    const s = this.game.state();
    if (!s) return null;
    const p = s.player;
    return {
      club: clubInfo(s, this.ctx),
      // Prima della prima giornata la posizione in classifica non significa nulla.
      played: clubInfo(s, this.ctx)?.table.some((r) => r.played > 0) ?? false,
      season: s.season,
      week: seasonWeekNumber(s, this.ctx),
      name: `${p.firstName} ${p.lastName}`,
      role: p.role,
      age: playerAge(s, this.ctx),
      ovr: this.game.ovr(),
      cash: formatMoney(p.money.cash),
      condition: p.condition,
      injury: p.injury && p.injury.weeksLeft > 0 ? p.injury : null,
      pendingNews: s.pendingEvents.length,
      window: getTransferWindow(s, this.ctx),
      offers: s.offers.length,
    };
  });

  protected readonly chapterId = computed(() => this.game.state()?.chapter.id ?? 'preseason');
  protected readonly lastStopKind = computed(() => this.game.lastStop()?.stop ?? null);

  protected readonly goal = computed(() => {
    const s = this.game.state();
    return s ? goalView(s, this.ctx) : null;
  });

  protected readonly picks = computed(() => {
    const s = this.game.state();
    return s ? chapterPicks(s, this.ctx) : [];
  });

  protected readonly nextPick = computed(() => this.picks().find((p) => p.next) ?? null);

  /** La prima pagina dell'ultimo stop: titoli, settimane trascorse e voti delle partite simulate. */
  protected readonly frontPage = computed(() => {
    const r = this.game.lastStop();
    if (!r) return null;
    const pass = this.ctx.config.calendar.headlines.ratingFrom;
    return {
      stop: r.stop,
      headlines: r.headlines,
      weeks: r.weeks,
      record: r.record,
      ratings: r.summary
        .filter((m) => m.rating !== null)
        .map((m) => ({
          text: formatRating(m.rating),
          tone: m.rating! >= pass ? 'good' : m.rating! < 6 ? 'bad' : 'mid',
        })),
    };
  });

  /** Opzioni del piano: le serate si scelgono di persona, il piano del capitolo non le ripete. */
  protected readonly options = computed(() => {
    const s = this.game.state();
    return s ? getWeekOptions(s, this.ctx).filter((o) => o.kind !== 'party') : [];
  });

  /** Piano obbligatorio: inizio stagione o nuovo capitolo. */
  protected readonly mustPlan = computed(() => {
    const s = this.game.state();
    return !!s && this.step() === 'advance' && needsPlan(s, this.ctx, this.lastStopKind());
  });

  protected readonly canEditPlan = computed(() => this.step() === 'advance');
  protected readonly planOpen = computed(
    () => this.mustPlan() || (this.editing() && this.canEditPlan()),
  );

  protected readonly planSummary = computed(() => {
    const s = this.game.state();
    if (!s) return [];
    const byId = new Map(getWeekOptions(s, this.ctx).map((o) => [o.id, o]));
    return s.chapterPlan.flatMap((c) => {
      const o = byId.get(c.actionId);
      return o ? [{ id: c.actionId, nameKey: o.nameKey, focus: c.focus ?? null }] : [];
    });
  });

  /** Conferenza stampa disponibile (presentazione o vigilia di una grande partita). */
  protected readonly press = computed(() => {
    const s = this.game.state();
    return s && !s.retired ? getPressConference(s, this.ctx) : null;
  });

  protected readonly needsFocus = computed(() =>
    this.options().some((o) => o.needsFocus && this.choices().includes(o.id)),
  );

  protected readonly ctaKey = computed(() => {
    switch (this.step()) {
      case 'events':
        return 'ui.week.cta.events';
      case 'seasonOver':
        return 'ui.week.cta.season';
      case 'retired':
        return 'ui.week.cta.retired';
      // Partita aperta senza pick (salvataggio del ciclo settimanale): si riprende da qui.
      case 'matchInProgress':
        return 'ui.week.cta.resume';
      case 'match':
        return 'ui.week.play';
      default:
        return this.planOpen() ? 'ui.week.cta.planAndGo' : 'ui.week.cta.advance';
    }
  });

  /** Partita da giocare o da riprendere: il pulsante sta nella scheda partita, non in fondo. */
  protected readonly matchFirst = computed(
    () => (this.step() === 'match' || this.step() === 'matchInProgress') && !!this.nextPick(),
  );

  protected readonly canAct = computed(
    () =>
      !this.planOpen() ||
      (this.choices().length > 0 && (!this.needsFocus() || this.focus() !== null)),
  );

  constructor() {
    // Il piano proposto è quello del capitolo (o l'ultimo ricordato), una volta per apertura.
    effect(() => {
      const s = this.game.state();
      if (!s || !this.planOpen()) return;
      const key = `${s.season}:${s.chapter.id}:${this.editing()}`;
      if (this.prefilledKey === key) return;
      this.prefilledKey = key;
      const available = new Set(
        this.options()
          .filter((o) => o.available)
          .map((o) => o.id),
      );
      const remembered = s.chapterPlan.length > 0 ? s.chapterPlan : (s.lastPlan ?? []);
      const last = remembered.filter((c) => available.has(c.actionId));
      this.choices.set(last.map((c) => c.actionId).slice(0, this.maxActions));
      this.focus.set(last.find((c) => c.focus)?.focus ?? null);
    });
    addIcons({ arrowForward, chatbubblesOutline, micOutline, settingsOutline, medkitOutline });
  }

  /** Annulla le modifiche: alla prossima apertura il piano si ricarica da quello salvato. */
  protected keepPlan(): void {
    this.prefilledKey = '';
    this.editing.set(false);
  }

  protected range(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  protected whenKey(weeks: number): string {
    if (weeks === 0) return 'ui.week.thisWeek';
    return weeks === 1 ? 'ui.week.nextWeek' : 'ui.week.inWeeks';
  }

  protected isChosen(id: string): boolean {
    return this.choices().includes(id);
  }

  protected toggle(id: string, needsFocus: boolean): void {
    this.choices.update((list) =>
      list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
    );
    if (needsFocus && !this.choices().includes(id)) this.focus.set(null);
  }

  protected async act(): Promise<void> {
    await this.run(async () => {
      switch (this.step()) {
        case 'events':
          await this.router.navigateByUrl('/evento');
          break;
        case 'match':
        case 'matchInProgress':
          await this.router.navigateByUrl('/partita');
          break;
        case 'seasonOver':
          await this.game.closeSeason();
          await this.router.navigateByUrl(this.game.state()?.retired ? '/fine' : '/stagione');
          break;
        case 'retired':
          await this.router.navigateByUrl('/fine');
          break;
        default: {
          if (this.planOpen()) {
            const focusIds = new Set(
              this.options()
                .filter((o) => o.needsFocus)
                .map((o) => o.id),
            );
            await this.game.setPlan(
              this.choices().map((actionId) =>
                focusIds.has(actionId) ? { actionId, focus: this.focus()! } : { actionId },
              ),
            );
            this.editing.set(false);
          }
          const report = await this.game.advanceToStop();
          if (report.stop === 'retired') await this.router.navigateByUrl('/fine');
          else if (report.stop === 'news') await this.router.navigateByUrl('/evento');
        }
      }
    });
  }

  protected async playMatch(): Promise<void> {
    await this.router.navigateByUrl('/partita');
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await fn();
    } catch {
      await this.toast.show(this.i18n.t('ui.common.error'), 'error');
    } finally {
      this.busy.set(false);
    }
  }
}
