import type { ElementRef } from '@angular/core';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  Injector,
  signal,
  viewChild,
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
  getPlanOptions,
  SKILLS,
  type LifeAction,
  type Load,
  type Skill,
  type WeekPlan,
} from '@outstanding/engine';
import {
  chapterHint,
  chapterPicks,
  goalView,
  needsPlan,
  planStretchLine,
  pointFlashes,
} from '../core/chapter-view';
import { lineText, planIssuesView, planSheetView, type TextLine } from '../core/plan-sheet-view';
import { GameService } from '../core/game.service';
import { I18nService, TranslatePipe } from '../core/i18n.service';
import { kickoffHintKey } from '../core/match-mode';
import { formatMoney, formatRating, levelTone, ordinal } from '../core/text';
import { SoundService } from '../core/sound.service';
import { ToastService } from '../core/toast.service';
import { clubInfo, playerAge, seasonWeekNumber } from '../core/views';
import { CrestComponent } from '../ui/crest.component';
import { PxIconComponent } from '../ui/px-icon.component';
import { StatBarComponent } from '../ui/stat-bar.component';
import { TabBarComponent } from '../ui/tab-bar.component';
import { TipComponent } from '../ui/tip.component';

/** Durata del lampo del +1: dentro la finestra di 150–300 ms del design system, più un margine. */
const FLASH_MS = 400;

/**
 * Home del capitolo, in tre strati: stato e avvisi in alto, la prossima partita da vivere, il
 * capitolo (obiettivo con premio, partite scelte, piano). Un solo pulsante in basso. La prima
 * pagina dello stop è un foglio che si apre sopra e si chiude; il piano, quando va scelto, prende
 * il posto di partita e capitolo.
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
        <header class="club" [attr.inert]="frontOpen() ? '' : null">
          @if (v.club) {
            <app-crest [crest]="v.club.club.crest" [size]="40" [label]="v.club.club.name" />
            <div class="club-text">
              <span class="club-name">{{ v.club.club.name }}</span>
              <span class="o-muted small">
                {{ v.club.leagueKey | t }}
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

        <main class="o-wrap o-enter" [attr.inert]="frontOpen() ? '' : null">
          <!-- Una riga di stato: quando, chi, quanto vale, come sta. -->
          <section class="status" [attr.aria-label]="'ui.week.condition' | t">
            <div class="status-top">
              <span class="o-label">{{
                'ui.week.status' | t: { season: v.season, week: v.week }
              }}</span>
              <span class="status-chips">
                <span class="o-chip ovr"
                  >OVR <strong class="o-num">{{ v.ovr }}</strong></span
                >
                <a class="o-chip cash" routerLink="/vita">
                  <app-px-icon name="cash" aria-hidden="true" />{{ v.cash }}
                </a>
              </span>
            </div>
            <div class="meters">
              @for (c of conditionRows; track c.key) {
                <div class="meter">
                  <app-px-icon [name]="c.icon" [size]="16" aria-hidden="true" />
                  <app-stat-bar [label]="c.label | t" [value]="v.condition[c.key]" tone="auto" />
                </div>
              }
            </div>
          </section>

          <app-tip tip="week.welcome" />

          <!-- Avvisi: compaiono solo quando servono, una riga ciascuno. -->
          @if (
            v.injury || saveFailed() || v.pendingNews > 0 || v.window || v.offers > 0 || press()
          ) {
            <ul class="alerts o-lines">
              @if (v.injury; as inj) {
                <li class="o-line alert bad" role="status">
                  <ion-icon name="medkit-outline" aria-hidden="true"></ion-icon>
                  <span class="grow">{{
                    'ui.week.injuredShort'
                      | t: { injury: ('injuries.' + inj.type | t), weeks: inj.weeksLeft }
                  }}</span>
                </li>
              }
              @if (saveFailed()) {
                <li class="o-line alert bad" role="alert">
                  <span class="grow">{{ 'ui.week.saveFailed' | t }}</span>
                </li>
              }
              @if (v.pendingNews > 0) {
                <li>
                  <a class="o-line alert hot" routerLink="/evento">
                    <app-px-icon name="news" [size]="16" aria-hidden="true" />
                    <span class="grow">{{ 'ui.week.newsWaiting' | t: { n: v.pendingNews } }}</span>
                    <ion-icon name="arrow-forward" aria-hidden="true"></ion-icon>
                  </a>
                </li>
              }
              @if (v.window || v.offers > 0) {
                <li>
                  <a class="o-line alert" routerLink="/mercato">
                    <app-px-icon name="market" [size]="16" aria-hidden="true" />
                    <span class="grow"
                      >{{ (v.window ? 'ui.market.window.' + v.window : 'ui.market.title') | t }} ·
                      {{ 'ui.week.offers' | t: { n: v.offers } }}</span
                    >
                    <ion-icon name="arrow-forward" aria-hidden="true"></ion-icon>
                  </a>
                </li>
              }
              @if (press(); as pr) {
                <li>
                  <a class="o-line alert" routerLink="/conferenza">
                    <ion-icon name="mic-outline" aria-hidden="true"></ion-icon>
                    <span class="grow">{{ 'ui.press.kind.' + pr.kind | t: pr.params }}</span>
                    <ion-icon name="arrow-forward" aria-hidden="true"></ion-icon>
                  </a>
                </li>
              }
            </ul>
          }

          @if (planOpen()) {
            <!-- Agli stop di capitolo il piano prende tutta la scena: una cosa alla volta. -->
            <section class="o-card plan" [attr.aria-label]="'ui.chapter.plan' | t">
              @if (sheet(); as ps) {
                <div class="plan-mast">
                  <h2 class="plan-title">
                    {{ 'ui.plan.kicker' | t: { chapter: (ps.header.chapterKey | t) } }}
                  </h2>
                  <span class="plan-span">{{ 'ui.plan.span' | t: ps.header }}</span>
                </div>
                <p class="o-muted small last-plan">
                  {{
                    (lastStopKind() === 'chapterEnd' ? 'ui.chapter.planNew' : 'ui.chapter.planHint')
                      | t
                  }}
                </p>
                <app-tip tip="week.plan" />
                @if (ps.dropped; as d) {
                  <p class="notice" role="status">
                    {{
                      'ui.plan.dropped' | t: { life: (d.nameKey | t), reason: (d.reasonKey | t) }
                    }}
                  </p>
                }

                <!-- Binario 1: in campo. -->
                <h3 class="track">{{ 'ui.plan.field' | t }}</h3>
                @if (ps.forced) {
                  <p class="notice bad" role="status">
                    {{ 'ui.plan.forced' | t: { load: (ps.loadShownKey | t) } }}
                  </p>
                }
                <div class="loads" role="radiogroup" [attr.aria-label]="'ui.week.loadTitle' | t">
                  @for (l of ps.loads; track l.id) {
                    <button
                      class="o-choice load"
                      type="button"
                      role="radio"
                      [attr.aria-checked]="l.selected"
                      [class.o-choice--selected]="l.selected"
                      [attr.aria-describedby]="'plan-load-' + l.id"
                      [disabled]="l.disabled"
                      (click)="load.set(l.id)"
                    >
                      <span class="load-name">{{ l.nameKey | t }}</span>
                      <span class="load-hint">{{ 'ui.plan.loadHint' | t: l.hintParams }}</span>
                      <span class="o-visually-hidden" [id]="'plan-load-' + l.id">{{
                        l.descKey | t
                      }}</span>
                    </button>
                  }
                </div>
                <div class="focus" role="radiogroup" [attr.aria-label]="'ui.week.focus' | t">
                  <span class="o-label">{{ 'ui.week.focus' | t }}</span>
                  <div class="chips">
                    <button
                      class="o-chip"
                      type="button"
                      role="radio"
                      [class.o-chip--accent]="focus() === null"
                      [attr.aria-checked]="focus() === null"
                      (click)="focus.set(null)"
                    >
                      {{ 'ui.week.focusNone' | t }}
                    </button>
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

                <!-- Lettura del piano: i numeri vengono tutti dall'anteprima del motore. -->
                <div class="readout">
                  @let fr = ps.freshness;
                  <div class="read-row">
                    <span class="read-label">
                      {{ fr.labelKey | t }}
                      @if (fr.starter) {
                        <em class="starter">({{ 'ui.plan.ifStarter' | t }})</em>
                      }
                    </span>
                    <span class="read-value">
                      @for (n of [fr.value]; track n) {
                        <span class="o-num big tick-in">~{{ n }}</span>
                      }
                      @if (fr.moments; as m) {
                        <span class="moments">{{ 'ui.plan.moments' | t: { pct: m } }}</span>
                      }
                    </span>
                  </div>
                  <div class="fbar" aria-hidden="true">
                    <div
                      class="fbar-fill"
                      [attr.data-tone]="tone(fr.value)"
                      [style.width.%]="fr.value"
                    ></div>
                    <div class="fbar-locked" [style.left.%]="fr.cap"></div>
                    <div class="fbar-now" [style.left.%]="fr.now"></div>
                    <div class="fbar-cap" [style.left.%]="fr.cap"></div>
                  </div>
                  <div class="fbar-legend small">
                    <span>{{ 'ui.plan.now' | t: { n: fr.now } }}</span>
                    <span>{{ 'ui.plan.cap' | t: { cap: fr.cap } }}</span>
                  </div>
                  @if (fr.fall > 0) {
                    <p class="read-note">{{ 'ui.plan.fall' | t: { n: fr.fall } }}</p>
                  }
                  @if (fr.capCut > 0) {
                    <p class="read-note">
                      {{ 'ui.plan.capCut' | t: { cap: fr.cap, n: fr.capCut } }}
                    </p>
                  }
                  @if (ps.bench; as b) {
                    <p class="read-note warn">{{ 'ui.plan.bench' | t: { n: b } }}</p>
                  }

                  <div class="read-row line">
                    <span class="read-label">{{ 'ui.plan.riskTitle' | t }}</span>
                    <span class="read-value">
                      @for (r of [ps.risk.key]; track r) {
                        <strong class="risk tick-in" [attr.data-band]="ps.risk.band">{{
                          r | t
                        }}</strong>
                      }
                      <span class="o-muted small">{{
                        'ui.plan.riskPct' | t: { pct: ps.risk.pct }
                      }}</span>
                    </span>
                  </div>

                  @if (ps.skill; as sk) {
                    <div class="read-row line">
                      <span class="read-label">{{ sk.nameKey | t }}</span>
                      <span class="skill-track">
                        <span class="o-num mid">{{ sk.value }}</span>
                        <span class="sbar" aria-hidden="true">
                          <span class="sbar-fill" [style.width.%]="sk.fraction * 100"></span>
                        </span>
                        <span class="o-num mid soft">{{ sk.next }}</span>
                      </span>
                    </div>
                    <p class="read-note">
                      @if (sk.weeks !== null) {
                        {{ 'ui.plan.nextIn' | t: { n: sk.weeks } }}
                      } @else {
                        {{ 'ui.plan.nextBeyond' | t }}
                      }
                      · {{ 'ui.plan.paceTitle' | t }}: <strong>{{ ps.pace.key | t }}</strong> ({{
                        ps.pace.reasonKey | t: ps.pace.reasonParams
                      }})
                    </p>
                  }
                  @if (ps.decline; as dc) {
                    <p class="read-note">{{ 'ui.plan.decline' | t: { pct: dc } }}</p>
                  }
                </div>

                <!-- Binario 2: fuori dal campo, al massimo un'azione. -->
                <h3 class="track">{{ 'ui.plan.off' | t }}</h3>
                <div class="lifes" role="radiogroup" [attr.aria-label]="'ui.week.lifeTitle' | t">
                  @for (o of ps.life; track o.id) {
                    <button
                      class="o-chip life"
                      type="button"
                      role="radio"
                      [class.o-chip--accent]="o.selected"
                      [attr.aria-checked]="o.selected"
                      [attr.aria-describedby]="'plan-life-' + o.id"
                      [disabled]="o.disabled"
                      (click)="life.set(o.id === 'none' ? null : o.id)"
                    >
                      {{ o.nameKey | t }}
                      <span class="o-visually-hidden" [id]="'plan-life-' + o.id">{{
                        o.reasonKey ?? o.descKey | t
                      }}</span>
                    </button>
                  }
                </div>
                @for (o of ps.life; track o.id) {
                  @if (o.disabled && o.reasonKey) {
                    <p class="blocked small">{{ o.nameKey | t }}: {{ o.reasonKey | t }}</p>
                  }
                }
                <ul class="life-lines">
                  @for (ln of ps.lifeLines; track ln.key) {
                    <li class="tick-in">{{ text(ln) }}</li>
                  }
                </ul>
                @if (!ps.canConfirm) {
                  <p class="notice bad" role="alert">{{ 'ui.plan.blocked' | t }}</p>
                }
                <p class="o-visually-hidden" aria-live="polite">{{ announce() }}</p>
              }
              @if (editing() && !mustPlan()) {
                <button class="o-btn o-btn--ghost o-btn--small" type="button" (click)="keepPlan()">
                  {{ 'ui.chapter.planKeep' | t }}
                </button>
              }
            </section>
          } @else {
            @if (nextPick(); as np) {
              @let f = np.view;
              <section
                class="o-card o-card--hero match"
                [attr.aria-label]="'ui.week.nextMatch' | t"
              >
                <div class="match-top o-label">
                  <span>{{ whenKey(f.inWeeks) | t: { n: f.inWeeks } }}</span>
                  <span class="mode-tag" [class.quick]="np.mode === 'quick'">{{
                    'ui.chapter.mode.' + np.mode | t
                  }}</span>
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
                  {{ f.competitionKey | t }} ·
                  @if (f.stageKey) {
                    {{ f.stageKey | t }}
                  } @else {
                    {{ ordinal(f.fixture.matchday) }} {{ 'ui.week.matchday' | t }}
                  }
                  @if (f.opponentPosition) {
                    · {{ 'ui.week.opponentPos' | t: { pos: ordinal(f.opponentPosition) } }}
                  }
                  · {{ 'ui.week.opponentRating' | t: { rating: f.opponent.rating } }}
                </div>
                @if (step() === 'advance' && f.inWeeks === 0 && kickoffHint(); as hint) {
                  <p class="o-muted small after-plan">{{ hint | t }}</p>
                }
              </section>
            } @else if (v.club && step() !== 'seasonOver') {
              <p class="o-muted small none">{{ 'ui.chapter.picksNone' | t }}</p>
            }

            <!-- Il capitolo in una scheda: obiettivo con premio, partite da vivere, piano. -->
            <section
              class="o-card chapter"
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
                <span class="reward small">
                  <app-px-icon name="new" [size]="16" aria-hidden="true" />
                  {{ 'ui.chapter.reward' | t: g.reward }}
                </span>
              } @else {
                <p class="goal-text quiet">{{ 'ui.chapter.noGoal' | t }}</p>
              }

              @if (picks().length > 0) {
                <div class="rows">
                  <span class="o-label">{{ 'ui.chapter.picks' | t }}</span>
                  <ol class="dots">
                    @for (pk of picks(); track pk.view.fixture.id) {
                      <li
                        class="dot"
                        [class.next]="pk.next"
                        [class.quick]="pk.mode === 'quick'"
                        [attr.data-outcome]="pk.outcome"
                        [attr.aria-label]="
                          pk.view.opponent.shortName +
                          (pk.outcome ? ' · ' + ('ui.chapter.outcome.' + pk.outcome | t) : '')
                        "
                      >
                        @if (pk.outcome; as o) {
                          {{ 'ui.chapter.outcome.' + o | t }}
                        } @else {
                          <app-crest [crest]="pk.view.opponent.crest" [size]="20" />
                        }
                      </li>
                    }
                  </ol>
                </div>
              }

              <div class="rows plan-line">
                <span class="grow">
                  <span class="o-label">{{ 'ui.chapter.planLine' | t }}</span>
                  <span class="small">
                    @for (p of planSummary(); track p.key; let last = $last) {
                      {{ p.key | t }}
                      @if (p.focus) {
                        ({{ 'skills.' + p.focus | t }})
                      }
                      @if (!last) {
                        ·
                      }
                    } @empty {
                      {{ 'ui.chapter.planNoneYet' | t }}
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
              </div>

              @if (planResult(); as pr) {
                <!-- Dal piano: quello che il piano ha fatto dall'ultimo stop, solo le voci mosse. -->
                <div class="rows from-plan" [class.flashing]="flashing()">
                  <span class="o-label">{{ 'ui.planLog.title' | t }}</span>
                  <ul class="from-lines small" [attr.aria-label]="'ui.planLog.since' | t">
                    @for (l of pr.lines; track $index) {
                      <li [class.up]="l.up > 0">
                        {{ l.text }}
                        @if (l.up > 0) {
                          <span class="point" aria-hidden="true">{{
                            'ui.planLog.point' | t: { n: l.up }
                          }}</span>
                        }
                      </li>
                    }
                  </ul>
                </div>
              }
            </section>
          }

          @if (!planOpen()) {
            <app-tip tip="week.cta" />
          }
          <app-tip tip="week.condition" />
          <app-tip tip="week.tabs" />
          <app-tip tip="week.done" />

          <div class="cta">
            <button
              class="o-btn"
              type="button"
              [disabled]="busy() || (planOpen() && sheet()?.canConfirm === false)"
              (click)="act()"
            >
              {{ ctaKey() | t }}
              <ion-icon name="arrow-forward" aria-hidden="true"></ion-icon>
            </button>
          </div>
        </main>

        @if (frontOpen() && frontPage(); as fp) {
          <!-- Prima pagina dello stop: si legge una volta, poi si chiude. -->
          <div
            class="sheet"
            role="dialog"
            aria-modal="true"
            [attr.aria-label]="'ui.stop.title' | t"
          >
            <section class="front">
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
              @if (fp.planBlock && planResult(); as pr) {
                <div class="front-plan" [class.flashing]="flashing()">
                  <span class="front-plan-title">{{ 'ui.planLog.title' | t }}</span>
                  <ul class="front-plan-lines">
                    @for (l of pr.lines; track $index) {
                      <li [class.up]="l.up > 0">
                        {{ l.text }}
                        @if (l.up > 0) {
                          <span class="point" aria-hidden="true">{{
                            'ui.planLog.point' | t: { n: l.up }
                          }}</span>
                        }
                      </li>
                    }
                  </ul>
                  @if (pr.hint; as h) {
                    <p class="front-plan-hint">{{ h.key | t: h.values }}</p>
                  }
                </div>
              }
              @for (pi of fp.issues; track pi.nameKey) {
                <p class="front-issue" role="status">
                  {{
                    'ui.stop.planIssue'
                      | t: { life: (pi.nameKey | t), n: pi.weeks, reason: (pi.reasonKey | t) }
                  }}
                </p>
              }
              <button #frontClose class="o-btn front-close" type="button" (click)="closeFront()">
                {{ 'ui.stop.continue' | t }}
              </button>
            </section>
          </div>
        }
      }
    </ion-content>
    <app-tab-bar active="week" />
  `,
  styles: `
    .small {
      font-size: var(--o-text-sm);
    }
    .grow {
      flex: 1 1 auto;
      min-width: 0;
    }
    .club {
      display: flex;
      align-items: center;
      gap: var(--o-space-3);
      padding: 14px var(--o-space-4) 12px;
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
      font-size: 20px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      line-height: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* Stato: una riga di testo e tre barre sottili, niente scheda. */
    .status {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .status-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .status-chips {
      display: flex;
      gap: 6px;
    }
    .ovr,
    .cash {
      padding: 3px 8px;
      font-size: 12px;
      gap: 5px;
      color: var(--o-text);
      text-decoration: none;
    }
    .ovr strong {
      font-size: 15px;
      color: var(--o-accent-fg);
    }
    .cash app-px-icon {
      color: var(--o-accent);
    }
    .meters {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .meter {
      display: flex;
      align-items: flex-end;
      gap: 5px;
      min-width: 0;
    }
    .meter app-px-icon {
      flex: 0 0 auto;
      color: var(--o-accent-fg);
      margin-bottom: 2px;
    }
    .meter app-stat-bar {
      flex: 1 1 auto;
    }
    /* Avvisi: righe sottili, il colore dice l'urgenza. */
    .alerts {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .alerts li {
      list-style: none;
    }
    .alert {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: var(--o-touch);
      font-size: 13px;
      color: var(--o-text);
      text-decoration: none;
    }
    .alert > ion-icon:first-child,
    .alert > app-px-icon {
      flex: 0 0 auto;
      font-size: 18px;
      color: var(--o-accent-fg);
    }
    .alert > ion-icon:last-child {
      color: var(--o-text-muted);
    }
    .alert.hot {
      font-weight: 600;
    }
    .alert.bad > ion-icon {
      color: var(--o-negative);
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
    .match-foot {
      padding: 10px 16px;
      font-size: var(--o-text-sm);
      color: var(--o-text-soft);
      background: var(--o-hero-foot);
    }
    .after-plan {
      margin: 0;
      padding: 10px 16px 12px;
      text-align: center;
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
    /* Capitolo: obiettivo in alto, poi le righe separate da un filetto. */
    .chapter {
      gap: 8px;
      --px-b: var(--o-accent);
    }
    .chapter.met {
      --px-b: var(--o-positive);
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
      font-size: 19px;
      line-height: 1.15;
    }
    .goal-text.quiet {
      font-size: 16px;
      color: var(--o-text-soft);
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
    .chapter.met .tick.on {
      background: var(--o-positive);
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
    .reward {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--o-accent-text);
    }
    .reward app-px-icon {
      color: var(--o-accent);
    }
    .rows {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-top: 10px;
      margin-top: 2px;
      border-top: 1px solid var(--o-border);
    }
    /* Partite da vivere: una tacca per partita, giocata = esito, prossima evidenziata. */
    .dots {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .dot {
      width: 34px;
      height: 34px;
      display: grid;
      place-items: center;
      font-family: var(--o-font-display);
      font-weight: 800;
      font-size: 17px;
      border: 2px solid var(--o-border-strong);
      color: var(--o-text-soft);
    }
    .dot.quick {
      border-style: dashed;
    }
    .dot.next {
      border-color: var(--o-accent);
      border-style: solid;
      background: var(--o-accent-soft);
    }
    .dot[data-outcome='win'] {
      color: var(--o-positive);
      border-color: var(--o-positive);
    }
    .dot[data-outcome='loss'] {
      color: var(--o-negative);
      border-color: var(--o-negative);
    }
    .plan-line {
      flex-direction: row;
      align-items: center;
      gap: 12px;
    }
    .plan-line .grow {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .plan-line > .o-btn {
      flex: 0 0 auto;
      width: auto;
    }
    .plan {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .last-plan {
      margin: 0;
    }
    /* Scheda del piano: testata da giornale, due binari, una lettura a numeri come un tabellone. */
    .plan-mast {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding-bottom: 8px;
      border-bottom: 3px double var(--o-border-strong);
    }
    .plan-title {
      margin: 0;
      font-family: var(--o-font-display);
      font-weight: 800;
      font-size: 24px;
      line-height: 1;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .plan-span {
      font-size: var(--o-text-sm);
      color: var(--o-accent-text);
    }
    .track {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 6px 0 0;
      font-family: var(--o-font-display);
      font-weight: 700;
      font-size: 15px;
      letter-spacing: 1.4px;
      text-transform: uppercase;
      color: var(--o-accent-fg);
    }
    .track::before {
      content: '';
      width: 8px;
      height: 8px;
      background: var(--o-accent);
    }
    .track::after {
      content: '';
      flex: 1 1 auto;
      height: 1px;
      background: var(--o-border-strong);
    }
    .notice {
      margin: 0;
      padding: 8px 10px;
      font-size: var(--o-text-sm);
      border-left: 3px solid var(--o-accent);
      background: var(--o-accent-soft);
    }
    .notice.bad {
      border-left-color: var(--o-negative);
      background: transparent;
      color: var(--o-text);
    }
    .loads {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }
    .load {
      min-height: 64px;
      padding: 8px 6px;
      flex-direction: column;
      justify-content: center;
      gap: 2px;
      text-align: center;
    }
    .load-name {
      font-family: var(--o-font-display);
      font-weight: 700;
      font-size: 18px;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      line-height: 1;
    }
    .load-hint {
      font-size: var(--o-text-xs);
      font-weight: 500;
      color: var(--o-text-muted);
    }
    .readout {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px 12px 12px;
      background: var(--o-bg-deep);
      border: 1px solid var(--o-border);
    }
    .read-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
    }
    .read-row.line {
      padding-top: 8px;
      margin-top: 2px;
      border-top: 1px solid var(--o-border);
    }
    .read-label {
      font-size: var(--o-text-sm);
      font-weight: 600;
    }
    .starter {
      font-style: italic;
      font-weight: 500;
      color: var(--o-text-muted);
    }
    .read-value {
      display: inline-flex;
      align-items: baseline;
      gap: 8px;
      white-space: nowrap;
    }
    .big {
      font-size: 28px;
      line-height: 1;
      color: var(--o-text);
    }
    .mid {
      font-size: 22px;
      line-height: 1;
    }
    .soft {
      color: var(--o-text-muted);
    }
    .moments {
      font-size: var(--o-text-sm);
      color: var(--o-accent-text);
    }
    /* Barra a dieci tacche: oltre il tetto del carico la zona è tratteggiata, irraggiungibile. */
    .fbar {
      position: relative;
      height: 14px;
      background: var(--o-track);
    }
    .fbar::after {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        90deg,
        transparent 0 calc(10% - 2px),
        var(--o-bg-deep) calc(10% - 2px) 10%
      );
      pointer-events: none;
    }
    .fbar-fill {
      position: absolute;
      inset: 0 auto 0 0;
      background: var(--o-accent);
      transition: width var(--o-normal) var(--o-ease);
    }
    .fbar-fill[data-tone='pos'] {
      background: var(--o-positive);
    }
    .fbar-fill[data-tone='neg'] {
      background: var(--o-negative);
    }
    .fbar-locked {
      position: absolute;
      inset: 0 0 0 auto;
      background: repeating-linear-gradient(
        135deg,
        var(--o-border-strong) 0 3px,
        transparent 3px 6px
      );
      transition: left var(--o-normal) var(--o-ease);
    }
    .fbar-cap {
      position: absolute;
      top: -4px;
      bottom: -4px;
      width: 3px;
      margin-left: -1px;
      background: var(--o-text);
      z-index: 1;
      transition: left var(--o-normal) var(--o-ease);
    }
    .fbar-now {
      position: absolute;
      top: -3px;
      width: 0;
      height: 0;
      margin-left: -5px;
      border: 5px solid transparent;
      border-top-color: var(--o-text-muted);
      z-index: 1;
    }
    .fbar-legend {
      display: flex;
      justify-content: space-between;
      color: var(--o-text-muted);
    }
    .read-note {
      margin: 0;
      font-size: var(--o-text-sm);
      color: var(--o-text-soft);
    }
    .read-note.warn {
      color: var(--o-accent-text);
    }
    .risk {
      font-family: var(--o-font-display);
      font-size: 18px;
      text-transform: uppercase;
      color: var(--o-positive);
    }
    .risk[data-band='medium'] {
      color: var(--o-accent-fg);
    }
    .risk[data-band='high'] {
      color: var(--o-negative);
    }
    .skill-track {
      flex: 0 1 60%;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .sbar {
      flex: 1 1 auto;
      height: 8px;
      background: var(--o-track);
    }
    .sbar-fill {
      display: block;
      height: 100%;
      background: var(--o-accent);
      transition: width var(--o-normal) var(--o-ease);
    }
    .lifes {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .life:disabled {
      opacity: 0.45;
      cursor: default;
    }
    .blocked {
      margin: 0;
      font-style: italic;
      color: var(--o-text-muted);
    }
    .life-lines {
      margin: 0;
      padding: 0 0 0 12px;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: var(--o-text-sm);
      border-left: 2px solid var(--o-accent);
    }
    /* I numeri che cambiano si riaccendono in 200 ms; con "riduci movimento" restano fermi. */
    .tick-in {
      animation: o-tick 200ms var(--o-ease) both;
    }
    span.tick-in,
    strong.tick-in {
      display: inline-block;
    }
    @keyframes o-tick {
      from {
        opacity: 0.2;
        transform: translateY(3px);
      }
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
    /* Un solo pulsante, sempre sotto il pollice. */
    .cta {
      position: sticky;
      bottom: 0;
      z-index: 2;
      margin-top: auto;
      padding: var(--o-space-3) 0 var(--o-space-2);
      background: linear-gradient(to bottom, transparent, var(--o-bg) 35%);
    }
    /* Prima pagina dello stop: un foglio di giornale sopra la home, si chiude con Continua. */
    .sheet {
      position: fixed;
      inset: 0;
      z-index: 20;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      /* La barra delle schede (64 px) resta sopra: il foglio si ferma prima. */
      padding: var(--o-space-4) var(--o-space-4)
        calc(64px + var(--o-space-4) + env(safe-area-inset-bottom));
      overflow-y: auto;
      background: rgba(4, 16, 10, 0.72);
      animation: o-fade var(--o-normal) ease-out both;
    }
    .front {
      width: 100%;
      max-width: 448px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 14px 16px 16px;
      background: var(--o-paper);
      color: var(--o-ink);
      box-shadow: 4px 4px 0 0 var(--o-ink);
      animation: o-front-in var(--o-slow) ease-out both;
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
    .news-paper {
      font-family: var(--o-font-display);
      font-weight: 800;
      font-size: 13px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--o-ink-muted);
    }
    .front-title {
      margin: 0;
      font-family: var(--o-font-display);
      font-weight: 700;
      font-size: 18px;
      line-height: 1.1;
      text-transform: uppercase;
    }
    .front-title + .front-title {
      padding-top: 6px;
      border-top: 1px solid var(--o-paper-rule);
    }
    .front-title.lead {
      font-weight: 800;
      font-size: 30px;
      line-height: 1;
    }
    .front-title.quiet {
      font-size: 20px;
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
    .front-issue {
      margin: 0;
      padding: 6px 8px;
      font-size: 13px;
      font-weight: 600;
      color: var(--o-ink-neg);
      border-left: 3px solid var(--o-ink-neg);
    }
    .front-close {
      margin-top: 6px;
    }
    .from-plan {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }
    .from-lines,
    .front-plan-lines {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 2px 10px;
    }
    .from-lines li {
      color: var(--o-text-soft);
    }
    .from-lines li + li::before {
      content: '·';
      margin-right: 10px;
      color: var(--o-text-muted);
    }
    li.up {
      font-weight: 700;
      color: var(--o-text);
    }
    .point {
      display: inline-block;
      margin-left: 4px;
      padding: 0 4px;
      font-family: var(--o-font-pixel);
      font-size: 15px;
      line-height: 1.1;
      color: var(--o-accent-ink);
      background: var(--o-accent);
      border-radius: 3px;
    }
    .flashing li.up .point {
      animation: o-point-pop var(--o-slow) cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .flashing li.up {
      animation: o-point-glow var(--o-slow) ease-out;
    }
    .front-plan {
      padding: 8px 10px;
      border-top: 2px solid var(--o-ink);
      border-bottom: 1px solid var(--o-paper-rule);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .front-plan-title {
      font-family: var(--o-font-display);
      font-size: 13px;
      font-weight: 700;
      letter-spacing: var(--o-tracking-label);
      text-transform: uppercase;
      color: var(--o-headline-red);
    }
    .front-plan-lines {
      flex-direction: column;
    }
    .front-plan-lines li {
      font-family: var(--o-font-display);
      font-size: 18px;
      font-weight: 600;
      color: var(--o-ink-soft);
    }
    .front-plan-lines li.up {
      color: var(--o-ink-pos);
    }
    .front-plan-hint {
      margin: 0;
      font-size: 13px;
      font-style: italic;
      color: var(--o-ink-muted);
    }
    @keyframes o-point-pop {
      from {
        transform: scale(1.6);
      }
    }
    @keyframes o-point-glow {
      from {
        background: var(--o-accent-soft);
      }
    }
    @keyframes o-front-in {
      from {
        opacity: 0;
        transform: translateY(24px) rotate(-0.8deg);
      }
    }
    @keyframes o-fade {
      from {
        opacity: 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .sheet,
      .front,
      .flashing li.up,
      .flashing li.up .point {
        animation: none;
      }
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
  protected readonly step = this.game.nextStep;
  protected readonly kickoffHint = computed(() => kickoffHintKey(this.step()));
  protected readonly saveFailed = this.game.saveFailed;
  protected readonly busy = signal(false);
  protected readonly load = signal<Load>('balanced');
  protected readonly focus = signal<Skill | null>(null);
  protected readonly life = signal<LifeAction | null>(null);
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
      // Il blocco prima/dopo chiude il capitolo (anche l'ultimo, che finisce con la stagione).
      planBlock: r.stop === 'chapterEnd' || r.stop === 'seasonEnd',
      headlines: r.headlines,
      issues: planIssuesView(r.planIssues),
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

  /** "Dal piano" dall'ultimo stop: righe già tradotte; quelle con punti guadagnati ne portano il numero. */
  protected readonly planResult = computed(() => {
    const plan = this.game.lastStop()?.planLog;
    if (!plan) return null;
    const log = { plan };
    const flashes = pointFlashes(log);
    const up = new Map(flashes.map((k) => [`skills.${k}`, plan.pointsGained[k] ?? 0]));
    const lines = planStretchLine(log).map((l) => ({
      text: this.text(l),
      up: l.key === 'ui.planLog.skill' ? (up.get(String(l.params?.['skillKey'])) ?? 0) : 0,
    }));
    if (lines.length === 0) return null;
    return { lines, hint: chapterHint(log, this.ctx), flashes: flashes.length };
  });

  /** Il lampo del +1 è in corso (una volta per stop, dove il blocco si vede per primo). */
  protected readonly flashing = signal(false);
  private flashedFor: unknown = null;

  /** Carichi e azioni fuori dal campo di questa settimana. */
  protected readonly planOptions = computed(() => {
    const s = this.game.state();
    return s ? getPlanOptions(s, this.ctx) : null;
  });

  /** La scheda del piano scelto adesso, con l'anteprima esatta del motore. */
  protected readonly sheet = computed(() => {
    const s = this.game.state();
    if (!s || !this.planOpen()) return null;
    const plan = this.draftPlan();
    const preview = this.game.previewPlan(plan);
    return preview ? planSheetView(preview, plan, s, this.ctx) : null;
  });

  /** L'effetto principale della scelta, letto dal lettore di schermo a ogni cambio. */
  protected readonly announce = computed(() => {
    const v = this.sheet();
    return v ? v.summary.map((l) => this.text(l)).join(' ') : '';
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
    const plan = s.chapterPlan;
    if (!plan) return [];
    return [
      { key: `week.load.${plan.load}.name`, focus: plan.focus ?? null },
      ...(plan.life ? [{ key: `week.life.${plan.life}.name`, focus: null }] : []),
    ];
  });

  /** Conferenza stampa disponibile (presentazione o vigilia di una grande partita). */
  protected readonly press = computed(() => {
    const s = this.game.state();
    return s && !s.retired ? getPressConference(s, this.ctx) : null;
  });

  protected readonly ctaKey = computed(() => {
    switch (this.step()) {
      case 'events':
        return 'ui.week.cta.events';
      case 'seasonOver':
        return 'ui.week.cta.season';
      case 'retired':
        return 'ui.week.cta.retired';
      case 'matchInProgress':
        return 'ui.week.cta.resume';
      case 'match':
        return 'ui.week.play';
      default:
        return this.planOpen() ? 'ui.week.cta.planAndGo' : 'ui.week.cta.advance';
    }
  });

  /** La prima pagina resta aperta finché il giocatore non la chiude; uno stop nuovo la riapre. */
  protected readonly frontOpen = computed(() => {
    const r = this.game.lastStop();
    return !!r && this.game.frontSeen() !== r;
  });

  private readonly frontClose = viewChild<ElementRef<HTMLButtonElement>>('frontClose');
  private readonly injector = inject(Injector);
  private readonly sound = inject(SoundService);
  private flashTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.flashTimer));
    // Foglio aperto: lo sfondo è inerte e il focus va su Continua, così non si avanza senza leggerlo.
    effect(() => {
      if (!this.frontOpen()) return;
      afterNextRender(() => this.frontClose()?.nativeElement.focus(), { injector: this.injector });
    });
    // +1 di un'abilità: un lampo solo, nel primo posto in cui il blocco "Dal piano" si vede.
    effect(() => {
      const r = this.game.lastStop();
      const pr = this.planResult();
      if (!r || !pr || pr.flashes === 0 || this.flashedFor === r) return;
      const onFront = this.frontOpen() && !!this.frontPage()?.planBlock;
      const onHome = !this.frontOpen() && !this.planOpen() && !!this.view();
      if (!onFront && !onHome) return;
      this.flashedFor = r;
      this.flashing.set(true);
      // Il suono va col lampo ma non dipende dal movimento ridotto: ha il suo interruttore.
      this.sound.playOnce('point', r);
      clearTimeout(this.flashTimer);
      this.flashTimer = setTimeout(() => this.flashing.set(false), FLASH_MS);
    });
    // Il piano proposto è quello del capitolo (o l'ultimo ricordato), una volta per apertura.
    effect(() => {
      const s = this.game.state();
      if (!s || !this.planOpen()) return;
      const key = `${s.season}:${s.chapter.id}:${this.editing()}`;
      if (this.prefilledKey === key) return;
      this.prefilledKey = key;
      const remembered = s.chapterPlan ??
        s.lastPlan ?? { load: this.ctx.config.progression.skipWeekPlan.load };
      const life = remembered.life;
      const lifeOk = life && this.planOptions()?.life.find((l) => l.id === life)?.available;
      this.load.set(remembered.load);
      this.focus.set(remembered.focus ?? null);
      this.life.set(lifeOk ? life : null);
    });
    addIcons({ arrowForward, chatbubblesOutline, micOutline, settingsOutline, medkitOutline });
  }

  /** Il piano come lo sta componendo il giocatore. */
  private draftPlan(): WeekPlan {
    const focus = this.focus();
    const life = this.life();
    return { load: this.load(), ...(focus ? { focus } : {}), ...(life ? { life } : {}) };
  }

  /** Traduce una riga: i parametri che finiscono in `Key` sono a loro volta chiavi. */
  protected text(l: TextLine): string {
    return lineText((k, p) => this.i18n.t(k, p), l);
  }

  protected tone(value: number): 'pos' | 'neg' | 'mid' {
    return levelTone(value);
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
            // Mai confermare un'azione non disponibile: il motore la rifiuterebbe.
            if (this.sheet()?.canConfirm === false) return;
            await this.game.setPlan(this.draftPlan());
            this.editing.set(false);
          }
          const report = await this.game.advanceToStop();
          if (report.stop === 'retired') await this.router.navigateByUrl('/fine');
          else if (report.stop === 'news') await this.router.navigateByUrl('/evento');
        }
      }
    });
  }

  protected closeFront(): void {
    this.game.frontSeen.set(this.game.lastStop());
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
