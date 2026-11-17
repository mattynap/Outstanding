import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AlertController, IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  arrowForward,
  chatbubblesOutline,
  playForwardOutline,
  medkitOutline,
  micOutline,
  settingsOutline,
} from 'ionicons/icons';
import {
  getTransferWindow,
  getPressConference,
  getWeekOptions,
  playerFixture,
  SKILLS,
  type Skill,
  type WeekChoice,
} from '@outstanding/engine';
import { GameService } from '../core/game.service';
import { I18nService, TranslatePipe } from '../core/i18n.service';
import { MATCH_MODES, type MatchMode } from '../core/match-mode';
import { SettingsService } from '../core/settings.service';
import { formatMoney, ordinal, weekBalance } from '../core/text';
import { ToastService } from '../core/toast.service';
import { clubInfo, fixtureView, playerAge, seasonWeekNumber, upcomingFixture } from '../core/views';
import { CrestComponent } from '../ui/crest.component';
import { PxIconComponent } from '../ui/px-icon.component';
import { StatBarComponent } from '../ui/stat-bar.component';
import { TabBarComponent } from '../ui/tab-bar.component';
import { TipComponent } from '../ui/tip.component';

/** Home della settimana: stato del giocatore, prossima partita, azioni e pulsante principale. */
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

          @if (next(); as f) {
            <section class="o-card o-card--hero match" [attr.aria-label]="'ui.week.nextMatch' | t">
              <div class="match-top o-label">
                <span>{{ whenKey(f.inWeeks) | t: { n: f.inWeeks } }}</span>
                <span>{{ (f.side === 'home' ? 'ui.match.home' : 'ui.match.away') | t }}</span>
              </div>
              <div class="match-comp">
                {{ f.competitionKey | t }} ·
                @if (f.stageKey) {
                  {{ f.stageKey | t }}
                } @else {
                  {{ ordinal(f.fixture.matchday) }} {{ 'ui.week.matchday' | t }}
                }
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
              @if (step() === 'matchInProgress') {
                <div class="kickoff">
                  <button class="o-btn" type="button" [disabled]="busy()" (click)="playMatch()">
                    {{ 'ui.week.cta.resume' | t }}
                    <ion-icon name="arrow-forward" aria-hidden="true"></ion-icon>
                  </button>
                </div>
              } @else if (f.inWeeks === 0) {
                <div class="kickoff">
                  <div class="modes" role="radiogroup" [attr.aria-label]="'ui.week.matchMode' | t">
                    @for (m of matchModes; track m) {
                      <button
                        class="o-chip mode"
                        type="button"
                        role="radio"
                        [class.o-chip--accent]="mode() === m"
                        [attr.aria-checked]="mode() === m"
                        (click)="mode.set(m)"
                      >
                        {{ 'ui.settings.matchModes.' + m | t }}
                      </button>
                    }
                  </div>
                  @if (step() === 'match') {
                    <button class="o-btn" type="button" [disabled]="busy()" (click)="playMatch()">
                      {{ 'ui.week.play' | t }}
                      <ion-icon name="arrow-forward" aria-hidden="true"></ion-icon>
                    </button>
                  } @else {
                    <p class="o-muted small after-plan">{{ 'ui.week.matchAfterPlan' | t }}</p>
                  }
                </div>
              }
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

          @if (step() === 'plan') {
            <section class="plan" [attr.aria-label]="'ui.week.plan' | t">
              <div class="o-section-head">
                <h2 class="o-section-title">{{ 'ui.week.plan' | t }}</h2>
                <span class="o-muted small">{{
                  'ui.week.actionsCount' | t: { n: choices().length, max: maxActions }
                }}</span>
              </div>
              <app-tip tip="week.plan" />
              @if (game.state()?.lastPlan?.length) {
                <p class="o-muted small last-plan">{{ 'ui.week.lastPlanHint' | t }}</p>
              }
              <div class="actions">
                @for (o of options(); track o.id) {
                  <button
                    class="o-choice action"
                    type="button"
                    [attr.aria-pressed]="isChosen(o.id)"
                    [disabled]="!o.available || (!isChosen(o.id) && choices().length >= maxActions)"
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

          @if (v.window) {
            <a class="o-card window" routerLink="/mercato">
              <span class="o-label">{{ 'ui.market.window.' + v.window | t }}</span>
              <span>{{ 'ui.week.offers' | t: { n: v.offers } }}</span>
            </a>
          }

          @if (lastWeek(); as lw) {
            <section class="o-card last">
              <span class="o-label">{{ 'ui.week.lastWeek' | t }}</span>
              <span class="small">{{ 'ui.week.balance' | t: { amount: lw } }}</span>
            </section>
          }

          @if (step() !== 'plan') {
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
            <div class="cta-row">
              @if (canSkip()) {
                <button
                  class="o-btn o-btn--ghost o-btn--small"
                  type="button"
                  [disabled]="busy()"
                  (click)="skip()"
                >
                  {{ 'week.skip' | t }}
                </button>
              }
              @if (canFastForward()) {
                <button
                  class="o-btn o-btn--ghost o-btn--small"
                  type="button"
                  [disabled]="busy()"
                  (click)="fastForward()"
                >
                  <ion-icon name="play-forward-outline" aria-hidden="true"></ion-icon>
                  {{ 'ui.ff.button' | t }}
                </button>
              }
            </div>
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
    .cta-row {
      display: flex;
      gap: 10px;
    }
    .cta-row .o-btn {
      flex: 1 1 0;
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
    .modes {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .mode {
      min-height: 44px;
      justify-content: center;
      font-size: 14px;
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
  private readonly alerts = inject(AlertController);
  private readonly settings = inject(SettingsService);
  private readonly ctx = this.game.ctx;
  /** Settimana per cui il piano ricordato è già stato proposto. */
  private prefilledWeek = -1;

  protected readonly ordinal = ordinal;
  protected readonly skills = SKILLS;
  protected readonly maxActions = this.ctx.config.progression.actionsPerWeek;
  protected readonly step = this.game.nextStep;
  protected readonly saveFailed = this.game.saveFailed;
  protected readonly busy = signal(false);
  protected readonly choices = signal<string[]>([]);
  protected readonly focus = signal<Skill | null>(null);
  protected readonly matchModes = MATCH_MODES;
  /** Modalità della prossima partita: parte dal predefinito delle impostazioni, si cambia qui. */
  protected readonly mode = linkedSignal<MatchMode>(() => this.settings.matchMode());
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

  protected readonly next = computed(() => {
    const s = this.game.state();
    const f = s && upcomingFixture(s);
    return s && f ? fixtureView(s, f, this.ctx) : null;
  });

  protected readonly options = computed(() => {
    const s = this.game.state();
    return s ? getWeekOptions(s, this.ctx) : [];
  });

  /** Conferenza stampa disponibile (presentazione o vigilia di una grande partita). */
  protected readonly press = computed(() => {
    const s = this.game.state();
    return s && !s.retired ? getPressConference(s, this.ctx) : null;
  });

  protected readonly needsFocus = computed(() =>
    this.options().some((o) => o.needsFocus && this.choices().includes(o.id)),
  );

  protected readonly lastWeek = computed(() => {
    const r = this.game.lastWeek();
    if (!r) return null;
    return formatMoney(weekBalance(r));
  });

  protected readonly ctaKey = computed(() => {
    switch (this.step()) {
      case 'plan':
        return 'ui.week.cta.plan';
      case 'events':
        return 'ui.week.cta.events';
      case 'match':
        return 'ui.week.cta.match';
      case 'matchInProgress':
        return 'ui.week.cta.resume';
      case 'seasonOver':
        return 'ui.week.cta.season';
      case 'retired':
        return 'ui.week.cta.retired';
      default:
        return 'ui.week.cta.advance';
    }
  });

  /** Partita da giocare o da riprendere: il pulsante sta nella scheda partita, non in fondo. */
  protected readonly matchFirst = computed(
    () => this.step() === 'match' || this.step() === 'matchInProgress',
  );

  protected readonly canAct = computed(
    () => this.step() !== 'plan' || !this.needsFocus() || this.focus() !== null,
  );

  /** L'avanti veloce si usa dal piano o a settimana conclusa, mai a partita iniziata. */
  protected readonly canFastForward = computed(() => {
    const s = this.game.state();
    return !!s && !s.currentMatch && (this.step() === 'plan' || this.step() === 'advance');
  });

  protected readonly canSkip = computed(() => {
    const s = this.game.state();
    return this.step() === 'plan' && !!s && !playerFixture(s);
  });

  constructor() {
    // Piano ricordato: a ogni settimana nuova si ripropone quello della settimana prima.
    effect(() => {
      const s = this.game.state();
      if (!s || this.step() !== 'plan' || this.prefilledWeek === s.week) return;
      this.prefilledWeek = s.week;
      const available = new Set(
        this.options()
          .filter((o) => o.available)
          .map((o) => o.id),
      );
      const last = (s.lastPlan ?? []).filter((c) => available.has(c.actionId));
      this.choices.set(last.map((c) => c.actionId).slice(0, this.maxActions));
      this.focus.set(last.find((c) => c.focus)?.focus ?? null);
    });
    addIcons({
      arrowForward,
      chatbubblesOutline,
      playForwardOutline,
      micOutline,
      settingsOutline,
      medkitOutline,
    });
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
        case 'plan': {
          const focusIds = new Set(
            this.options()
              .filter((o) => o.needsFocus)
              .map((o) => o.id),
          );
          const plan: WeekChoice[] = this.choices().map((actionId) =>
            focusIds.has(actionId) ? { actionId, focus: this.focus()! } : { actionId },
          );
          const { news, party } = await this.game.plan(plan);
          this.choices.set([]);
          this.focus.set(null);
          if (party?.fine) {
            await this.toast.show(
              this.i18n.t('private.party.fine', { amount: formatMoney(party.fine) }),
              'error',
            );
          } else if (party?.gossip) {
            await this.toast.show(this.i18n.t('private.party.gossip'));
          }
          if (news > 0) await this.router.navigateByUrl('/evento');
          break;
        }
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
          const report = await this.game.advance();
          if (this.game.state()?.retired) {
            await this.router.navigateByUrl('/fine');
            return;
          }
          await this.toast.show(
            this.i18n.t('ui.week.closed', { amount: formatMoney(weekBalance(report)) }),
          );
        }
      }
    });
  }

  protected async playMatch(): Promise<void> {
    // Una partita già iniziata si riprende sempre dal momento in sospeso.
    const sim = this.step() === 'match' && this.mode() === 'sim';
    await this.router.navigate(['/partita'], sim ? { queryParams: { mode: 'sim' } } : {});
  }

  protected async fastForward(): Promise<void> {
    const alert = await this.alerts.create({
      header: this.i18n.t('ui.ff.title'),
      message: this.i18n.t('ui.ff.text'),
      buttons: [
        { text: this.i18n.t('ui.ff.bigMatch'), role: 'bigMatch' },
        { text: this.i18n.t('ui.ff.seasonEnd'), role: 'seasonEnd' },
        { text: this.i18n.t('ui.common.cancel'), role: 'cancel' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'bigMatch' && role !== 'seasonEnd') return;
    await this.run(async () => {
      const r = await this.game.fastForward(role);
      if (this.game.state()?.retired) {
        await this.router.navigateByUrl('/fine');
        return;
      }
      this.choices.set([]);
      this.prefilledWeek = -1;
      await this.toast.show(
        this.i18n.t('ui.ff.done', {
          n: r.weeks,
          win: r.record.win,
          draw: r.record.draw,
          loss: r.record.loss,
        }) +
          ' ' +
          this.i18n.t('ui.ff.stop.' + r.stop),
      );
    });
  }

  protected async skip(): Promise<void> {
    await this.run(async () => {
      const weeks = await this.game.skipToMatch();
      if (this.game.state()?.retired) {
        await this.router.navigateByUrl('/fine');
        return;
      }
      await this.toast.show(this.i18n.t('ui.week.skipped', { n: weeks }));
    });
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
