import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronBack } from 'ionicons/icons';
import { lookChangeCost, type Appearance } from '@outstanding/engine';
import { GameService } from '../core/game.service';
import { I18nService, TranslatePipe } from '../core/i18n.service';
import { formatMoney } from '../core/text';
import { ToastService } from '../core/toast.service';
import { clubInfo, playerAge } from '../core/views';
import { AvatarComponent } from '../ui/avatar.component';
import { LookEditorComponent } from '../ui/look-editor.component';

/**
 * Barbiere e tatuatore: in carriera si cambiano taglio, barba, accessori e tatuaggi pagando il
 * conto. Le parti scelte alla nascita (carnagione, viso, occhi, corporatura) restano.
 */
@Component({
  selector: 'app-look',
  imports: [IonContent, IonIcon, TranslatePipe, AvatarComponent, LookEditorComponent],
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
            <span class="o-label">{{ 'ui.look.kicker' | t }}</span>
            <span class="spacer"></span>
          </header>
          <h1 class="o-display title">{{ 'ui.look.title' | t }}</h1>

          <section class="stage">
            <div class="frame before">
              <app-avatar
                [appearance]="s.player.appearance"
                [kit]="kit()"
                [age]="age()"
                [size]="96"
                [label]="'ui.look.before' | t"
              />
              <span class="o-label">{{ 'ui.look.before' | t }}</span>
            </div>
            <span class="arrow" aria-hidden="true">→</span>
            <div class="frame after">
              <app-avatar
                [appearance]="draft()"
                [kit]="kit()"
                [age]="age()"
                [size]="132"
                [label]="'ui.look.after' | t"
              />
              <span class="o-label">{{ 'ui.look.after' | t }}</span>
            </div>
          </section>

          <section class="o-card">
            <app-look-editor [value]="draft()" [state]="s" (changed)="draft.set($event)" />
          </section>

          <section class="bill" [attr.aria-label]="'ui.look.bill' | t">
            <div class="bill-row">
              <span>{{ 'ui.look.bill' | t }}</span>
              <span class="o-number amount">{{ money(cost()) }}</span>
            </div>
            <div class="bill-row small">
              <span>{{ 'ui.look.cash' | t }}</span>
              <span>{{ money(s.player.money.cash) }}</span>
            </div>
            @if (cost() > s.player.money.cash) {
              <p class="short">{{ 'ui.look.short' | t }}</p>
            }
            <p class="prices">
              {{
                'ui.look.prices'
                  | t
                    : {
                        style: money(prices.styleChangeCost),
                        tattoo: money(prices.tattooCost),
                        removal: money(prices.tattooRemovalCost),
                      }
              }}
            </p>
          </section>

          <div class="cta">
            <button
              class="o-btn"
              type="button"
              [disabled]="!changed() || busy() || cost() > s.player.money.cash"
              (click)="confirm()"
            >
              {{ (cost() > 0 ? 'ui.look.pay' : 'ui.look.save') | t: { amount: money(cost()) } }}
            </button>
            @if (changed()) {
              <button class="o-btn o-btn--ghost o-btn--small" type="button" (click)="reset()">
                {{ 'ui.look.undo' | t }}
              </button>
            }
          </div>
        </main>
      }
    </ion-content>
  `,
  styles: `
    .top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .spacer {
      width: var(--o-touch);
    }
    .title {
      font-size: 38px;
    }
    .stage {
      display: flex;
      align-items: flex-end;
      justify-content: center;
      gap: 14px;
    }
    .frame {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
    .before {
      opacity: 0.7;
    }
    .arrow {
      align-self: center;
      font-family: var(--o-font-display);
      font-size: 28px;
      color: var(--o-accent-fg);
    }
    .bill {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 14px 16px;
      border-radius: var(--o-radius-md);
      background: var(--o-paper);
      color: var(--o-ink);
      box-shadow: var(--o-shadow-paper);
    }
    .bill-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-weight: 600;
    }
    .bill-row.small {
      font-size: 13px;
      font-weight: 500;
      color: var(--o-ink-soft);
    }
    .amount {
      font-size: 28px;
    }
    .short {
      margin: 0;
      font-size: 13px;
      color: var(--o-headline-red);
      font-weight: 600;
    }
    .prices {
      margin: 0;
      padding-top: 6px;
      border-top: 1px dashed var(--o-paper-rule);
      font-size: 12px;
      color: var(--o-ink-muted);
    }
    .cta {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
  `,
})
export class LookPage {
  protected readonly game = inject(GameService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly location = inject(Location);
  private readonly ctx = this.game.ctx;

  protected readonly prices = this.ctx.config.look;
  protected readonly busy = signal(false);
  protected readonly draft = signal<Appearance>(this.game.state()!.player.appearance);

  protected readonly kit = computed(() => {
    const s = this.game.state();
    return (s && clubInfo(s, this.ctx)?.club.kit) ?? null;
  });
  protected readonly age = computed(() => {
    const s = this.game.state();
    return s ? playerAge(s, this.ctx) : null;
  });
  protected readonly cost = computed(() => {
    const s = this.game.state();
    return s ? lookChangeCost(s.player.appearance, this.draft(), this.ctx) : 0;
  });
  protected readonly changed = computed(() => {
    const s = this.game.state();
    return !!s && JSON.stringify(s.player.appearance) !== JSON.stringify(this.draft());
  });

  constructor() {
    addIcons({ chevronBack });
  }

  protected money(v: number): string {
    return formatMoney(v);
  }

  protected reset(): void {
    this.draft.set(this.game.state()!.player.appearance);
  }

  protected back(): void {
    this.location.back();
  }

  protected async confirm(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const cost = await this.game.changeLook(this.draft());
      this.draft.set(this.game.state()!.player.appearance);
      await this.toast.show(
        this.i18n.t(cost > 0 ? 'ui.look.paid' : 'ui.look.saved', { amount: formatMoney(cost) }),
      );
    } catch {
      await this.toast.show(this.i18n.t('ui.common.error'), 'error');
    } finally {
      this.busy.set(false);
    }
  }
}
