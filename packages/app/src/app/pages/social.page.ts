import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  barbellOutline,
  chevronBack,
  flameOutline,
  giftOutline,
  heart,
  heartOutline,
  newspaperOutline,
} from 'ionicons/icons';
import {
  followersBonus,
  getPostOptions,
  mediaOf,
  naturalFollowers,
  type FeedItem,
} from '@outstanding/engine';
import { GameService } from '../core/game.service';
import { I18nService, TranslatePipe } from '../core/i18n.service';
import { formatDelta, formatInt, formatMoney } from '../core/text';
import { ToastService } from '../core/toast.service';
import { playerAge } from '../core/views';
import { AvatarComponent } from '../ui/avatar.component';

const POST_ICONS: Readonly<Record<string, string>> = {
  training: 'barbell-outline',
  private: 'heart-outline',
  charity: 'gift-outline',
  provocation: 'flame-outline',
};

/** Nome utente dal nome del giocatore: minuscole, senza accenti né spazi. */
export function handleOf(first: string, last: string): string {
  const clean = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  return `${clean(first)}.${clean(last)}`;
}

/**
 * Social del calciatore: profilo con follower e quanto valgono, il post della settimana (uno solo)
 * e il feed con i commenti dei tifosi, i propri post e i titoli dei giornali.
 */
@Component({
  selector: 'app-social',
  imports: [IonContent, IonIcon, TranslatePipe, AvatarComponent],
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
            <h1 class="o-display title">{{ 'ui.social.title' | t }}</h1>
          </header>

          <section class="o-card profile">
            <app-avatar
              class="pic"
              [appearance]="v.appearance"
              [kit]="v.kit"
              [age]="v.age"
              [size]="64"
            />
            <div class="who">
              <span class="handle">&#64;{{ v.handle }}</span>
              <span class="o-number followers">{{ v.followers }}</span>
              <span class="small soft">{{ 'ui.social.followers' | t }}</span>
            </div>
            <div class="worth">
              <span class="o-label">{{ 'ui.social.value' | t }}</span>
              <span class="o-number bonus">+{{ v.bonus }}%</span>
            </div>
          </section>
          <p class="small o-muted none">
            {{ 'ui.social.valueHint' | t: { natural: v.natural } }}
          </p>

          <section class="block">
            <div class="o-section-head">
              <h2 class="o-section-title">{{ 'ui.social.postTitle' | t }}</h2>
              <span class="o-chip" [class.o-chip--accent]="!v.posted">{{
                (v.posted ? 'ui.social.posted' : 'ui.private.oneChip') | t
              }}</span>
            </div>
            <div class="posts">
              @for (o of v.posts; track o.id) {
                <button
                  class="post"
                  type="button"
                  [disabled]="busy() || !o.available"
                  (click)="publish(o.id)"
                >
                  <ion-icon [name]="icon(o.id)" aria-hidden="true"></ion-icon>
                  <span class="post-name">{{ 'media.posts.' + o.id + '.name' | t }}</span>
                  <span class="post-desc">{{ 'media.posts.' + o.id + '.desc' | t }}</span>
                  @if (o.cost > 0) {
                    <span class="o-number post-cost">{{ money(o.cost) }}</span>
                  }
                </button>
              }
            </div>
          </section>

          <section class="block">
            <h2 class="o-section-title">{{ 'ui.social.feed' | t }}</h2>
            @if (v.feed.length === 0) {
              <p class="small o-muted none">{{ 'ui.social.empty' | t }}</p>
            }
            @for (item of v.feed; track $index) {
              @switch (item.kind) {
                @case ('press') {
                  <article class="o-paper press">
                    <span class="press-head">
                      <ion-icon name="newspaper-outline" aria-hidden="true"></ion-icon>
                      {{ 'ui.paper.name' | t }} · {{ ago(item.week) }}
                    </span>
                    <p class="press-text">{{ item.textKey | t: item.params }}</p>
                  </article>
                }
                @default {
                  <article class="o-card bubble" [class.mine]="item.kind === 'post'">
                    <div class="bubble-head">
                      <span class="author">{{
                        item.kind === 'post' ? '@' + v.handle : '@' + item.author
                      }}</span>
                      <span class="small soft">{{ ago(item.week) }}</span>
                    </div>
                    <p class="text">{{ item.textKey | t: item.params }}</p>
                    <span class="likes" [class.neg]="item.tone === 'neg'">
                      <ion-icon name="heart" aria-hidden="true"></ion-icon>
                      {{ int(item.likes) }}
                    </span>
                  </article>
                }
              }
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
    .profile {
      flex-direction: row;
      align-items: center;
      gap: 14px;
    }
    .pic {
      flex: none;
      border-radius: 50%;
      overflow: hidden;
      box-shadow: 0 0 0 2px var(--o-accent);
    }
    .who {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .handle {
      font-weight: 700;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .followers {
      font-size: 34px;
      line-height: 1;
    }
    .worth {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
    }
    .bonus {
      font-size: 22px;
      color: var(--o-accent-fg);
    }
    .soft {
      color: var(--o-text-soft);
    }
    .small {
      font-size: var(--o-text-sm);
    }
    .none {
      margin: 0;
    }
    .block {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .posts {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .post {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
      padding: 12px;
      min-height: 132px;
      border-radius: var(--o-radius-md);
      border: 1px solid var(--o-border);
      background: var(--o-surface);
      color: var(--o-text);
      font: inherit;
      text-align: left;
      cursor: pointer;
      transition:
        border-color 150ms ease-out,
        transform 150ms ease-out;
    }
    .post:not(:disabled):active {
      transform: scale(0.98);
    }
    .post:not(:disabled):hover {
      border-color: var(--o-accent);
    }
    .post:disabled {
      opacity: 0.45;
      cursor: default;
    }
    .post ion-icon {
      font-size: 22px;
      color: var(--o-accent-fg);
    }
    .post-name {
      font-weight: 700;
    }
    .post-desc {
      font-size: 12px;
      line-height: 1.35;
      color: var(--o-text-soft);
    }
    .post-cost {
      margin-top: auto;
      font-size: 16px;
    }
    .bubble {
      gap: 4px;
      padding: 12px 14px;
      border-radius: 16px 16px 16px 4px;
    }
    .bubble.mine {
      --px-b: var(--o-accent);
      border-radius: 16px 16px 4px 16px;
    }
    .bubble-head {
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }
    .author {
      font-weight: 700;
      font-size: 14px;
      color: var(--o-accent-fg);
    }
    .text {
      margin: 0;
      line-height: 1.4;
    }
    .likes {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      color: #e05a6a;
      font-variant-numeric: tabular-nums;
    }
    .likes.neg {
      color: var(--o-text-soft);
    }
    .press {
      gap: 4px;
      padding: 12px 14px;
    }
    .press-head {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--o-ink-muted);
    }
    .press-text {
      margin: 0;
      font-family: var(--o-font-display);
      font-size: 20px;
      line-height: 1.15;
      color: var(--o-ink);
    }
  `,
})
export class SocialPage {
  protected readonly game = inject(GameService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly location = inject(Location);

  protected readonly busy = signal(false);
  protected readonly money = formatMoney;
  protected readonly int = formatInt;

  protected readonly view = computed(() => {
    const s = this.game.state();
    if (!s) return null;
    const ctx = this.game.ctx;
    const p = s.player;
    const media = mediaOf(s);
    const club = p.clubId ? s.world.clubs.find((c) => c.id === p.clubId) : undefined;
    return {
      appearance: p.appearance,
      kit: club?.kit ?? null,
      age: playerAge(s, ctx),
      handle: handleOf(p.firstName, p.lastName),
      followers: formatInt(p.image.followers),
      natural: formatInt(naturalFollowers(p.image.popularity, ctx)),
      bonus: Math.round(followersBonus(p.image.followers, ctx) * 100),
      posted: media.postWeek === s.week,
      posts: getPostOptions(s, ctx),
      feed: media.feed as readonly FeedItem[],
      week: s.week,
    };
  });

  constructor() {
    addIcons({
      chevronBack,
      barbellOutline,
      heartOutline,
      giftOutline,
      flameOutline,
      heart,
      newspaperOutline,
    });
  }

  protected back(): void {
    this.location.back();
  }

  protected icon(id: string): string {
    return POST_ICONS[id] ?? 'heart-outline';
  }

  protected ago(week: number): string {
    const n = (this.view()?.week ?? week) - week;
    return n <= 0 ? this.i18n.t('ui.social.thisWeek') : this.i18n.t('ui.social.weeksAgo', { n });
  }

  protected async publish(id: string): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const r = await this.game.publishPost(id);
      await this.toast.show(
        this.i18n.t(r.backlash ? 'ui.social.backlash' : 'ui.social.published', {
          likes: formatInt(r.likes),
          followers: formatDelta(r.followers),
        }),
        r.backlash ? 'error' : 'info',
      );
    } catch {
      await this.toast.show(this.i18n.t('ui.common.error'), 'error');
    } finally {
      this.busy.set(false);
    }
  }
}
