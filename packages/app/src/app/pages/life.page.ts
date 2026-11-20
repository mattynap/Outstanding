import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AlertController, IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronBack } from 'ionicons/icons';
import { applyWeeklyFinances, netWorth, privateOf } from '@outstanding/engine';
import { GameService } from '../core/game.service';
import { I18nService, TranslatePipe } from '../core/i18n.service';
import { formatMoney } from '../core/text';
import { ToastService } from '../core/toast.service';
import { playerAge } from '../core/views';
import { PxIconComponent } from '../ui/px-icon.component';
import { StatBarComponent } from '../ui/stat-bar.component';

/** Finanze e vita: conto, entrate e uscite, tenore di vita, ritiro volontario. */
@Component({
  selector: 'app-life',
  imports: [IonContent, IonIcon, RouterLink, TranslatePipe, PxIconComponent, StatBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-content class="o-page">
      @if (view(); as v) {
        <main class="o-wrap o-enter">
          <header class="top">
            <a class="o-icon-btn" routerLink="/profilo" [attr.aria-label]="'ui.common.back' | t">
              <ion-icon name="chevron-back" aria-hidden="true"></ion-icon>
            </a>
            <h1 class="o-display title">{{ 'ui.life.title' | t }}</h1>
          </header>

          <section class="o-card o-card--hero bank">
            <span class="o-label soft">{{ 'ui.life.cash' | t }}</span>
            <span class="cash-row">
              <app-px-icon class="coin" name="cash" [size]="32" />
              <span class="o-num cash" [class.o-neg]="v.cashValue < 0">{{ v.cash }}</span>
            </span>
            @if (v.cashValue < 0) {
              <span class="small o-neg">{{ 'ui.life.debt' | t }}</span>
            }
          </section>

          <a class="o-card wealth-link" routerLink="/patrimonio">
            <span class="grow">
              <span class="o-section-title">{{ 'ui.wealth.title' | t }}</span>
              <span class="small soft">{{ 'ui.wealth.linkText' | t }}</span>
            </span>
            <span class="o-num worth">{{ v.worth }}</span>
          </a>

          <a class="o-card wealth-link heart-link" routerLink="/vita-privata">
            <span class="grow">
              <span class="o-section-title">{{ 'ui.private.title' | t }}</span>
              <span class="small soft">{{ v.privateLine.key | t: v.privateLine.params }}</span>
            </span>
            <app-px-icon name="heart" class="heart" [size]="24" />
          </a>

          <!-- Estratto conto della settimana: uno scontrino sulla carta. -->
          <section class="o-paper statement">
            <h2 class="o-paper-head">{{ 'ui.life.weekly' | t }}</h2>
            <dl class="receipt">
              <div class="row">
                <dt>{{ 'ui.life.salary' | t }}</dt>
                <dd class="pos">{{ v.salary }}</dd>
              </div>
              <div class="row">
                <dt>{{ 'ui.life.sponsors' | t }}</dt>
                <dd class="pos">{{ v.sponsors }}</dd>
              </div>
              <div class="row">
                <dt>{{ 'ui.life.commission' | t }}</dt>
                <dd class="neg">{{ v.commission }}</dd>
              </div>
              <div class="row">
                <dt>{{ 'ui.life.expenses' | t }}</dt>
                <dd class="neg">{{ v.expenses }}</dd>
              </div>
              <div class="row total">
                <dt>{{ 'ui.life.net' | t }}</dt>
                <dd class="o-num" [class.pos]="v.netValue >= 0" [class.neg]="v.netValue < 0">
                  {{ v.net }}
                </dd>
              </div>
            </dl>
          </section>

          <section class="block">
            <h2 class="o-section-title">{{ 'ui.life.lifestyle' | t }}</h2>
            @for (l of v.lifestyles; track l.id) {
              <button
                class="o-choice"
                type="button"
                [attr.aria-pressed]="l.id === v.lifestyle"
                [disabled]="busy()"
                (click)="setLifestyle(l.id)"
              >
                <span class="o-choice__body">
                  <span>{{ 'lifestyles.' + l.id + '.name' | t }}</span>
                  <span class="o-choice__hint">{{ 'lifestyles.' + l.id + '.desc' | t }}</span>
                </span>
                <span class="o-number price">{{ l.cost }}</span>
              </button>
            }
          </section>

          <section class="o-card">
            <h2 class="o-section-title">{{ 'ui.life.mood' | t }}</h2>
            <app-stat-bar [label]="'ui.stats.happiness' | t" [value]="v.happiness" tone="auto" />
            <app-stat-bar [label]="'ui.stats.morale' | t" [value]="v.morale" tone="auto" />
          </section>

          <section class="o-card">
            <h2 class="o-section-title">{{ 'ui.life.retireTitle' | t }}</h2>
            @if (v.canRetire) {
              <p class="small o-muted none">{{ 'ui.life.retireHint' | t }}</p>
              <button
                class="o-btn o-btn--danger o-btn--small"
                type="button"
                [disabled]="busy()"
                (click)="retire()"
              >
                {{ 'ui.life.retire' | t }}
              </button>
            } @else {
              <p class="small o-muted none">{{ 'ui.life.retireFrom' | t: { age: minAge } }}</p>
            }
          </section>
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
    .wealth-link {
      flex-direction: row;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      color: var(--o-text);
      --px-b: var(--o-accent);
    }
    .wealth-link .grow {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .wealth-link .worth {
      flex: none;
      white-space: nowrap;
      font-size: 22px;
      color: var(--o-accent-fg);
    }
    .heart-link {
      --px-b: #c2304a;
    }
    .heart {
      color: #c2304a;
      flex: none;
    }
    .cash-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .coin {
      color: var(--o-accent-fg);
    }
    .receipt {
      display: flex;
      flex-direction: column;
      margin: 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
      padding: 8px 0;
      border-bottom: 1px dashed var(--o-paper-rule);
    }
    .row dt {
      color: var(--o-ink-soft);
    }
    .row dd {
      margin: 0;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .row.total {
      border-top: 3px double var(--o-ink);
      border-bottom: none;
      margin-top: 4px;
    }
    .row.total dt {
      font-family: var(--o-font-display);
      font-weight: 700;
      font-size: 16px;
      text-transform: uppercase;
      color: var(--o-ink);
    }
    .row.total dd {
      font-size: 26px;
      font-weight: 400;
    }
    .pos {
      color: var(--o-ink-pos);
    }
    .neg {
      color: var(--o-ink-neg);
    }
    .bank {
      align-items: flex-start;
      gap: 4px;
    }
    .soft {
      color: var(--o-text-soft);
    }
    .cash {
      font-size: 52px;
    }
    .small {
      font-size: var(--o-text-sm);
    }
    .grow {
      flex: 1 1 auto;
    }
    .block {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .price {
      flex: none;
      white-space: nowrap;
      font-size: 18px;
    }
    .none {
      margin: 0;
    }
  `,
})
export class LifePage {
  private readonly game = inject(GameService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly alerts = inject(AlertController);
  private readonly router = inject(Router);

  protected readonly busy = signal(false);
  protected readonly minAge = this.game.ctx.config.economy.retirement.minAge;

  protected readonly view = computed(() => {
    const s = this.game.state();
    if (!s) return null;
    const ctx = this.game.ctx;
    const p = s.player;
    const eco = ctx.config.economy;
    // Anteprima della prossima settimana con la stessa funzione usata dal motore.
    const { salary, sponsors, commission, expenses } = applyWeeklyFinances(
      p,
      s.world.npcs,
      ctx,
    ).finance;
    const net = salary + sponsors - commission - expenses;
    return {
      cashValue: p.money.cash,
      cash: formatMoney(p.money.cash),
      worth: formatMoney(netWorth(s, this.game.ctx).total),
      salary: formatMoney(salary),
      sponsors: formatMoney(sponsors),
      commission: formatMoney(-commission),
      expenses: formatMoney(-expenses),
      netValue: net,
      net: formatMoney(net),
      lifestyle: p.lifestyle,
      lifestyles: eco.lifestyles.map((l) => ({ id: l.id, cost: formatMoney(l.weeklyCost) })),
      happiness: p.persona.happiness,
      morale: p.condition.morale,
      canRetire: playerAge(s, ctx) >= this.minAge && !s.currentMatch,
      privateLine: this.privateLine(s),
    };
  });

  /** Una riga sulla vita privata per il collegamento: chi c'è, o che si è single. */
  private privateLine(s: Parameters<typeof privateOf>[0]): {
    key: string;
    params: Record<string, string | number>;
  } {
    const life = privateOf(s, this.game.ctx);
    const kids = life.children.length;
    if (life.partner) {
      return {
        key: kids > 0 ? 'ui.private.linkFamily' : 'ui.private.linkPartner',
        params: {
          name: life.partner.firstName,
          stage: this.i18n.t('ui.private.stage.' + life.partner.stage),
          n: kids,
        },
      };
    }
    return {
      key: kids > 0 ? 'ui.private.linkSingleKids' : 'ui.private.linkSingle',
      params: { n: kids },
    };
  }

  constructor() {
    addIcons({ chevronBack });
  }

  protected async setLifestyle(id: string): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.game.setLifestyle(id);
    } finally {
      this.busy.set(false);
    }
  }

  protected async retire(): Promise<void> {
    const alert = await this.alerts.create({
      header: this.i18n.t('ui.life.retireConfirmTitle'),
      message: this.i18n.t('ui.life.retireConfirm'),
      buttons: [
        { text: this.i18n.t('ui.common.cancel'), role: 'cancel' },
        { text: this.i18n.t('ui.life.retire'), role: 'confirm' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'confirm') return;
    try {
      await this.game.retire();
      await this.router.navigateByUrl('/fine', { replaceUrl: true });
    } catch {
      await this.toast.show(this.i18n.t('ui.common.error'), 'error');
    }
  }
}
