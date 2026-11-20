import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { AlertController, IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronBack, heartDislikeOutline, eyeOffOutline } from 'ionicons/icons';
import {
  financeOf,
  getPrivateActions,
  privateOf,
  scaledCost,
  type PrivateActionReport,
} from '@outstanding/engine';
import { GameService } from '../core/game.service';
import { I18nService, TranslatePipe } from '../core/i18n.service';
import { formatMoney } from '../core/text';
import { ToastService } from '../core/toast.service';
import { PortraitComponent } from '../ui/portrait.component';
import { PxIconComponent } from '../ui/px-icon.component';
import { VignetteComponent } from '../ui/vignette.component';

/** Motivi per cui un'azione non c'entra con la situazione attuale: l'azione non si mostra. */
const HIDDEN_REASONS = new Set([
  'private.blocked.hasPartner',
  'private.blocked.hasProspect',
  'private.blocked.noProspect',
  'private.blocked.single',
  'private.blocked.notDating',
  'private.blocked.notEngaged',
  'private.blocked.noChildren',
]);

/**
 * Vita privata come una pagina di cronaca rosa: chi c'è nel cuore del giocatore (ritratto,
 * intesa, da quanto state insieme), la famiglia, le storie passate e le cose da fare questa
 * settimana, una sola, ognuna con la sua vignetta.
 */
@Component({
  selector: 'app-private',
  imports: [IonContent, IonIcon, TranslatePipe, PortraitComponent, PxIconComponent, VignetteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-content class="o-page">
      @if (view(); as v) {
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
            <h1 class="o-display title">{{ 'ui.private.title' | t }}</h1>
          </header>

          @if (v.partner; as p) {
            <section class="o-paper couple">
              <span class="o-kicker">{{ 'ui.private.stage.' + p.stage | t }}</span>
              <div class="who">
                <app-portrait class="frame" [person]="p.person" />
                <div class="who-text">
                  <h2 class="o-headline name">{{ p.name }}</h2>
                  <span class="job">{{ p.job | t }}</span>
                  <span class="since">{{ 'ui.private.together' | t: { n: p.weeks } }}</span>
                </div>
              </div>
              <div class="affinity">
                <div class="aff-head">
                  <span class="o-label ink">{{ 'ui.private.affinity' | t }}</span>
                  <span class="mood" [class.cold]="p.mood === 'crisis'">
                    <app-px-icon name="heart" />
                    {{ 'ui.private.mood.' + p.mood | t }}
                  </span>
                </div>
                <div
                  class="hearts"
                  role="meter"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  [attr.aria-valuenow]="p.affinity"
                  [attr.aria-label]="'ui.private.affinity' | t"
                >
                  <div class="hearts-fill" [style.width.%]="p.affinity"></div>
                  <div class="crisis-mark" [style.left.%]="crisisAt"></div>
                </div>
                @if (p.mood === 'crisis') {
                  <p class="note">{{ 'ui.private.crisisNote' | t }}</p>
                }
              </div>
              <button
                class="paper-btn"
                type="button"
                [disabled]="busy()"
                (click)="endRelationship(p.stage === 'married', p.firstName)"
              >
                <ion-icon name="heart-dislike-outline" aria-hidden="true"></ion-icon>
                {{ (p.stage === 'married' ? 'ui.private.divorce' : 'ui.private.breakUp') | t }}
              </button>
            </section>
          } @else if (v.prospect; as q) {
            <section class="o-paper couple">
              <span class="o-kicker">{{ 'ui.private.newMeeting' | t }}</span>
              <div class="who">
                <app-portrait class="frame" [person]="q.person" />
                <div class="who-text">
                  <h2 class="o-headline name">{{ q.name }}</h2>
                  <span class="job">{{ q.job | t }}</span>
                  <span class="since">{{ 'ui.private.prospectLeft' | t: { n: q.weeks } }}</span>
                </div>
              </div>
            </section>
          } @else {
            <section class="o-paper couple single">
              <span class="o-kicker">{{ 'ui.private.stage.single' | t }}</span>
              <h2 class="o-headline name">{{ 'ui.private.singleTitle' | t }}</h2>
              <p class="note">{{ 'ui.private.singleText' | t }}</p>
            </section>
          }

          @if (v.affair) {
            <section class="o-card secret">
              <div class="secret-head">
                <ion-icon name="eye-off-outline" aria-hidden="true"></ion-icon>
                <h2 class="o-section-title">{{ 'ui.private.affairTitle' | t }}</h2>
              </div>
              <p class="small o-muted none">{{ 'ui.private.affairText' | t }}</p>
              <button
                class="o-btn o-btn--small"
                type="button"
                [disabled]="busy()"
                (click)="run(() => game.endAffair(), 'ui.private.affairEnded')"
              >
                {{ 'ui.private.endAffair' | t }}
              </button>
            </section>
          }

          @if (v.children.length > 0 || v.expecting !== null) {
            <section class="o-card">
              <h2 class="o-section-title">{{ 'ui.private.family' | t }}</h2>
              @if (v.expecting !== null) {
                <div class="o-line expecting">
                  <span class="grow">{{ 'ui.private.expecting' | t: { n: v.expecting } }}</span>
                </div>
              }
              <div class="o-lines">
                @for (c of v.children; track c.id) {
                  <div class="o-line">
                    <span class="kid" [class.f]="c.gender === 'f'" aria-hidden="true">{{
                      c.initial
                    }}</span>
                    <span class="grow">
                      <b>{{ c.name }}</b>
                      <span class="small o-muted">
                        ·
                        {{
                          c.age === 0
                            ? ('ui.private.baby' | t)
                            : ('ui.private.age' | t: { n: c.age })
                        }}
                        ·
                        {{ (c.withPlayer ? 'ui.private.withYou' : 'ui.private.withEx') | t }}</span
                      >
                    </span>
                    <span class="small o-neg num">{{ c.cost }}</span>
                  </div>
                }
              </div>
              @if (v.children.length > 0) {
                <p class="small o-muted none">{{ 'ui.private.costNote' | t }}</p>
              }
            </section>
          }

          <section class="block">
            <div class="o-section-head">
              <h2 class="o-section-title">{{ 'ui.private.thisWeek' | t }}</h2>
              <span class="o-chip" [class.o-chip--accent]="!v.done">{{
                (v.done ? 'ui.private.doneChip' : 'ui.private.oneChip') | t
              }}</span>
            </div>
            @for (a of v.actions; track a.id) {
              <article class="o-card action" [class.off]="!a.available">
                <app-vignette [id]="a.id" [label]="a.nameKey | t" />
                <div class="action-body">
                  <span class="action-name">{{ a.nameKey | t: { name: v.prospectName } }}</span>
                  <span class="small o-muted">{{ a.descKey | t }}</span>
                  <div class="action-foot">
                    @if (a.cost > 0) {
                      <span class="o-number price">{{ money(a.cost) }}</span>
                    }
                    @if (a.available) {
                      <button
                        class="o-btn o-btn--small"
                        type="button"
                        [disabled]="busy()"
                        (click)="act(a.id)"
                      >
                        {{ 'ui.private.do' | t }}
                      </button>
                    } @else if (a.reasonKey) {
                      <span class="small reason">{{ a.reasonKey | t: a.reasonParams }}</span>
                    }
                  </div>
                </div>
              </article>
            }
          </section>

          @if (v.exes.length > 0) {
            <section class="o-card">
              <h2 class="o-section-title">{{ 'ui.private.exes' | t }}</h2>
              <div class="o-lines">
                @for (e of v.exes; track $index) {
                  <div class="o-line">
                    <span class="grow">{{ e.name }}</span>
                    <span class="small o-muted">{{ 'ui.private.exStage.' + e.stage | t }}</span>
                  </div>
                }
              </div>
            </section>
          }
        </main>
      }
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
    .couple {
      gap: 12px;
    }
    .who {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .frame {
      --size: 92px;
      border-radius: 50%;
      box-shadow:
        0 0 0 3px var(--o-paper),
        0 0 0 4px var(--o-paper-rule);
    }
    .who-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .name {
      margin: 0;
      font-size: 30px;
      line-height: 1;
    }
    .job {
      font-style: italic;
      color: var(--o-ink-soft);
    }
    .since {
      font-size: var(--o-text-sm);
      color: var(--o-ink-muted);
    }
    .affinity {
      display: flex;
      flex-direction: column;
      gap: 6px;
      border-top: 1px solid var(--o-paper-rule);
      padding-top: 10px;
    }
    .aff-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .ink {
      color: var(--o-ink-muted);
    }
    .mood {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-weight: 700;
      font-size: 14px;
      color: #b0303f;
    }
    .mood.cold {
      color: var(--o-ink-muted);
    }
    /* Dieci tacche come le barre del profilo; il gradiente dell'intesa resta. */
    .hearts {
      position: relative;
      height: 10px;
      background: rgba(0, 0, 0, 0.08);
      overflow: hidden;
      -webkit-mask: repeating-linear-gradient(90deg, #000 0 calc(10% - 2px), transparent 0 10%);
      mask: repeating-linear-gradient(90deg, #000 0 calc(10% - 2px), transparent 0 10%);
    }
    .hearts-fill {
      height: 100%;
      background: linear-gradient(90deg, #d9775f, #c2304a);
      transition: width var(--o-slow) steps(5, end);
    }
    @media (prefers-reduced-motion: reduce) {
      .hearts-fill {
        transition: none;
      }
    }
    .crisis-mark {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--o-paper);
    }
    .note {
      margin: 0;
      font-size: 13px;
      color: var(--o-ink-soft);
    }
    .paper-btn {
      align-self: flex-start;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: var(--o-touch);
      padding: 8px 16px;
      border: none;
      border-radius: 0;
      /* Cornice pixel d'inchiostro, ombra corta: come i pulsanti sulla carta. */
      box-shadow:
        0 calc(-1 * var(--o-px)) 0 0 var(--o-px-paper-edge),
        0 var(--o-px) 0 0 var(--o-px-paper-edge),
        calc(-1 * var(--o-px)) 0 0 0 var(--o-px-paper-edge),
        var(--o-px) 0 0 0 var(--o-px-paper-edge),
        calc(2 * var(--o-px)) calc(2 * var(--o-px)) 0 0 var(--o-px-shadow);
      background: transparent;
      color: var(--o-ink);
      font: inherit;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
    }
    .paper-btn:disabled {
      opacity: 0.5;
    }
    .single .name {
      font-size: 26px;
    }
    .secret {
      --px-b: var(--o-warn, #c98a1f);
    }
    .secret-head {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .secret-head ion-icon {
      font-size: 20px;
    }
    .block {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .action {
      flex-direction: row;
      align-items: stretch;
      gap: 12px;
      padding: 10px;
    }
    .action app-vignette {
      flex: 0 0 104px;
      align-self: flex-start;
    }
    .action.off app-vignette {
      filter: grayscale(0.7);
      opacity: 0.7;
    }
    .action-body {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    .action-name {
      font-weight: 700;
    }
    .action-foot {
      margin-top: auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }
    .action-foot .o-btn {
      width: auto;
      flex: none;
      padding-inline: 24px;
    }
    .price {
      font-size: 18px;
    }
    .reason {
      color: var(--o-text-soft);
      font-style: italic;
    }
    .kid {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: inline-grid;
      place-items: center;
      font-weight: 700;
      font-size: 13px;
      background: rgba(61, 110, 140, 0.25);
      flex: none;
      margin-right: 8px;
    }
    .kid.f {
      background: rgba(200, 85, 61, 0.25);
    }
    .expecting {
      font-style: italic;
    }
    .small {
      font-size: var(--o-text-sm);
    }
    .grow {
      flex: 1 1 auto;
      min-width: 0;
    }
    .num {
      font-variant-numeric: tabular-nums;
    }
    .none {
      margin: 0;
    }
  `,
})
export class PrivatePage {
  protected readonly game = inject(GameService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly alerts = inject(AlertController);
  private readonly location = inject(Location);

  private readonly cfg = this.game.ctx.config.private;
  protected readonly busy = signal(false);
  protected readonly crisisAt = this.cfg.affinity.crisisBelow;
  protected readonly money = formatMoney;

  protected readonly view = computed(() => {
    const s = this.game.state();
    if (!s) return null;
    const ctx = this.game.ctx;
    const life = privateOf(s, ctx);
    const weeksPerSeason = ctx.config.calendar.weeksPerSeason;
    const p = life.partner;
    const childCost = scaledCost(this.cfg.children.cost, s.player);
    const alimony = scaledCost(this.cfg.divorce.alimonyPerChild, s.player);
    const actions = getPrivateActions(s, ctx).filter(
      (a) => !a.reasonKey || !HIDDEN_REASONS.has(a.reasonKey),
    );
    return {
      done: life.actionWeek === s.week,
      partner: p
        ? {
            person: p,
            firstName: p.firstName,
            name: `${p.firstName} ${p.lastName}`,
            job: `private.jobs.${p.job}.${p.gender}`,
            stage: p.stage,
            weeks: Math.max(0, s.week - p.sinceWeek),
            affinity: Math.round(p.affinity),
            mood:
              p.affinity >= 75
                ? 'high'
                : p.affinity >= 50
                  ? 'good'
                  : p.affinity >= this.cfg.affinity.crisisBelow
                    ? 'cool'
                    : 'crisis',
          }
        : null,
      prospect: life.prospect
        ? {
            person: life.prospect,
            name: `${life.prospect.firstName} ${life.prospect.lastName}`,
            job: `private.jobs.${life.prospect.job}.${life.prospect.gender}`,
            weeks: Math.max(1, life.prospect.expiresWeek - s.week),
          }
        : null,
      prospectName: life.prospect?.firstName ?? '',
      affair: Boolean(life.affair),
      expecting: life.expecting ? Math.max(1, life.expecting.dueWeek - s.week) : null,
      children: life.children.map((c) => ({
        id: c.id,
        name: c.firstName,
        initial: c.firstName.charAt(0),
        gender: c.gender,
        age: Math.max(0, Math.floor((s.week - c.birthWeek) / weeksPerSeason)),
        withPlayer: c.withPlayer,
        cost: formatMoney(-(c.withPlayer ? childCost : alimony)),
      })),
      exes: [...life.exes].reverse().map((e) => ({
        name: `${e.firstName} ${e.lastName}`,
        stage: e.stage,
      })),
      actions,
    };
  });

  constructor() {
    addIcons({ chevronBack, heartDislikeOutline, eyeOffOutline });
  }

  protected back(): void {
    this.location.back();
  }

  protected async act(id: string): Promise<void> {
    await this.run(async () => {
      const r = await this.game.privateAction(id);
      return { key: this.outcomeKey(r), params: { name: r.name ?? '' } };
    });
  }

  private outcomeKey(r: PrivateActionReport): string {
    if (r.actionId === 'ask_out' || r.actionId === 'propose') {
      return `private.outcome.${r.actionId}.${r.outcome}`;
    }
    if (r.actionId === 'wedding') return 'private.outcome.wedding.done';
    return `private.outcome.${r.outcome}`;
  }

  protected async endRelationship(married: boolean, name: string): Promise<void> {
    const s = this.game.state();
    if (!s) return;
    const liquid = Math.max(0, s.player.money.cash) + financeOf(s, this.game.ctx).deposit;
    const settlement = Math.round(this.cfg.divorce.liquidShare * liquid);
    const alert = await this.alerts.create({
      header: this.i18n.t(married ? 'ui.private.divorceTitle' : 'ui.private.breakUpTitle', {
        name,
      }),
      message: this.i18n.t(married ? 'ui.private.divorceText' : 'ui.private.breakUpText', {
        amount: formatMoney(settlement),
      }),
      buttons: [
        { text: this.i18n.t('ui.common.cancel'), role: 'cancel' },
        {
          text: this.i18n.t(married ? 'ui.private.divorce' : 'ui.private.breakUp'),
          role: 'confirm',
        },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'confirm') return;
    await this.run(async (): Promise<{ key: string; params: Record<string, string> }> => {
      const r = await this.game.breakUp();
      return r.settlement > 0
        ? { key: 'ui.private.divorced', params: { amount: formatMoney(r.settlement) } }
        : { key: 'ui.private.brokeUp', params: { name: r.name } };
    });
  }

  /** Esegue un'azione e mostra l'esito; `fn` può restituire la chiave del messaggio. */
  protected async run(
    fn: () => Promise<{ key: string; params?: Record<string, string> } | void>,
    doneKey?: string,
  ): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const out = await fn();
      const key = out ? out.key : doneKey;
      if (key) await this.toast.show(this.i18n.t(key, out ? out.params : undefined));
    } catch {
      await this.toast.show(this.i18n.t('ui.common.error'), 'error');
    } finally {
      this.busy.set(false);
    }
  }
}
