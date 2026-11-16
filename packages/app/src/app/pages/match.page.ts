import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronBack, flashOutline, playOutline } from 'ionicons/icons';
import {
  playerFixture,
  type KeyMoment,
  type MatchEvent,
  type MatchReport,
} from '@outstanding/engine';
import { GameService } from '../core/game.service';
import { I18nService, TranslatePipe } from '../core/i18n.service';
import { chanceTone, formatRating, ordinal } from '../core/text';
import { ToastService } from '../core/toast.service';
import { fixtureView, type FixtureView } from '../core/views';
import { CrestComponent } from '../ui/crest.component';

type Phase = 'pre' | 'moment' | 'done';

/** Partita del giocatore: si gioca (momenti chiave) o si simula; alla fine la pagella. */
@Component({
  selector: 'app-match',
  imports: [IonContent, IonIcon, RouterLink, TranslatePipe, CrestComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-content class="o-page">
      @if (fx(); as f) {
        @switch (phase()) {
          @case ('pre') {
            <main class="o-wrap o-enter">
              <header class="top">
                <a
                  class="o-icon-btn"
                  routerLink="/settimana"
                  [attr.aria-label]="'ui.common.back' | t"
                >
                  <ion-icon name="chevron-back" aria-hidden="true"></ion-icon>
                </a>
                <span class="o-label">{{ competitionLine() }}</span>
                <span class="spacer"></span>
              </header>
              <section class="o-card o-card--hero pre">
                <div class="teams">
                  <div class="team">
                    <app-crest [crest]="f.home.crest" [size]="64" [label]="f.home.name" />
                    <span>{{ f.home.name }}</span>
                    <span class="o-muted small">{{
                      'ui.match.rating' | t: { r: f.home.rating }
                    }}</span>
                  </div>
                  <span class="vs o-number">VS</span>
                  <div class="team">
                    <app-crest [crest]="f.away.crest" [size]="64" [label]="f.away.name" />
                    <span>{{ f.away.name }}</span>
                    <span class="o-muted small">{{
                      'ui.match.rating' | t: { r: f.away.rating }
                    }}</span>
                  </div>
                </div>
                @if (f.fixture.cup?.neutral) {
                  <span class="o-label center">{{ 'ui.match.neutral' | t }}</span>
                }
              </section>
              <p class="o-muted explain">{{ 'ui.match.chooseHint' | t }}</p>
              <button class="o-btn" type="button" [disabled]="busy()" (click)="play()">
                <ion-icon name="play-outline" aria-hidden="true"></ion-icon
                >{{ 'ui.match.play' | t }}
              </button>
              <button
                class="o-btn o-btn--ghost"
                type="button"
                [disabled]="busy()"
                (click)="simulate()"
              >
                <ion-icon name="flash-outline" aria-hidden="true"></ion-icon
                >{{ 'ui.match.simulate' | t }}
              </button>
            </main>
          }

          @case ('moment') {
            @if (moment(); as m) {
              <header class="board" [attr.aria-label]="'ui.match.scoreboard' | t">
                <div class="score-row">
                  <div class="side">
                    <app-crest [crest]="f.home.crest" [size]="26" />
                    <span>{{ f.home.shortName }}</span>
                  </div>
                  <div class="score o-number">
                    <span>{{ m.score.home }}</span><span class="dash">–</span
                    ><span>{{ m.score.away }}</span>
                  </div>
                  <div class="side right">
                    <span>{{ f.away.shortName }}</span>
                    <app-crest [crest]="f.away.crest" [size]="26" />
                  </div>
                </div>
                <div class="clock">
                  <span class="minute o-number">{{ m.minute }}'</span>
                  <div class="o-bar grow">
                    <div class="o-bar__fill" [style.width.%]="(m.minute / 90) * 100"></div>
                  </div>
                  <span class="o-muted small">{{
                    (m.minute <= 45 ? 'ui.match.firstHalf' : 'ui.match.secondHalf') | t
                  }}</span>
                </div>
              </header>

              @if (feed().length > 0) {
                <section class="feed" [attr.aria-label]="'ui.match.feed' | t">
                  @for (line of feed(); track $index) {
                    <div class="feed-line" [class.mine]="line.mine">
                      <span class="feed-min">{{ line.minute }}'</span><span>{{ line.text }}</span>
                    </div>
                  }
                </section>
              }

              <section class="stage">
                <svg
                  class="pitch"
                  viewBox="0 0 390 200"
                  aria-hidden="true"
                  preserveAspectRatio="xMidYMin slice"
                >
                  <rect x="95" y="-2" width="200" height="88" />
                  <rect x="150" y="-2" width="90" height="34" />
                  <path d="M160 86a40 40 0 0 0 70 0" />
                  <circle cx="195" cy="62" r="3" class="spot" />
                </svg>
                @if (outcome(); as o) {
                  <span class="flash" [class.ok]="o === 'ok'" role="status">{{
                    (o === 'ok' ? 'ui.match.momentOk' : 'ui.match.momentKo') | t
                  }}</span>
                }
                <span class="o-kicker o-kicker--accent">{{ 'ui.match.keyMoment' | t }}</span>
                <p class="moment-text">{{ m.textKey | t: m.params }}</p>
              </section>

              <div class="options" role="group" [attr.aria-label]="'ui.match.whatDoYouDo' | t">
                @for (o of m.options; track o.id) {
                  <button
                    class="o-choice option"
                    type="button"
                    [disabled]="busy()"
                    (click)="decide($index)"
                  >
                    <span class="o-choice__body">{{ o.textKey | t }}</span>
                    <span class="chance">
                      <span class="o-number pct">{{ pct(o.chance) }}%</span>
                      <span class="o-bar mini">
                        <span
                          class="o-bar__fill"
                          [class.o-bar__fill--pos]="tone(o.chance) === 'pos'"
                          [class.o-bar__fill--neg]="tone(o.chance) === 'neg'"
                          [style.width.%]="pct(o.chance)"
                        ></span>
                      </span>
                    </span>
                  </button>
                }
              </div>
            }
          }

          @case ('done') {
            @if (report(); as r) {
              <main class="o-wrap o-enter">
                <div class="final">
                  <span class="o-label">{{ 'ui.match.final' | t }} · {{ competitionLine() }}</span>
                  <div class="final-row">
                    <span>{{ f.home.shortName }}</span>
                    <span class="o-number final-score">{{ r.score.home }}–{{ r.score.away }}</span>
                    <span>{{ f.away.shortName }}</span>
                  </div>
                  @if (r.penalties) {
                    <span class="o-muted small">{{
                      'cups.penalties' | t: { home: r.penalties.home, away: r.penalties.away }
                    }}</span>
                  } @else if (r.extraTime) {
                    <span class="o-muted small">{{
                      'ui.match.afterExtra'
                        | t
                          : {
                              home: r.score.home + r.extraTime.home,
                              away: r.score.away + r.extraTime.away,
                            }
                    }}</span>
                  }
                  <span
                    class="verdict"
                    [class.o-pos]="r.result === 'win'"
                    [class.o-neg]="r.result === 'loss'"
                    >{{ 'match.result.' + r.result | t }}</span
                  >
                </div>

                <section class="o-paper" [attr.aria-label]="'ui.match.yourRating' | t">
                  <div class="o-masthead">
                    <span class="o-masthead__name small-mast">{{ 'ui.match.ratings' | t }}</span>
                    <span class="o-masthead__edition">{{
                      'ui.match.byPaper' | t: { paper: ('ui.paper.name' | t) }
                    }}</span>
                  </div>
                  <div class="verdict-row">
                    <div class="badge o-number" [class.sv]="r.rating === null">
                      {{ rating(r.rating) }}
                    </div>
                    <div class="who">
                      <span class="surname">{{ surname() }}</span>
                      <span class="ink-muted"
                        >{{ 'roles.' + role() | t }} · {{ selectionLine(r) }}</span
                      >
                      <p class="comment">«{{ r.commentKey + '' | t }}»</p>
                    </div>
                  </div>
                </section>

                @if (r.injury; as inj) {
                  <div class="o-card injury" role="status">
                    {{
                      'ui.match.injured'
                        | t: { injury: ('injuries.' + inj.type | t), weeks: inj.weeksLeft }
                    }}
                  </div>
                }

                <section class="o-stats" [attr.aria-label]="'ui.match.stats' | t">
                  <div class="o-stat o-stat--boxed">
                    <span class="o-stat__value">{{ r.goals }}</span><span class="o-stat__label">{{
                      'ui.stats.goals' | t
                    }}</span>
                  </div>
                  <div class="o-stat o-stat--boxed">
                    <span class="o-stat__value">{{ r.assists }}</span><span class="o-stat__label">{{
                      'ui.stats.assists' | t
                    }}</span>
                  </div>
                  <div class="o-stat o-stat--boxed">
                    <span class="o-stat__value">{{ momentsLine(r) }}</span><span
                      class="o-stat__label"
                      >{{ 'ui.stats.moments' | t }}</span
                    >
                  </div>
                  <div class="o-stat o-stat--boxed">
                    <span class="o-stat__value">{{ r.minutesPlayed }}'</span
                    ><span class="o-stat__label">{{ 'ui.stats.minutes' | t }}</span>
                  </div>
                </section>

                <section class="o-card">
                  <h2 class="o-section-title">{{ 'ui.match.scorers' | t }}</h2>
                  <div class="o-lines">
                    @for (g of goals(r); track $index) {
                      <div class="o-line">
                        <span class="min">{{ g.minute }}'</span>
                        <span class="grow">{{ g.text }}</span>
                        <span [class.o-pos]="g.ours" [class.o-muted]="!g.ours">{{ g.team }}</span>
                      </div>
                    } @empty {
                      <p class="o-muted small none">{{ 'ui.match.noGoals' | t }}</p>
                    }
                  </div>
                </section>

                <div class="o-row">
                  <a class="o-btn o-btn--ghost" routerLink="/classifica">{{
                    'ui.nav.standings' | t
                  }}</a>
                  <button class="o-btn wide" type="button" (click)="done()">
                    {{ 'ui.match.continue' | t }}
                  </button>
                </div>
              </main>
            }
          }
        }
      } @else {
        <main class="o-wrap">
          <p class="o-muted">{{ 'ui.match.none' | t }}</p>
          <a class="o-btn" routerLink="/settimana">{{ 'ui.event.backToWeek' | t }}</a>
        </main>
      }
    </ion-content>
  `,
  styles: `
    .top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .top .o-label {
      text-align: center;
    }
    .spacer {
      width: var(--o-touch);
    }
    .small {
      font-size: var(--o-text-sm);
    }
    .center {
      text-align: center;
    }
    .pre {
      padding: 20px 16px;
    }
    .teams {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .team {
      width: 40%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      text-align: center;
      font-family: var(--o-font-display);
      font-weight: 700;
      font-size: 18px;
      text-transform: uppercase;
      line-height: 1.05;
    }
    .vs {
      font-size: 30px;
      color: var(--o-accent-fg);
    }
    .explain {
      margin: 0;
      font-size: 13px;
      text-align: center;
    }
    .board {
      background: var(--o-bg-deep);
      border-bottom: 1px solid var(--o-border);
      padding: 16px 16px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .score-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      max-width: 480px;
      margin: 0 auto;
      width: 100%;
    }
    .side {
      width: 34%;
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: var(--o-font-display);
      font-weight: 700;
      font-size: 16px;
      text-transform: uppercase;
      min-width: 0;
    }
    .side.right {
      justify-content: flex-end;
      text-align: right;
    }
    .score {
      font-size: 40px;
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .dash {
      color: var(--o-neutral-bar);
      font-size: 28px;
    }
    .clock {
      display: flex;
      align-items: center;
      gap: 10px;
      max-width: 480px;
      margin: 0 auto;
      width: 100%;
    }
    .minute {
      color: var(--o-accent-fg);
      font-size: 17px;
    }
    .grow {
      flex: 1 1 auto;
    }
    .feed {
      padding: 10px 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 13px;
      color: var(--o-text-muted);
      border-bottom: 1px solid var(--o-border);
      max-width: 480px;
      margin: 0 auto;
    }
    .feed-line {
      display: flex;
      gap: 10px;
    }
    .feed-line.mine {
      color: var(--o-positive);
      font-weight: 600;
    }
    .feed-min {
      width: 30px;
      font-weight: 600;
      color: var(--o-text);
    }
    .stage {
      position: relative;
      min-height: 240px;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      gap: 10px;
      padding: 18px 16px 14px;
      background: radial-gradient(120% 80% at 50% 0%, var(--o-surface-raised) 0%, var(--o-bg) 72%);
      max-width: 480px;
      margin: 0 auto;
    }
    .pitch {
      position: absolute;
      inset: 0 0 auto 0;
      width: 100%;
      height: 200px;
      opacity: 0.3;
      fill: none;
      stroke: var(--o-text-soft);
      stroke-width: 2;
    }
    .pitch .spot {
      fill: var(--o-text-soft);
    }
    .stage > :not(.pitch) {
      position: relative;
    }
    .moment-text {
      margin: 0;
      font-family: var(--o-font-display);
      font-weight: 700;
      font-size: 29px;
      line-height: 1.05;
    }
    .flash {
      position: absolute;
      top: 14px;
      right: 16px;
      font-family: var(--o-font-display);
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--o-negative);
      animation: o-rise var(--o-normal) var(--o-ease) both;
    }
    .flash.ok {
      color: var(--o-positive);
    }
    .options {
      padding: 4px 16px 22px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-width: 480px;
      margin: 0 auto;
    }
    .option {
      min-height: 58px;
    }
    .chance {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
    }
    .pct {
      font-size: 20px;
    }
    .mini {
      width: 64px;
      height: 4px;
      display: block;
    }
    .mini .o-bar__fill {
      display: block;
    }
    .final {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      text-align: center;
    }
    .final-row {
      display: flex;
      align-items: center;
      gap: 14px;
      font-family: var(--o-font-display);
      font-weight: 700;
      font-size: 20px;
      text-transform: uppercase;
    }
    .final-score {
      font-size: 42px;
    }
    .verdict {
      font-family: var(--o-font-display);
      font-weight: 700;
      font-size: 14px;
      letter-spacing: 1.4px;
      text-transform: uppercase;
    }
    .small-mast {
      font-size: 18px;
    }
    .verdict-row {
      display: flex;
      gap: 16px;
      align-items: center;
    }
    .badge {
      width: 108px;
      height: 108px;
      flex: 0 0 auto;
      border-radius: 10px;
      background: #1b4d2e;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 72px;
      letter-spacing: -2px;
      box-shadow: inset 0 0 0 4px #f2b830;
    }
    .badge.sv {
      font-size: 40px;
      background: #4a4740;
      box-shadow: none;
    }
    .who {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }
    .surname {
      font-family: var(--o-font-display);
      font-weight: 800;
      font-size: 26px;
      line-height: 1;
      text-transform: uppercase;
    }
    .ink-muted {
      font-size: var(--o-text-sm);
      color: var(--o-ink-muted);
    }
    .comment {
      margin: 0;
      font-size: 15px;
      line-height: 1.4;
      font-style: italic;
      color: var(--o-ink-soft);
    }
    .injury {
      border-color: var(--o-negative);
      font-size: 13px;
    }
    .min {
      width: 32px;
      font-weight: 600;
    }
    .none {
      margin: 0;
    }
    a.o-btn {
      text-decoration: none;
    }
    .wide {
      flex-grow: 2;
    }
  `,
})
export class MatchPage {
  private readonly game = inject(GameService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly busy = signal(false);
  protected readonly phase = signal<Phase>('pre');
  protected readonly moment = signal<KeyMoment | null>(null);
  protected readonly report = signal<MatchReport | null>(null);
  protected readonly outcome = signal<'ok' | 'ko' | null>(null);
  /** Partita mostrata: resta fissa anche quando, a fine partita, il calendario va avanti. */
  private readonly fixtureId = signal<string | null>(null);

  protected readonly fx = computed<FixtureView | null>(() => {
    const s = this.game.state();
    if (!s) return null;
    const id = this.fixtureId();
    const f = id ? s.calendar.find((x) => x.id === id) : undefined;
    return f ? fixtureView(s, f, this.game.ctx) : null;
  });

  protected readonly role = computed(() => this.game.state()?.player.role ?? 'ATT');
  protected readonly surname = computed(() => this.game.state()?.player.lastName ?? '');

  protected readonly competitionLine = computed(() => {
    const f = this.fx();
    if (!f) return '';
    const comp = this.i18n.t(f.competitionKey);
    return f.stageKey
      ? `${comp} · ${this.i18n.t(f.stageKey)}`
      : `${comp} · ${ordinal(f.fixture.matchday)} ${this.i18n.t('ui.week.matchday')}`;
  });

  /** Cronaca fino al momento chiave in corso: gol e cambi, dal più recente. */
  protected readonly feed = computed(() => {
    const m = this.game.state()?.currentMatch;
    const now = this.moment()?.minute ?? 0;
    if (!m) return [];
    return m.events
      .filter((e) => e.minute <= now && (e.kind === 'goal' || e.kind === 'subIn'))
      .sort((a, b) => b.minute - a.minute)
      .slice(0, 4)
      .map((e) => this.eventLine(e, m.side));
  });

  constructor() {
    addIcons({ chevronBack, playOutline, flashOutline });
    const s = this.game.state();
    const id = s?.currentMatch?.fixtureId ?? (s ? playerFixture(s)?.id : undefined);
    this.fixtureId.set(id ?? null);
    // Partita lasciata a metà: si riprende dal momento chiave in sospeso.
    if (s?.currentMatch) void this.play();
  }

  protected pct(chance: number): number {
    return Math.round(chance * 100);
  }

  protected tone(chance: number) {
    return chanceTone(chance);
  }

  protected rating(r: number | null): string {
    return formatRating(r);
  }

  protected async play(): Promise<void> {
    await this.run(async () => {
      const step = await this.game.startMatch();
      this.show(step);
    });
  }

  protected async simulate(): Promise<void> {
    await this.run(async () => {
      this.report.set(await this.game.simulate());
      this.phase.set('done');
    });
  }

  protected async decide(i: number): Promise<void> {
    await this.run(async () => {
      const before = this.game.state()?.currentMatch?.events.length ?? 0;
      const step = await this.game.decide(i);
      // L'esito del momento appena giocato, per un breve segnale visivo.
      const events = this.game.state()?.currentMatch?.events ?? this.report()?.events ?? [];
      const last = events.slice(before).find((e) => e.kind === 'moment');
      this.outcome.set(last && last.kind === 'moment' ? (last.success ? 'ok' : 'ko') : null);
      this.show(step);
    });
  }

  protected done(): void {
    void this.router.navigateByUrl('/settimana');
  }

  protected selectionLine(r: MatchReport): string {
    if (r.minutesPlayed > 0) return this.i18n.t('ui.match.minutes', { n: r.minutesPlayed });
    return this.i18n.t('match.selection.' + r.selection);
  }

  protected momentsLine(r: MatchReport): string {
    const moments = r.events.filter((e) => e.kind === 'moment');
    if (moments.length === 0) return '–';
    return `${moments.filter((e) => e.kind === 'moment' && e.success).length}/${moments.length}`;
  }

  protected goals(r: MatchReport) {
    const f = this.fx();
    return r.events
      .filter((e) => e.kind === 'goal')
      .map((e) => {
        if (e.kind !== 'goal') throw new Error('unreachable');
        const ours = e.side === r.side;
        const team = e.side === 'home' ? f?.home.shortName : f?.away.shortName;
        const text = e.assistName
          ? `${e.scorerName} (${this.i18n.t('ui.match.assistBy', { name: e.assistName })})`
          : e.scorerName;
        return { minute: e.minute, text, team: team ?? '', ours };
      });
  }

  private eventLine(e: MatchEvent, side: 'home' | 'away') {
    if (e.kind === 'goal') {
      const key = e.assistName ? 'match.events.goal_assist' : 'match.events.goal';
      const text = this.i18n
        .t(key, { minute: e.minute, scorer: e.scorerName, assist: e.assistName ?? '' })
        .replace(/^\d+' /, '');
      return { minute: e.minute, text, mine: e.side === side };
    }
    return {
      minute: e.minute,
      text: this.i18n.t('match.events.subIn', { minute: e.minute }).replace(/^\d+' /, ''),
      mine: true,
    };
  }

  private show(step: Awaited<ReturnType<GameService['startMatch']>>): void {
    if (step.kind === 'moment') {
      this.moment.set(step.moment);
      this.phase.set('moment');
    } else {
      this.report.set(step.report);
      this.phase.set('done');
    }
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
