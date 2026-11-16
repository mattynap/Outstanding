import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { walletOutline } from 'ionicons/icons';
import { SKILLS } from '@outstanding/engine';
import { GameService } from '../core/game.service';
import { TranslatePipe } from '../core/i18n.service';
import { formatAverage, formatInt, formatMoney } from '../core/text';
import { clubInfo, playerAge } from '../core/views';
import { AvatarComponent } from '../ui/avatar.component';
import { StatBarComponent } from '../ui/stat-bar.component';
import { TabBarComponent } from '../ui/tab-bar.component';

/** Profilo: avatar, abilità, tratti, personalità, immagine, contratto e crescita negli anni. */
@Component({
  selector: 'app-profile',
  imports: [
    IonContent,
    IonIcon,
    RouterLink,
    TranslatePipe,
    AvatarComponent,
    StatBarComponent,
    TabBarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-content class="o-page">
      @if (view(); as v) {
        <section class="hero">
          <span class="ghost-number" aria-hidden="true">{{ v.ovr }}</span>
          <a class="look-link" routerLink="/aspetto" [attr.aria-label]="'ui.look.open' | t">
            <app-avatar
              [appearance]="v.appearance"
              [kit]="v.kit"
              [age]="v.age"
              [size]="112"
              [label]="v.name"
            />
            @if (!retired()) {
              <span class="look-badge">{{ 'ui.look.change' | t }}</span>
            }
          </a>
          <div class="hero-text">
            <span class="o-label soft"
              >{{ 'roles.' + v.role | t }} · {{ 'ui.common.years' | t: { n: v.age } }}</span
            >
            <h1 class="o-display hero-name">{{ v.firstName }}<br />{{ v.lastName }}</h1>
            <span class="soft small"
              >{{ v.hometown }} · {{ v.clubName ?? ('ui.week.freeAgent' | t) }}</span
            >
          </div>
          <div class="ovr">
            <span class="o-number">{{ v.ovr }}</span>
            <span class="ovr-label">OVR</span>
          </div>
        </section>

        <main class="o-wrap o-enter">
          <section class="o-card">
            <h2 class="o-section-title">{{ 'ui.profile.skills' | t }}</h2>
            <div class="grid2">
              @for (s of v.skills; track s.id) {
                <app-stat-bar [label]="'skills.' + s.id | t" [value]="s.value" />
              }
            </div>
          </section>

          @if (v.traits.length > 0) {
            <section class="block">
              <h2 class="o-section-title">{{ 'ui.profile.traits' | t }}</h2>
              <div class="traits">
                @for (tr of v.traits; track tr) {
                  <div class="trait">
                    <span class="o-chip o-chip--accent">{{ 'traits.' + tr + '.name' | t }}</span>
                    <span class="o-muted small">{{ 'traits.' + tr + '.desc' | t }}</span>
                  </div>
                }
              </div>
            </section>
          }

          <section class="o-card">
            <div class="o-section-head">
              <h2 class="o-section-title">{{ 'ui.profile.season' | t }}</h2>
              <span class="o-muted small">{{ 'ui.profile.average' | t: { avg: v.average } }}</span>
            </div>
            <div class="o-stats">
              <div class="o-stat">
                <span class="o-stat__value">{{ v.stats.appearances }}</span><span
                  class="o-stat__label"
                  >{{ 'ui.stats.appearances' | t }}</span
                >
              </div>
              <div class="o-stat">
                <span class="o-stat__value">{{ v.stats.goals }}</span><span class="o-stat__label">{{
                  'ui.stats.goals' | t
                }}</span>
              </div>
              <div class="o-stat">
                <span class="o-stat__value">{{ v.stats.assists }}</span><span
                  class="o-stat__label"
                  >{{ 'ui.stats.assists' | t }}</span
                >
              </div>
              <div class="o-stat">
                <span class="o-stat__value">{{ v.minutes }}</span><span class="o-stat__label">{{
                  'ui.stats.minutes' | t
                }}</span>
              </div>
            </div>
          </section>

          @if (v.growth.points.length > 1) {
            <section class="o-card">
              <div class="o-section-head">
                <h2 class="o-section-title">{{ 'ui.profile.growth' | t }}</h2>
                <span class="o-muted small">{{ 'ui.profile.growthHint' | t }}</span>
              </div>
              <svg
                class="chart"
                viewBox="0 0 300 110"
                role="img"
                [attr.aria-label]="'ui.profile.growth' | t"
              >
                <polyline
                  [attr.points]="v.growth.line"
                  fill="none"
                  stroke="var(--o-accent)"
                  stroke-width="3"
                  stroke-linejoin="round"
                  stroke-linecap="round"
                />
                @for (p of v.growth.points; track $index) {
                  <circle [attr.cx]="p.x" [attr.cy]="p.y" r="3.5" fill="var(--o-accent)" />
                  <text [attr.x]="p.x" [attr.y]="p.y - 8" text-anchor="middle" class="chart-label">
                    {{ p.ovr }}
                  </text>
                  <text [attr.x]="p.x" y="108" text-anchor="middle" class="chart-age">
                    {{ p.age }}
                  </text>
                }
              </svg>
            </section>
          }

          <section class="o-card">
            <h2 class="o-section-title">{{ 'ui.profile.person' | t }}</h2>
            <div class="grid2">
              <app-stat-bar [label]="'ui.stats.discipline' | t" [value]="v.persona.discipline" />
              <app-stat-bar [label]="'ui.stats.temperament' | t" [value]="v.persona.temperament" />
              <app-stat-bar
                [label]="'ui.stats.happiness' | t"
                [value]="v.persona.happiness"
                tone="auto"
              />
              <app-stat-bar [label]="'ui.stats.popularity' | t" [value]="v.image.popularity" />
              <app-stat-bar [label]="'ui.stats.reputation' | t" [value]="v.image.reputation" />
              <a class="followers" routerLink="/social">
                <span class="o-muted small">{{ 'ui.stats.followers' | t }}</span>
                <span class="o-number">{{ v.followers }}</span>
              </a>
            </div>
          </section>

          <section class="o-card contract">
            <h2 class="o-section-title">{{ 'ui.profile.contract' | t }}</h2>
            @if (v.contract; as c) {
              <div class="o-lines">
                <div class="o-line">
                  <span class="grow o-muted">{{ 'ui.profile.club' | t }}</span><span>{{
                    c.club
                  }}</span>
                </div>
                <div class="o-line">
                  <span class="grow o-muted">{{ 'ui.profile.salary' | t }}</span><span>{{
                    c.salary
                  }}</span>
                </div>
                <div class="o-line">
                  <span class="grow o-muted">{{ 'ui.profile.until' | t }}</span><span>{{
                    'ui.profile.untilSeason' | t: { season: c.until }
                  }}</span>
                </div>
                @if (c.loanFrom) {
                  <div class="o-line">
                    <span class="grow o-muted">{{ 'ui.profile.loanFrom' | t }}</span><span>{{
                      c.loanFrom
                    }}</span>
                  </div>
                }
              </div>
            } @else {
              <p class="o-muted small none">{{ 'ui.profile.noContract' | t }}</p>
            }
            <a class="o-btn o-btn--ghost o-btn--small" routerLink="/vita">
              <ion-icon name="wallet-outline" aria-hidden="true"></ion-icon
              >{{ 'ui.life.title' | t }}
            </a>
          </section>
        </main>
      }
    </ion-content>
    <app-tab-bar active="profile" />
  `,
  styles: `
    .hero {
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: flex-end;
      gap: 14px;
      padding: 20px 16px 16px;
      background: linear-gradient(180deg, var(--o-surface-raised) 0%, var(--o-bg) 100%);
    }
    .look-link {
      position: relative;
      z-index: 1;
      display: inline-flex;
      flex: 0 0 auto;
      text-decoration: none;
      border-radius: 16px;
    }
    .look-badge {
      position: absolute;
      left: 50%;
      bottom: -8px;
      transform: translateX(-50%);
      padding: 3px 9px;
      border-radius: 999px;
      background: var(--o-accent);
      color: var(--o-accent-ink);
      font-family: var(--o-font-display);
      font-weight: 700;
      font-size: 11px;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .ghost-number {
      position: absolute;
      right: -6px;
      top: -22px;
      font-family: var(--o-font-display);
      font-weight: 800;
      font-size: 180px;
      line-height: 1;
      color: var(--o-text);
      opacity: 0.06;
    }
    .hero-text {
      position: relative;
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    .hero-name {
      font-size: 32px;
    }
    .soft {
      color: var(--o-text-soft);
    }
    .small {
      font-size: var(--o-text-sm);
    }
    .ovr {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px 10px;
      border-radius: var(--o-radius-md);
      background: var(--o-accent);
      color: var(--o-accent-ink);
    }
    .ovr .o-number {
      font-size: 36px;
    }
    .ovr-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 1.2px;
    }
    .grid2 {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      column-gap: 18px;
      row-gap: 12px;
    }
    .block {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .traits {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .trait {
      display: flex;
      flex-direction: column;
      gap: 4px;
      align-items: flex-start;
    }
    .followers {
      display: flex;
      flex-direction: column;
      gap: 2px;
      text-decoration: none;
      color: inherit;
    }
    .followers .o-number {
      font-size: 22px;
    }
    .chart {
      width: 100%;
      height: auto;
    }
    .chart-label {
      font-family: var(--o-font-display);
      font-weight: 700;
      font-size: 12px;
      fill: var(--o-text);
    }
    .chart-age {
      font-size: 10px;
      fill: var(--o-text-muted);
    }
    .grow {
      flex: 1 1 auto;
    }
    .none {
      margin: 0;
    }
    a.o-btn {
      text-decoration: none;
    }
  `,
})
export class ProfilePage {
  private readonly game = inject(GameService);

  protected readonly retired = computed(() => !!this.game.state()?.retired);

  protected readonly view = computed(() => {
    const s = this.game.state();
    if (!s) return null;
    const ctx = this.game.ctx;
    const p = s.player;
    const info = clubInfo(s, ctx);
    const weights = ctx.config.ratings.roleWeights[p.role];
    // Prima le abilità che contano di più per il ruolo.
    const skills = [...SKILLS]
      .sort((a, b) => weights[b] - weights[a])
      .map((id) => ({ id, value: p.skills[id] }));
    const age = playerAge(s, ctx);
    const st = p.seasonStats;
    const clubName = (id: string) => s.world.clubs.find((c) => c.id === id)?.name ?? '';

    // Grafico di crescita: OVR a fine di ogni stagione più quello attuale.
    const series = [
      ...p.history.map((h) => ({ age: h.age, ovr: h.ovr })),
      { age, ovr: this.game.ovr() },
    ].slice(-12);
    const min = Math.min(...series.map((x) => x.ovr)) - 3;
    const max = Math.max(...series.map((x) => x.ovr)) + 3;
    const points = series.map((x, i) => ({
      ...x,
      x: series.length === 1 ? 150 : 16 + (i * 268) / (series.length - 1),
      y: 90 - ((x.ovr - min) / Math.max(1, max - min)) * 72,
    }));

    return {
      name: `${p.firstName} ${p.lastName}`,
      firstName: p.firstName,
      lastName: p.lastName,
      role: p.role,
      age,
      hometown: p.hometown,
      clubName: info?.club.name ?? null,
      appearance: p.appearance,
      kit: info?.club.kit ?? null,
      ovr: this.game.ovr(),
      skills,
      traits: p.traits,
      stats: st,
      minutes: formatInt(st.minutes),
      average: st.ratingCount > 0 ? formatAverage(st.ratingSum / st.ratingCount) : '–',
      persona: p.persona,
      image: p.image,
      followers: formatInt(p.image.followers),
      growth: { points, line: points.map((pt) => `${pt.x},${pt.y}`).join(' ') },
      contract: p.contract
        ? {
            club: clubName(p.contract.clubId),
            salary: formatMoney(p.contract.salaryWeekly),
            until: p.contract.untilSeason,
            loanFrom: p.loan ? clubName(p.loan.parentClubId) : null,
          }
        : null,
    };
  });

  constructor() {
    addIcons({ walletOutline });
  }
}
