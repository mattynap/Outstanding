import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { AlertController, IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronBack } from 'ionicons/icons';
import {
  businessValue,
  financeOf,
  loanQuote,
  netWorth,
  type Business,
  type LoanQuote,
} from '@outstanding/engine';
import { GameService } from '../core/game.service';
import { I18nService, TranslatePipe } from '../core/i18n.service';
import { formatMoney } from '../core/text';
import { ToastService } from '../core/toast.service';
import { PriceChartComponent } from '../ui/price-chart.component';
import { VignetteComponent } from '../ui/vignette.component';

type Tab = 'summary' | 'markets' | 'assets' | 'business' | 'bank';
const TABS: Tab[] = ['summary', 'markets', 'assets', 'business', 'bank'];

/**
 * Patrimonio: riepilogo e conto deposito, mercati (fondo, azioni, cripto inventati), beni con
 * vignetta, attività con andamento, banca (mutui e prestiti).
 */
@Component({
  selector: 'app-wealth',
  imports: [IonContent, IonIcon, TranslatePipe, PriceChartComponent, VignetteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-content class="o-page">
      @if (game.state(); as s) {
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
            <h1 class="o-display title">{{ 'ui.wealth.title' | t }}</h1>
          </header>

          <section class="o-card o-card--hero worth">
            <span class="o-label soft">{{ 'ui.wealth.netWorth' | t }}</span>
            <span class="o-number big" [class.o-neg]="worth().total < 0">{{
              money(worth().total)
            }}</span>
            <span class="soft small">{{
              'ui.wealth.cashLine' | t: { cash: money(s.player.money.cash) }
            }}</span>
          </section>

          <div class="tabs" role="tablist" [attr.aria-label]="'ui.wealth.title' | t">
            @for (t of tabs; track t) {
              <button
                class="o-chip"
                type="button"
                role="tab"
                [class.o-chip--accent]="tab() === t"
                [attr.aria-selected]="tab() === t"
                (click)="tab.set(t)"
              >
                {{ 'ui.wealth.tabs.' + t | t }}
              </button>
            }
          </div>

          @switch (tab()) {
            @case ('summary') {
              <section class="o-card">
                <h2 class="o-section-title">{{ 'ui.wealth.breakdown' | t }}</h2>
                <div class="o-lines">
                  @for (row of breakdown(); track row.key) {
                    <div class="o-line">
                      <span class="grow">{{ 'ui.wealth.parts.' + row.key | t }}</span>
                      <span [class.o-neg]="row.value < 0" class="num">{{ money(row.value) }}</span>
                    </div>
                  }
                </div>
              </section>
              <section class="o-card">
                <h2 class="o-section-title">{{ 'ui.wealth.deposit' | t }}</h2>
                <p class="small o-muted none">
                  {{ 'ui.wealth.depositText' | t: { rate: pct(cfg.deposit.annualRate) } }}
                </p>
                <div class="o-line">
                  <span class="grow">{{ 'ui.wealth.onDeposit' | t }}</span>
                  <span class="num">{{ money(finance().deposit) }}</span>
                </div>
                <label class="o-field">
                  <span class="o-label">{{ 'ui.wealth.amount' | t }}</span>
                  <input
                    id="deposit-amount"
                    class="o-input"
                    type="number"
                    inputmode="numeric"
                    min="0"
                    [value]="depositAmount() || ''"
                    (input)="depositAmount.set(num($event))"
                  />
                </label>
                <div class="o-row">
                  <button
                    class="o-btn o-btn--small"
                    type="button"
                    [disabled]="
                      busy() || depositAmount() <= 0 || depositAmount() > s.player.money.cash
                    "
                    (click)="run(() => game.deposit(depositAmount()), 'ui.wealth.done')"
                  >
                    {{ 'ui.wealth.put' | t }}
                  </button>
                  <button
                    class="o-btn o-btn--ghost o-btn--small"
                    type="button"
                    [disabled]="
                      busy() || depositAmount() <= 0 || depositAmount() > finance().deposit
                    "
                    (click)="run(() => game.withdraw(depositAmount()), 'ui.wealth.done')"
                  >
                    {{ 'ui.wealth.take' | t }}
                  </button>
                </div>
              </section>
            }

            @case ('markets') {
              <p class="small o-muted none">
                {{ 'ui.wealth.marketsText' | t: { fee: pct(cfg.market.tradeFee) } }}
              </p>
              @for (m of markets(); track m.id) {
                <section class="o-card market">
                  <div class="o-section-head">
                    <div class="col">
                      <h2 class="o-section-title">
                        {{ 'finance.instruments.' + m.id + '.name' | t }}
                      </h2>
                      <span class="o-muted small">{{
                        'finance.instruments.' + m.id + '.desc' | t
                      }}</span>
                    </div>
                    <div class="col right">
                      <span class="o-number price">{{ priceFormat(m.price) }}</span>
                      <span
                        class="small"
                        [class.o-pos]="m.change >= 0"
                        [class.o-neg]="m.change < 0"
                      >
                        {{ signedPct(m.change) }} {{ 'ui.wealth.inWeeks' | t: { n: m.weeks } }}
                      </span>
                    </div>
                  </div>
                  <app-price-chart
                    [values]="m.history"
                    [reference]="m.avgPrice"
                    [format]="priceFormat"
                    [weeksAgoLabel]="weeksAgo"
                  />
                  @if (m.units > 0) {
                    <div class="o-line">
                      <span class="grow">{{
                        'ui.wealth.holding' | t: { value: money(m.value) }
                      }}</span>
                      <span class="small" [class.o-pos]="m.gain >= 0" [class.o-neg]="m.gain < 0">{{
                        signedMoney(m.gain)
                      }}</span>
                    </div>
                  }
                  <div class="trade">
                    <input
                      class="o-input"
                      type="number"
                      inputmode="numeric"
                      min="0"
                      [attr.id]="'trade-' + m.id"
                      [attr.aria-label]="'ui.wealth.amount' | t"
                      [placeholder]="'ui.wealth.amount' | t"
                      [value]="tradeAmount()[m.id] || ''"
                      (input)="setTrade(m.id, num($event))"
                    />
                    <button
                      class="o-btn o-btn--small"
                      type="button"
                      [disabled]="
                        busy() ||
                        !(tradeAmount()[m.id]! > 0) ||
                        tradeAmount()[m.id]! > s.player.money.cash
                      "
                      (click)="
                        run(
                          () => game.buyInstrument(m.id, tradeAmount()[m.id]!),
                          'ui.wealth.bought'
                        )
                      "
                    >
                      {{ 'ui.wealth.buy' | t }}
                    </button>
                    @if (m.units > 0) {
                      <button
                        class="o-btn o-btn--ghost o-btn--small"
                        type="button"
                        [disabled]="busy()"
                        (click)="sellAll(m.id)"
                      >
                        {{ 'ui.wealth.sellAll' | t }}
                      </button>
                    }
                  </div>
                </section>
              }
            }

            @case ('assets') {
              @if (owned().length > 0) {
                <h2 class="o-section-title">{{ 'ui.wealth.yourAssets' | t }}</h2>
                @for (o of owned(); track o.id) {
                  <article class="o-card item">
                    <app-vignette
                      [id]="o.catalogId"
                      [label]="'finance.properties.' + o.catalogId | t"
                    />
                    <div class="item-body">
                      <span class="item-name">{{ 'finance.properties.' + o.catalogId | t }}</span>
                      <span class="small o-muted">
                        {{
                          'ui.wealth.valueLine'
                            | t: { value: money(o.value), upkeep: money(o.upkeep) }
                        }}
                      </span>
                      @if (o.mortgage) {
                        <span class="small o-muted">{{
                          'ui.wealth.mortgaged' | t: { left: money(o.mortgage) }
                        }}</span>
                      }
                      <button
                        class="o-btn o-btn--ghost o-btn--small"
                        type="button"
                        [disabled]="busy()"
                        (click)="sellAsset(o.id, o.catalogId)"
                      >
                        {{ 'ui.wealth.sell' | t }}
                      </button>
                    </div>
                  </article>
                }
              }
              <h2 class="o-section-title">{{ 'ui.wealth.catalog' | t }}</h2>
              <div class="mortgage-pick">
                <span class="o-label">{{ 'ui.wealth.payWith' | t }}</span>
                <div class="o-row chips">
                  <button
                    class="o-chip"
                    type="button"
                    [class.o-chip--accent]="mortgageSeasons() === null"
                    (click)="mortgageSeasons.set(null)"
                  >
                    {{ 'ui.wealth.cashOnly' | t }}
                  </button>
                  @for (n of cfg.loans.mortgage.seasons; track n) {
                    <button
                      class="o-chip"
                      type="button"
                      [class.o-chip--accent]="mortgageSeasons() === n"
                      (click)="mortgageSeasons.set(n)"
                    >
                      {{ 'ui.wealth.mortgageYears' | t: { n } }}
                    </button>
                  }
                </div>
              </div>
              @for (c of catalog(); track c.id) {
                <article class="o-card item">
                  <app-vignette [id]="c.id" [label]="'finance.properties.' + c.id | t" />
                  <div class="item-body">
                    <span class="item-name">{{ 'finance.properties.' + c.id | t }}</span>
                    <span class="o-number item-price">{{ money(c.price) }}</span>
                    <span class="small o-muted">{{
                      'ui.wealth.upkeep' | t: { upkeep: money(c.upkeepWeekly) }
                    }}</span>
                    @if (c.quote; as q) {
                      <span class="small" [class.o-neg]="!!q.refusal">
                        @if (q.refusal) {
                          {{ 'ui.wealth.refusal.' + q.refusal | t }}
                        } @else {
                          {{
                            'ui.wealth.mortgageLine'
                              | t: { down: money(c.down), rate: money(q.weeklyPayment) }
                          }}
                        }
                      </span>
                    } @else if (mortgageSeasons() !== null && !c.mortgage) {
                      <span class="small o-muted">{{ 'ui.wealth.noMortgage' | t }}</span>
                    }
                    <button
                      class="o-btn o-btn--small"
                      type="button"
                      [disabled]="busy() || !c.affordable"
                      (click)="buyAsset(c.id, c.useMortgage)"
                    >
                      {{ 'ui.wealth.buy' | t }}
                    </button>
                  </div>
                </article>
              }
            }

            @case ('business') {
              @for (b of businesses(); track b.id) {
                <article class="o-card item">
                  <app-vignette [id]="b.catalogId" [label]="b.name" />
                  <div class="item-body">
                    <span class="item-name">{{ b.name }}</span>
                    <span class="small o-muted">{{
                      'finance.businesses.' + b.catalogId + '.name' | t
                    }}</span>
                    <div class="health">
                      <span class="o-label">{{ 'ui.wealth.health' | t }}</span>
                      <div class="o-bar">
                        <div
                          class="o-bar__fill"
                          [class.o-bar__fill--pos]="b.health >= breakEven + 15"
                          [class.o-bar__fill--neg]="b.health < breakEven"
                          [style.width.%]="b.health"
                        ></div>
                      </div>
                    </div>
                    <span class="small">
                      {{ 'ui.wealth.lastWeek' | t }}
                      <b [class.o-pos]="b.lastResult >= 0" [class.o-neg]="b.lastResult < 0">{{
                        signedMoney(b.lastResult)
                      }}</b>
                      · {{ 'ui.wealth.total' | t }} {{ signedMoney(b.totalResult) }}
                    </span>
                    <button
                      class="o-btn o-btn--ghost o-btn--small"
                      type="button"
                      [disabled]="busy()"
                      (click)="sellBiz(b)"
                    >
                      {{ 'ui.wealth.sellFor' | t: { value: money(value(b)) } }}
                    </button>
                  </div>
                </article>
              }
              <h2 class="o-section-title">{{ 'ui.wealth.openTitle' | t }}</h2>
              <p class="small o-muted none">{{ 'ui.wealth.openText' | t }}</p>
              @for (c of bizCatalog; track c.id) {
                <article class="o-card item">
                  <app-vignette [id]="c.id" [label]="'finance.businesses.' + c.id + '.name' | t" />
                  <div class="item-body">
                    <span class="item-name">{{ 'finance.businesses.' + c.id + '.name' | t }}</span>
                    <span class="o-number item-price">{{ money(c.cost) }}</span>
                    <span class="small o-muted">{{
                      'finance.businesses.' + c.id + '.desc' | t
                    }}</span>
                    <button
                      class="o-btn o-btn--small"
                      type="button"
                      [disabled]="
                        busy() ||
                        c.cost > s.player.money.cash ||
                        businesses().length >= cfg.businesses.maxOpen
                      "
                      (click)="openBiz(c.id)"
                    >
                      {{ 'ui.wealth.open' | t }}
                    </button>
                  </div>
                </article>
              }
            }

            @case ('bank') {
              @if (finance().loans.length === 0) {
                <p class="small o-muted none">{{ 'ui.wealth.noLoans' | t }}</p>
              }
              @for (l of finance().loans; track l.id) {
                <section class="o-card">
                  <div class="o-section-head">
                    <h2 class="o-section-title">{{ 'ui.wealth.loanKinds.' + l.kind | t }}</h2>
                    @if (l.missed > 0) {
                      <span class="o-chip warn">{{
                        'ui.wealth.missed' | t: { n: l.missed, max: cfg.loans.missedToDefault }
                      }}</span>
                    }
                  </div>
                  <div class="o-lines">
                    <div class="o-line">
                      <span class="grow">{{ 'ui.wealth.remaining' | t }}</span><span class="num">{{
                        money(l.remaining)
                      }}</span>
                    </div>
                    <div class="o-line">
                      <span class="grow">{{ 'ui.wealth.payment' | t }}</span><span class="num">{{
                        money(l.weeklyPayment)
                      }}</span>
                    </div>
                    <div class="o-line">
                      <span class="grow">{{ 'ui.wealth.weeksLeft' | t }}</span><span class="num">{{
                        l.weeksLeft
                      }}</span>
                    </div>
                  </div>
                  <button
                    class="o-btn o-btn--ghost o-btn--small"
                    type="button"
                    [disabled]="busy() || l.remaining > s.player.money.cash"
                    (click)="run(() => game.repayLoan(l.id), 'ui.wealth.repaid')"
                  >
                    {{ 'ui.wealth.repay' | t: { amount: money(l.remaining) } }}
                  </button>
                </section>
              }
              <section class="o-card">
                <h2 class="o-section-title">{{ 'ui.wealth.personalTitle' | t }}</h2>
                <p class="small o-muted none">
                  {{
                    'ui.wealth.personalText'
                      | t
                        : {
                            rate: pct(cfg.loans.personal.annualRate),
                            missed: cfg.loans.missedToDefault,
                          }
                  }}
                </p>
                <label class="o-field">
                  <span class="o-label">{{ 'ui.wealth.amount' | t }}</span>
                  <input
                    id="loan-amount"
                    class="o-input"
                    type="number"
                    inputmode="numeric"
                    min="0"
                    [value]="loanAmount() || ''"
                    (input)="loanAmount.set(num($event))"
                  />
                </label>
                <div class="o-row chips">
                  @for (n of cfg.loans.personal.seasons; track n) {
                    <button
                      class="o-chip"
                      type="button"
                      [class.o-chip--accent]="loanSeasons() === n"
                      (click)="loanSeasons.set(n)"
                    >
                      {{ 'ui.wealth.mortgageYears' | t: { n } }}
                    </button>
                  }
                </div>
                @if (personalQuote(); as q) {
                  <p class="small none" [class.o-neg]="!!q.refusal">
                    @if (q.refusal) {
                      {{ 'ui.wealth.refusal.' + q.refusal | t }}
                    } @else {
                      {{
                        'ui.wealth.quote'
                          | t
                            : {
                                rate: money(q.weeklyPayment),
                                weeks: q.weeks,
                                total: money(q.totalRepaid),
                              }
                      }}
                    }
                  </p>
                }
                <button
                  class="o-btn o-btn--small"
                  type="button"
                  [disabled]="busy() || !personalQuote() || !!personalQuote()?.refusal"
                  (click)="takeLoan()"
                >
                  {{ 'ui.wealth.ask' | t }}
                </button>
              </section>
            }
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
      font-size: 34px;
    }
    .worth {
      gap: 4px;
    }
    .big {
      font-size: 44px;
      line-height: 1;
    }
    .soft {
      color: var(--o-text-soft);
    }
    .small {
      font-size: 13px;
      line-height: 1.45;
    }
    .none {
      margin: 0;
    }
    .num {
      font-variant-numeric: tabular-nums;
    }
    .tabs {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .tabs .o-chip {
      flex: 0 0 auto;
    }
    .col {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .right {
      align-items: flex-end;
      text-align: right;
    }
    .price {
      font-size: 26px;
    }
    .market {
      gap: 14px;
    }
    .trade {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      gap: 8px;
      align-items: center;
    }
    .trade .o-btn {
      width: auto;
      padding: 0 16px;
    }
    .item {
      flex-direction: row;
      gap: 12px;
      align-items: flex-start;
    }
    .item app-vignette {
      flex: 0 0 116px;
    }
    .item-body {
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .item-name {
      font-family: var(--o-font-display);
      font-weight: 700;
      font-size: 19px;
      text-transform: uppercase;
      line-height: 1.05;
    }
    .item-price {
      font-size: 20px;
    }
    .item-body .o-btn {
      margin-top: 4px;
    }
    .mortgage-pick {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .chips {
      flex-wrap: wrap;
      gap: 6px;
    }
    .health {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .warn {
      --px-b: var(--o-negative);
      color: var(--o-negative);
    }
  `,
})
export class WealthPage {
  protected readonly game = inject(GameService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly alerts = inject(AlertController);
  private readonly location = inject(Location);
  private readonly ctx = this.game.ctx;

  protected readonly cfg = this.ctx.config.finance;
  protected readonly tabs = TABS;
  protected readonly tab = signal<Tab>('summary');
  protected readonly busy = signal(false);
  protected readonly depositAmount = signal(0);
  protected readonly tradeAmount = signal<Record<string, number>>({});
  protected readonly mortgageSeasons = signal<number | null>(null);
  protected readonly loanAmount = signal(0);
  protected readonly loanSeasons = signal(this.cfg.loans.personal.seasons[0]!);
  protected readonly bizCatalog = this.cfg.businesses.catalog;
  protected readonly breakEven = this.cfg.businesses.breakEvenHealth;

  protected readonly finance = computed(() => financeOf(this.game.state()!, this.ctx));
  protected readonly worth = computed(() => netWorth(this.game.state()!, this.ctx));

  protected readonly breakdown = computed(() => {
    const w = this.worth();
    return [
      { key: 'cash', value: w.cash },
      { key: 'deposit', value: w.deposit },
      { key: 'investments', value: w.investments },
      { key: 'properties', value: w.properties },
      { key: 'businesses', value: w.businesses },
      { key: 'debts', value: -w.debts },
    ];
  });

  protected readonly markets = computed(() => {
    const f = this.finance();
    return this.cfg.market.instruments.map((i) => {
      const history = f.history[i.id] ?? [i.startPrice];
      const price = f.prices[i.id] ?? i.startPrice;
      const first = history[0] ?? price;
      const h = f.holdings[i.id];
      const units = h?.units ?? 0;
      const value = units * price;
      return {
        id: i.id,
        price,
        history,
        weeks: history.length - 1,
        change: first ? price / first - 1 : 0,
        units,
        value,
        gain: value - (h?.invested ?? 0),
        avgPrice: h && h.units > 0 ? h.invested / h.units : null,
      };
    });
  });

  protected readonly owned = computed(() => {
    const f = this.finance();
    return f.properties.map((p) => {
      const item = this.cfg.properties.catalog.find((c) => c.id === p.catalogId)!;
      const loan = f.loans.find((l) => l.propertyId === p.id);
      return { ...p, upkeep: item.upkeepWeekly, mortgage: loan?.remaining ?? 0 };
    });
  });

  protected readonly catalog = computed(() => {
    const s = this.game.state()!;
    const seasons = this.mortgageSeasons();
    return this.cfg.properties.catalog.map((c) => {
      const useMortgage = seasons !== null && c.mortgage;
      const down = Math.round(c.price * this.cfg.loans.mortgage.downPayment);
      const quote: LoanQuote | null = useMortgage
        ? loanQuote(s, 'mortgage', c.price - down, seasons, this.ctx)
        : null;
      const pay = useMortgage ? down : c.price;
      return {
        ...c,
        useMortgage,
        down,
        quote,
        affordable: pay <= s.player.money.cash && !quote?.refusal,
      };
    });
  });

  protected readonly businesses = computed(() => this.finance().businesses);

  protected readonly personalQuote = computed(() => {
    const amount = this.loanAmount();
    if (!(amount > 0)) return null;
    return loanQuote(this.game.state()!, 'personal', amount, this.loanSeasons(), this.ctx);
  });

  protected readonly priceFormat = (v: number) =>
    v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  protected readonly weeksAgo = (n: number) =>
    n === 0 ? this.i18n.t('ui.wealth.now') : this.i18n.t('ui.wealth.weeksAgo', { n });

  constructor() {
    addIcons({ chevronBack });
  }

  protected money(v: number): string {
    return formatMoney(v);
  }
  protected signedMoney(v: number): string {
    const r = Math.round(v);
    return r === 0 ? formatMoney(0) : (r > 0 ? '+' : '') + formatMoney(r);
  }
  protected pct(v: number): string {
    return `${(v * 100).toLocaleString('it-IT', { maximumFractionDigits: 1 })}%`;
  }
  protected signedPct(v: number): string {
    const s = (v * 100).toLocaleString('it-IT', { maximumFractionDigits: 1 });
    return `${v > 0 ? '+' : v < 0 ? '−' : ''}${s.replace('-', '')}%`;
  }
  protected num(e: Event): number {
    const v = Number((e.target as HTMLInputElement).value);
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  }
  protected setTrade(id: string, v: number): void {
    this.tradeAmount.update((t) => ({ ...t, [id]: v }));
  }
  protected value(b: Business): number {
    return businessValue(b, this.ctx);
  }
  protected back(): void {
    this.location.back();
  }

  protected async run(fn: () => Promise<unknown>, okKey: string, params = {}): Promise<boolean> {
    if (this.busy()) return false;
    this.busy.set(true);
    try {
      await fn();
      await this.toast.show(this.i18n.t(okKey, params));
      return true;
    } catch {
      await this.toast.show(this.i18n.t('ui.common.error'), 'error');
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  private async confirm(header: string, message: string, ok: string): Promise<boolean> {
    const alert = await this.alerts.create({
      header,
      message,
      buttons: [
        { text: this.i18n.t('ui.common.cancel'), role: 'cancel' },
        { text: ok, role: 'confirm' },
      ],
    });
    await alert.present();
    return (await alert.onDidDismiss()).role === 'confirm';
  }

  protected async sellAll(id: string): Promise<void> {
    let proceeds = 0;
    await this.run(
      async () => (proceeds = await this.game.sellInstrument(id)),
      'ui.wealth.soldFor',
    );
    if (proceeds) this.tradeAmount.update((t) => ({ ...t, [id]: 0 }));
  }

  protected async buyAsset(id: string, mortgage: boolean): Promise<void> {
    const name = this.i18n.t(`finance.properties.${id}`);
    const ok = await this.confirm(
      this.i18n.t('ui.wealth.confirmBuyTitle', { name }),
      this.i18n.t(mortgage ? 'ui.wealth.confirmMortgage' : 'ui.wealth.confirmBuy'),
      this.i18n.t('ui.wealth.buy'),
    );
    if (ok)
      await this.run(
        () => this.game.buyProperty(id, mortgage ? this.mortgageSeasons() : null),
        'ui.wealth.bought',
      );
  }

  protected async sellAsset(propertyId: string, catalogId: string): Promise<void> {
    const name = this.i18n.t(`finance.properties.${catalogId}`);
    const ok = await this.confirm(
      this.i18n.t('ui.wealth.confirmSellTitle', { name }),
      this.i18n.t('ui.wealth.confirmSell', { fee: this.pct(this.cfg.properties.sellFee) }),
      this.i18n.t('ui.wealth.sell'),
    );
    if (ok) await this.run(() => this.game.sellProperty(propertyId), 'ui.wealth.sold');
  }

  protected async openBiz(id: string): Promise<void> {
    const s = this.game.state()!;
    const alert = await this.alerts.create({
      header: this.i18n.t('ui.wealth.nameTitle'),
      message: this.i18n.t('ui.wealth.nameText'),
      inputs: [
        {
          name: 'name',
          type: 'text',
          value: this.i18n.t(`finance.businesses.${id}.default`, { lastName: s.player.lastName }),
          attributes: { maxlength: this.ctx.config.editor.limits.clubName },
        },
      ],
      buttons: [
        { text: this.i18n.t('ui.common.cancel'), role: 'cancel' },
        { text: this.i18n.t('ui.wealth.open'), role: 'confirm' },
      ],
    });
    await alert.present();
    const { role, data } = await alert.onDidDismiss<{ values: { name: string } }>();
    const name = data?.values?.name?.trim();
    if (role !== 'confirm' || !name) return;
    await this.run(() => this.game.openBusiness(id, name), 'ui.wealth.opened', { name });
  }

  protected async sellBiz(b: Business): Promise<void> {
    const ok = await this.confirm(
      this.i18n.t('ui.wealth.confirmSellTitle', { name: b.name }),
      this.i18n.t('ui.wealth.confirmSellBiz', { value: this.money(this.value(b)) }),
      this.i18n.t('ui.wealth.sell'),
    );
    if (ok) await this.run(() => this.game.sellBusiness(b.id), 'ui.wealth.sold');
  }

  protected async takeLoan(): Promise<void> {
    const q = this.personalQuote();
    if (!q || q.refusal) return;
    const ok = await this.confirm(
      this.i18n.t('ui.wealth.personalTitle'),
      this.i18n.t('ui.wealth.quote', {
        rate: this.money(q.weeklyPayment),
        weeks: q.weeks,
        total: this.money(q.totalRepaid),
      }),
      this.i18n.t('ui.wealth.ask'),
    );
    if (
      ok &&
      (await this.run(
        () => this.game.takeLoan(q.principal, this.loanSeasons()),
        'ui.wealth.granted',
      ))
    ) {
      this.loanAmount.set(0);
    }
  }
}
