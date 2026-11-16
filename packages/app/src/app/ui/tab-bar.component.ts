import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonFooter, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  homeOutline,
  personOutline,
  podiumOutline,
  swapHorizontalOutline,
  trophyOutline,
} from 'ionicons/icons';
import { GameService } from '../core/game.service';
import { TranslatePipe } from '../core/i18n.service';

export type TabId = 'week' | 'profile' | 'market' | 'standings' | 'career';

/** Navigazione principale in basso, raggiungibile con il pollice. */
@Component({
  selector: 'app-tab-bar',
  imports: [IonFooter, IonIcon, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-footer>
      <nav [attr.aria-label]="'ui.nav.label' | t">
        @for (tab of tabs; track tab.id) {
          <a
            [routerLink]="tab.path"
            [class.active]="tab.id === active()"
            [attr.aria-current]="tab.id === active() ? 'page' : null"
          >
            <span class="icon">
              <ion-icon [name]="tab.icon" aria-hidden="true"></ion-icon>
              @if (tab.id === 'market' && offers() > 0) {
                <span class="badge">{{ offers() }}</span>
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
      border-top: 1px solid var(--o-border);
      background: var(--o-bg-deep);
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
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
      transition: color var(--o-fast) var(--o-ease);
    }
    a.active {
      color: var(--o-accent-fg);
      font-weight: 600;
    }
    .icon {
      position: relative;
      font-size: 22px;
      display: inline-flex;
    }
    .badge {
      position: absolute;
      top: -4px;
      right: -10px;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      border-radius: 8px;
      background: var(--o-headline-red);
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      line-height: 16px;
      text-align: center;
    }
  `,
})
export class TabBarComponent {
  readonly active = input.required<TabId>();
  private readonly game = inject(GameService);
  protected readonly offers = computed(
    () => (this.game.state()?.offers.length ?? 0) + (this.game.state()?.sponsorOffers.length ?? 0),
  );

  protected readonly tabs = [
    { id: 'week', path: '/settimana', icon: 'home-outline', label: 'ui.nav.week' },
    { id: 'profile', path: '/profilo', icon: 'person-outline', label: 'ui.nav.profile' },
    { id: 'market', path: '/mercato', icon: 'swap-horizontal-outline', label: 'ui.nav.market' },
    { id: 'standings', path: '/classifica', icon: 'podium-outline', label: 'ui.nav.standings' },
    { id: 'career', path: '/carriera', icon: 'trophy-outline', label: 'ui.nav.career' },
  ] as const;

  constructor() {
    addIcons({ homeOutline, personOutline, swapHorizontalOutline, podiumOutline, trophyOutline });
  }
}
