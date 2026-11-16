import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, remove, star, starOutline } from 'ionicons/icons';
import {
  getAgentCandidates,
  getOffers,
  getSponsorOffers,
  getTransferWindow,
  type OfferView,
} from '@outstanding/engine';
import { GameService } from '../core/game.service';
import { I18nService, TranslatePipe } from '../core/i18n.service';
import { formatMoney } from '../core/text';
import { ToastService } from '../core/toast.service';
import { seasonWeekNumber } from '../core/views';
import { CrestComponent } from '../ui/crest.component';
import { TabBarComponent } from '../ui/tab-bar.component';

/** Mercato e contratti: offerte dei club con trattativa, procuratore e sponsor. */
@Component({
  selector: 'app-market',
  imports: [IonContent, IonIcon, TranslatePipe, CrestComponent, TabBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-content class="o-page">
      @if (view(); as v) {
        <main class="o-wrap o-enter">
          <header class="head">
            <h1 class="o-display title">{{ 'ui.market.title' | t }}</h1>
            <span class="o-chip" [class.o-chip--accent]="v.window">
              {{ (v.window ? 'ui.market.window.' + v.window : 'ui.market.window.closed') | t }}
            </span>
          </header>

          <section class="block">
            <h2 class="o-section-title">{{ 'ui.market.offers' | t }}</h2>
            @for (o of v.offers; track o.id) {
              <article class="o-card offer">
                <div class="offer-head">
                  <app-crest [crest]="crestOf(o.clubId)" [size]="40" />
                  <div class="offer-club">
                    <span class="club">{{ o.clubName }}</span>
                    <span class="o-muted small">{{ 'leagues.' + o.level + '.name' | t }}</span>
                  </div>
                  <span class="o-chip kind">{{ 'offers.kind.' + o.kind | t }}</span>
                </div>
                <div class="terms">
                  <div>
                    <span class="o-label">{{ 'ui.market.salary' | t }}</span><span
                      class="o-number val"
                      >{{ money(o.salaryWeekly) }}</span
                    >
                  </div>
                  @if (o.kind !== 'loan') {
                    <div>
                      <span class="o-label">{{ 'ui.market.seasons' | t }}</span><span
                        class="o-number val"
                        >{{ o.seasons }}</span
                      >
                    </div>
                  }
                  @if (o.signingBonus > 0) {
                    <div>
                      <span class="o-label">{{ 'ui.market.bonus' | t }}</span><span
                        class="o-number val"
                        >{{ money(o.signingBonus) }}</span
                      >
                    </div>
                  }
                </div>
                <span class="o-muted small">{{
                  'ui.market.expires' | t: { week: expiresIn(o) }
                }}</span>

                @if (negotiating() === o.id) {
                  <div class="negotiate">
                    <div class="stepper">
                      <span class="o-label">{{ 'ui.market.ask' | t }}</span>
                      <div class="step-row">
                        <button
                          class="o-icon-btn"
                          type="button"
                          (click)="bumpSalary(-1)"
                          [attr.aria-label]="'ui.market.less' | t"
                        >
                          <ion-icon name="remove" aria-hidden="true"></ion-icon>
                        </button>
                        <span class="o-number val">{{ money(askSalary()) }}</span>
                        <button
                          class="o-icon-btn"
                          type="button"
                          (click)="bumpSalary(1)"
                          [attr.aria-label]="'ui.market.more' | t"
                        >
                          <ion-icon name="add" aria-hidden="true"></ion-icon>
                        </button>
                      </div>
                    </div>
                    <div class="stepper">
                      <span class="o-label">{{ 'ui.market.seasons' | t }}</span>
                      <div class="step-row">
                        <button
                          class="o-icon-btn"
                          type="button"
                          (click)="bumpSeasons(-1)"
                          [attr.aria-label]="'ui.market.less' | t"
                        >
                          <ion-icon name="remove" aria-hidden="true"></ion-icon>
                        </button>
                        <span class="o-number val">{{ askSeasons() }}</span>
                        <button
                          class="o-icon-btn"
                          type="button"
                          (click)="bumpSeasons(1)"
                          [attr.aria-label]="'ui.market.more' | t"
                        >
                          <ion-icon name="add" aria-hidden="true"></ion-icon>
                        </button>
                      </div>
                    </div>
                    <div class="o-row">
                      <button
                        class="o-btn o-btn--ghost o-btn--small"
                        type="button"
                        (click)="negotiating.set(null)"
                      >
                        {{ 'ui.common.cancel' | t }}
                      </button>
                      <button
                        class="o-btn o-btn--small"
                        type="button"
                        [disabled]="busy()"
                        (click)="sendAsk(o)"
                      >
                        {{ 'ui.market.send' | t }}
                      </button>
                    </div>
                  </div>
                } @else {
                  <div class="o-row">
                    <button
                      class="o-btn o-btn--ghost o-btn--small"
                      type="button"
                      [disabled]="busy()"
                      (click)="reject(o)"
                    >
                      {{ 'ui.market.reject' | t }}
                    </button>
                    @if (o.kind !== 'loan') {
                      <button
                        class="o-btn o-btn--ghost o-btn--small"
                        type="button"
                        [disabled]="busy()"
                        (click)="openNegotiation(o)"
                      >
                        {{ 'ui.market.negotiate' | t }}
                      </button>
                    }
                    <button
                      class="o-btn o-btn--small"
                      type="button"
                      [disabled]="busy()"
                      (click)="accept(o)"
                    >
                      {{ 'ui.market.accept' | t }}
                    </button>
                  </div>
                }
              </article>
            } @empty {
              <p class="o-muted small">
                {{ (v.window ? 'ui.market.noOffers' : 'ui.market.noOffersClosed') | t }}
              </p>
            }
          </section>

          <section class="block">
            <h2 class="o-section-title">{{ 'ui.market.agent' | t }}</h2>
            @if (v.agent; as a) {
              <div class="o-card agent">
                <div class="agent-row">
                  <div class="grow">
                    <span class="club">{{ a.name }}</span>
                    <span class="o-muted small">{{
                      'ui.market.commission' | t: { pct: a.commission }
                    }}</span>
                  </div>
                  <span class="stars" [attr.aria-label]="'ui.market.stars' | t: { n: a.quality }">
                    @for (i of [1, 2, 3, 4, 5]; track i) {
                      <ion-icon
                        [name]="i <= a.quality ? 'star' : 'star-outline'"
                        aria-hidden="true"
                      ></ion-icon>
                    }
                  </span>
                </div>
                <button
                  class="o-btn o-btn--danger o-btn--small"
                  type="button"
                  [disabled]="busy()"
                  (click)="fireAgent()"
                >
                  {{ 'ui.market.fire' | t }}
                </button>
              </div>
            } @else {
              <p class="o-muted small">{{ 'ui.market.noAgent' | t }}</p>
            }
            @for (c of v.candidates; track c.id) {
              <div class="o-card agent">
                <div class="agent-row">
                  <div class="grow">
                    <span class="club">{{ c.name }}</span>
                    <span class="o-muted small">{{
                      'ui.market.commission' | t: { pct: c.commission }
                    }}</span>
                  </div>
                  <span class="stars" [attr.aria-label]="'ui.market.stars' | t: { n: c.quality }">
                    @for (i of [1, 2, 3, 4, 5]; track i) {
                      <ion-icon
                        [name]="i <= c.quality ? 'star' : 'star-outline'"
                        aria-hidden="true"
                      ></ion-icon>
                    }
                  </span>
                </div>
                <button
                  class="o-btn o-btn--ghost o-btn--small"
                  type="button"
                  [disabled]="busy()"
                  (click)="hire(c.id)"
                >
                  {{ 'ui.market.hire' | t }}
                </button>
              </div>
            }
          </section>

          <section class="block">
            <h2 class="o-section-title">{{ 'ui.market.sponsors' | t }}</h2>
            @for (sp of v.sponsorOffers; track sp.id) {
              <div class="o-card">
                <div class="agent-row">
                  <div class="grow">
                    <span class="club">{{ sp.name }}</span>
                    <span class="o-muted small"
                      >{{ 'sponsors.categories.' + sp.category | t }} ·
                      {{ 'ui.market.untilSeason' | t: { season: sp.untilSeason } }}</span
                    >
                  </div>
                  <span class="o-number val">{{ money(sp.weeklyIncome) }}</span>
                </div>
                <div class="o-row">
                  <button
                    class="o-btn o-btn--ghost o-btn--small"
                    type="button"
                    [disabled]="busy()"
                    (click)="rejectSponsor(sp.id)"
                  >
                    {{ 'ui.market.reject' | t }}
                  </button>
                  <button
                    class="o-btn o-btn--small"
                    type="button"
                    [disabled]="busy() || v.sponsorsFull"
                    (click)="acceptSponsor(sp.id)"
                  >
                    {{ 'ui.market.accept' | t }}
                  </button>
                </div>
              </div>
            }
            @for (d of v.sponsors; track d.sponsorId) {
              <div class="o-card agent-row">
                <div class="grow">
                  <span class="club">{{ d.name }}</span>
                  <span class="o-muted small">{{
                    'ui.market.activeUntil' | t: { season: d.untilSeason }
                  }}</span>
                </div>
                <span class="o-number val">{{ money(d.weeklyIncome) }}</span>
              </div>
            }
            @if (v.sponsorOffers.length === 0 && v.sponsors.length === 0) {
              <p class="o-muted small">{{ 'ui.market.noSponsors' | t }}</p>
            }
          </section>
        </main>
      }
    </ion-content>
    <app-tab-bar active="market" />
  `,
  styles: `
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .title {
      font-size: 36px;
    }
    .block {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .offer-head,
    .agent-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .offer-club,
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
      font-size: 19px;
      text-transform: uppercase;
      line-height: 1.05;
    }
    .kind {
      padding: 4px 10px;
      font-size: 12px;
    }
    .small {
      font-size: var(--o-text-sm);
    }
    .terms {
      display: flex;
      gap: 18px;
    }
    .terms div {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .val {
      font-size: 22px;
    }
    .negotiate {
      display: flex;
      flex-direction: column;
      gap: 10px;
      border-top: 1px solid var(--o-border);
      padding-top: 10px;
    }
    .stepper {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .step-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .stars {
      display: inline-flex;
      gap: 2px;
      color: var(--o-accent-fg);
      font-size: 16px;
    }
  `,
})
export class MarketPage {
  private readonly game = inject(GameService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly busy = signal(false);
  protected readonly negotiating = signal<string | null>(null);
  protected readonly askSalary = signal(0);
  protected readonly askSeasons = signal(1);
  private readonly maxSeasons = this.game.ctx.config.economy.negotiation.maxSeasons;

  protected readonly view = computed(() => {
    const s = this.game.state();
    if (!s) return null;
    const ctx = this.game.ctx;
    const p = s.player;
    const agent = p.agentId ? s.world.npcs.find((n) => n.id === p.agentId) : undefined;
    const npcView = (n: {
      id: string;
      firstName: string;
      lastName: string;
      quality?: number;
      commission?: number;
    }) => ({
      id: n.id,
      name: `${n.firstName} ${n.lastName}`,
      quality: n.quality ?? 1,
      commission: Math.round((n.commission ?? 0) * 100),
    });
    const sponsorName = (id: string) => ctx.content.sponsors.find((x) => x.id === id)?.name ?? id;
    return {
      window: getTransferWindow(s, ctx),
      offers: getOffers(s),
      agent: agent ? npcView(agent) : null,
      candidates: agent ? [] : getAgentCandidates(s, ctx).map(npcView),
      sponsorOffers: getSponsorOffers(s, ctx),
      sponsors: p.sponsors.map((d) => ({ ...d, name: sponsorName(d.sponsorId) })),
      sponsorsFull: p.sponsors.length >= ctx.config.economy.sponsors.max,
    };
  });

  constructor() {
    addIcons({ add, remove, star, starOutline });
  }

  protected money(n: number): string {
    return formatMoney(n);
  }

  protected crestOf(clubId: string) {
    return this.game.state()!.world.clubs.find((c) => c.id === clubId)!.crest;
  }

  protected expiresIn(o: OfferView): number {
    const s = this.game.state()!;
    return seasonWeekNumber({ ...s, week: o.expiresWeek }, this.game.ctx);
  }

  protected openNegotiation(o: OfferView): void {
    this.negotiating.set(o.id);
    this.askSalary.set(o.salaryWeekly);
    this.askSeasons.set(o.seasons);
  }

  /** Il rilancio procede a scatti del 5% dello stipendio offerto. */
  protected bumpSalary(dir: number): void {
    const offer = this.view()?.offers.find((o) => o.id === this.negotiating());
    if (!offer) return;
    const step = Math.max(10, Math.round(offer.salaryWeekly * 0.05));
    this.askSalary.update((v) => Math.max(step, v + dir * step));
  }

  protected bumpSeasons(dir: number): void {
    this.askSeasons.update((v) => Math.min(this.maxSeasons, Math.max(1, v + dir)));
  }

  protected async sendAsk(o: OfferView): Promise<void> {
    await this.run(async () => {
      const result = await this.game.negotiate(o.id, {
        salaryWeekly: this.askSalary(),
        seasons: this.askSeasons(),
      });
      await this.toast.show(this.i18n.t('offers.negotiation.' + result));
      if (result !== 'countered') this.negotiating.set(null);
      else {
        const updated = this.view()?.offers.find((x) => x.id === o.id);
        if (updated) this.askSalary.set(updated.salaryWeekly);
      }
    });
  }

  protected accept(o: OfferView): Promise<void> {
    return this.run(async () => {
      await this.game.acceptOffer(o.id);
      await this.toast.show(this.i18n.t('ui.market.signed', { club: o.clubName }));
    });
  }

  protected reject(o: OfferView): Promise<void> {
    return this.run(() => this.game.rejectOffer(o.id));
  }

  protected hire(id: string): Promise<void> {
    return this.run(() => this.game.hireAgent(id));
  }

  protected fireAgent(): Promise<void> {
    return this.run(() => this.game.fireAgent());
  }

  protected acceptSponsor(id: string): Promise<void> {
    return this.run(() => this.game.acceptSponsor(id));
  }

  protected rejectSponsor(id: string): Promise<void> {
    return this.run(() => this.game.rejectSponsor(id));
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await fn();
    } catch {
      await this.toast.show(this.i18n.t('ui.market.notNow'), 'error');
    } finally {
      this.busy.set(false);
    }
  }
}
