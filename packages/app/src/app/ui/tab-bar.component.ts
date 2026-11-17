import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonFooter } from '@ionic/angular';
import { GameService } from '../core/game.service';
import { TranslatePipe } from '../core/i18n.service';
import type { TabId } from '../core/unlocks';
import { UnlocksService } from '../core/unlocks.service';
import { PxIconComponent } from './px-icon.component';

export type { TabId } from '../core/unlocks';

const TABS: Record<TabId, { path: string; label: string }> = {
  week: { path: '/settimana', label: 'ui.nav.week' },
  profile: { path: '/profilo', label: 'ui.nav.profile' },
  market: { path: '/mercato', label: 'ui.nav.market' },
  standings: { path: '/classifica', label: 'ui.nav.standings' },
  career: { path: '/carriera', label: 'ui.nav.career' },
};

/**
 * Navigazione principale in basso, raggiungibile con il pollice. Le voci compaiono a gradini
 * (regole in core/unlocks.ts) e ogni voce nuova è annunciata una volta.
 */
@Component({
  selector: 'app-tab-bar',
  imports: [IonFooter, PxIconComponent, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-footer>
      @if (fresh().length) {
        <button type="button" class="news o-paper" (click)="unlocks.dismiss()">
          <app-px-icon name="new" [size]="24" />
          <span class="news__text">
            <strong>{{ 'ui.unlock.title' | t }}</strong>
            @for (id of fresh(); track id) {
              <span>{{ 'ui.unlock.tab.' + id | t }}</span>
            }
          </span>
          <span class="news__close">{{ 'ui.unlock.close' | t }}</span>
        </button>
      }
      <nav [attr.aria-label]="'ui.nav.label' | t" [style.--cols]="tabs().length">
        @for (tab of tabs(); track tab.id) {
          <a
            [routerLink]="tab.path"
            [class.active]="tab.id === active()"
            [attr.aria-current]="tab.id === active() ? 'page' : null"
          >
            <span class="icon">
              <app-px-icon [name]="tab.id" [size]="24" />
              @if (tab.id === 'market' && offers() > 0) {
                <span class="badge o-num">{{ offers() }}</span>
              }
              @if (fresh().includes(tab.id)) {
                <span class="star"><app-px-icon name="new" /></span>
              }
            </span>
            {{ tab.label | t }}
          </a>
        }
      </nav>
    </ion-footer>
  `,
  styles: `
    nav {
      height: 64px;
      border-top: var(--o-px) solid var(--o-border);
      background: var(--o-bg-deep);
      display: grid;
      grid-template-columns: repeat(var(--cols, 5), minmax(0, 1fr));
      padding-bottom: env(safe-area-inset-bottom);
      box-sizing: content-box;
    }
    a {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      text-decoration: none;
      color: var(--o-text-muted);
      font-size: var(--o-text-xs);
      transition: color var(--o-fast) steps(2, end);
    }
    a.active {
      color: var(--o-accent-fg);
      font-weight: 600;
    }
    .icon {
      position: relative;
      display: inline-flex;
    }
    .badge {
      position: absolute;
      top: -6px;
      right: -12px;
      min-width: 16px;
      height: 16px;
      padding: 0 3px;
      background: var(--o-headline-red);
      color: #fff;
      font-size: 14px;
      line-height: 16px;
      text-align: center;
      box-shadow: 0 0 0 var(--o-px) var(--o-bg-deep);
    }
    .star {
      position: absolute;
      top: -6px;
      left: -10px;
      color: var(--o-accent);
    }
    /* .o-paper impila in colonna: qui icona, testo e chiusura stanno su una riga. */
    .news.o-paper {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: var(--o-space-3);
      width: calc(100% - 2 * var(--o-space-4));
      margin: 0 var(--o-space-4) var(--o-space-4);
      padding: var(--o-space-3);
      font: inherit;
      font-size: var(--o-text-sm);
      text-align: left;
      animation: o-news-in var(--o-normal) steps(3, end);
    }
    .news app-px-icon {
      color: var(--o-headline-red);
    }
    .news__text {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 2px;
    }
    .news__text strong {
      font-family: var(--o-font-display);
      font-size: var(--o-text-lg);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .news__close {
      align-self: flex-start;
      font-size: var(--o-text-xs);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.7;
    }
    @keyframes o-news-in {
      from {
        transform: translateY(8px);
        opacity: 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .news {
        animation: none;
      }
    }
  `,
})
export class TabBarComponent {
  readonly active = input.required<TabId>();
  private readonly game = inject(GameService);
  protected readonly unlocks = inject(UnlocksService);
  protected readonly fresh = this.unlocks.fresh;
  protected readonly offers = computed(
    () => (this.game.state()?.offers.length ?? 0) + (this.game.state()?.sponsorOffers.length ?? 0),
  );
  private readonly visible = computed<TabId[]>(() => {
    const s = this.game.state();
    if (!s) return ['week', 'profile', 'standings'];
    return this.unlocks.visible(this.game.slot(), s, this.offers());
  });
  // La pagina attiva resta sempre nella barra, anche se ci si arriva da un altro percorso.
  protected readonly tabs = computed(() => {
    const ids = this.visible();
    const shown = ids.includes(this.active())
      ? ids
      : (['week', 'profile', 'market', 'standings', 'career'] as const).filter(
          (t) => ids.includes(t) || t === this.active(),
        );
    return shown.map((id) => ({ id, ...TABS[id] }));
  });

  constructor() {
    effect(() => {
      const slot = this.game.slot();
      const s = this.game.state();
      const offers = this.offers();
      if (slot !== null && s) void this.unlocks.sync(slot, s, offers);
    });
  }
}
