import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronBack, timeOutline } from 'ionicons/icons';
import type { EventChange, EventView } from '@outstanding/engine';
import { GameService } from '../core/game.service';
import { I18nService, TranslatePipe } from '../core/i18n.service';
import { formatDelta, formatMoney } from '../core/text';
import { ToastService } from '../core/toast.service';
import { seasonWeekNumber } from '../core/views';
import { TipComponent } from '../ui/tip.component';

interface ChangeLine {
  text: string;
  tone: 'pos' | 'neg' | 'none';
}

/** Statistiche in cui un aumento è un male per il giocatore. */
const BAD_WHEN_UP = new Set(['condition.injuryRisk']);

/** Evento della settimana come notizia di giornale: testo, scelte, conseguenze. */
@Component({
  selector: 'app-event',
  imports: [IonContent, IonIcon, RouterLink, TranslatePipe, TipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-content class="o-page">
      <main class="o-wrap o-enter page">
        <header class="top">
          <a class="o-icon-btn" routerLink="/settimana" [attr.aria-label]="'ui.common.back' | t">
            <ion-icon name="chevron-back" aria-hidden="true"></ion-icon>
          </a>
          <span class="o-label">{{
            'ui.event.counter' | t: { week: week(), n: index(), total: total() }
          }}</span>
          <span class="spacer"></span>
        </header>

        @if (shown(); as e) {
          <article class="o-paper article">
            <div class="o-masthead">
              <span class="o-masthead__name">{{ 'ui.paper.name' | t }}</span>
              <span class="o-masthead__edition">{{
                'ui.paper.edition' | t: { week: week() }
              }}</span>
            </div>
            <span class="o-kicker">{{ 'ui.event.category.' + e.category | t }}</span>
            <h1 class="o-headline">{{ e.titleKey | t: e.params }}</h1>
            <div class="o-standfirst">
              <p>{{ e.textKey | t: e.params }}</p>
            </div>
            @if (result(); as r) {
              <div class="outcome" role="status">
                <span class="o-label ink">{{ 'ui.event.outcome' | t }}</span>
                <p class="chosen">«{{ e.choices[r.choice]!.textKey | t: e.params }}»</p>
                @if (r.lines.length > 0) {
                  <ul>
                    @for (l of r.lines; track $index) {
                      <li [class.up]="l.tone === 'pos'" [class.down]="l.tone === 'neg'">
                        {{ l.text }}
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="quiet">{{ 'ui.event.noChanges' | t }}</p>
                }
              </div>
            } @else {
              <div class="foot">
                <ion-icon name="time-outline" aria-hidden="true"></ion-icon>
                {{ 'ui.event.hint' | t }}
              </div>
            }
          </article>

          @if (result()) {
            <button class="o-btn" type="button" (click)="next()">
              {{ (remaining() > 0 ? 'ui.event.nextNews' : 'ui.event.backToWeek') | t }}
            </button>
          } @else {
            <app-tip tip="event.choice" />
            <div class="choices" role="group" [attr.aria-label]="'ui.event.choices' | t">
              @for (c of e.choices; track $index) {
                <button class="o-choice" type="button" [disabled]="busy()" (click)="choose($index)">
                  <span class="o-choice__letter">{{ letters[$index] }}</span>
                  <span class="o-choice__body">{{ c.textKey | t: e.params }}</span>
                </button>
              }
            </div>
          }
        } @else {
          <p class="o-muted">{{ 'ui.event.none' | t }}</p>
          <a class="o-btn" routerLink="/settimana">{{ 'ui.event.backToWeek' | t }}</a>
        }
      </main>
    </ion-content>
  `,
  styles: `
    .page {
      min-height: 100%;
    }
    .top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .spacer {
      width: var(--o-touch);
    }
    .article {
      min-height: 360px;
    }
    .foot {
      margin-top: auto;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: var(--o-text-sm);
      color: var(--o-ink-muted);
      border-top: 1px solid var(--o-paper-rule);
      padding-top: 10px;
    }
    .outcome {
      margin-top: auto;
      border-top: 1px solid var(--o-paper-rule);
      padding-top: 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .ink {
      color: var(--o-ink-muted);
    }
    .chosen {
      margin: 0;
      font-style: italic;
      color: var(--o-ink-soft);
    }
    ul {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    li {
      font-size: 13px;
      font-weight: 600;
      padding: 4px 9px;
      border-radius: 999px;
      background: rgba(0, 0, 0, 0.06);
    }
    li.up {
      background: rgba(29, 127, 69, 0.14);
      color: #145c32;
    }
    li.down {
      background: rgba(179, 38, 30, 0.12);
      color: #8c1d17;
    }
    .quiet {
      margin: 0;
      font-size: 13px;
      color: var(--o-ink-muted);
    }
    .choices {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    a.o-btn {
      text-decoration: none;
    }
  `,
})
export class EventPage {
  private readonly game = inject(GameService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly letters = ['A', 'B', 'C', 'D', 'E'];
  protected readonly busy = signal(false);
  /** Totale delle notizie all'arrivo sulla pagina (per "notizia 1 di 2"). */
  private readonly initialTotal = this.game.pendingEvents().length;
  protected readonly total = signal(Math.max(1, this.initialTotal));
  /** Evento appena risolto, mostrato con le sue conseguenze finché si va avanti. */
  private readonly resolved = signal<EventView | null>(null);
  protected readonly result = signal<{ choice: number; lines: ChangeLine[] } | null>(null);

  protected readonly pending = computed(() => (this.game.state() ? this.game.pendingEvents() : []));
  protected readonly shown = computed(() => this.resolved() ?? this.pending()[0] ?? null);
  protected readonly remaining = computed(() => this.pending().length);
  protected readonly index = computed(
    () => this.total() - this.pending().length + (this.resolved() ? 0 : 1),
  );
  protected readonly week = computed(() => {
    const s = this.game.state();
    return s ? seasonWeekNumber(s, this.game.ctx) : 0;
  });

  constructor() {
    addIcons({ chevronBack, timeOutline });
  }

  protected async choose(i: number): Promise<void> {
    const e = this.shown();
    if (!e || this.busy()) return;
    this.busy.set(true);
    try {
      const report = await this.game.resolveEvent(e.eventId, i);
      this.resolved.set(e);
      this.result.set({ choice: i, lines: this.describe(report.changes) });
    } catch {
      await this.toast.show(this.i18n.t('ui.common.error'), 'error');
    } finally {
      this.busy.set(false);
    }
  }

  protected async next(): Promise<void> {
    this.resolved.set(null);
    this.result.set(null);
    if (this.pending().length === 0) await this.router.navigateByUrl('/settimana');
  }

  /** Le conseguenze visibili; flag e catene di eventi restano nascosti (sorpresa). */
  private describe(changes: EventChange[]): ChangeLine[] {
    const t = (k: string, p?: Record<string, string | number>) => this.i18n.t(k, p);
    const lines: ChangeLine[] = [];
    for (const c of changes) {
      switch (c.kind) {
        case 'stat': {
          const d = c.after - c.before;
          if (Math.abs(d) < 0.5) break;
          const money = c.path.startsWith('money.');
          const amount = money ? (d > 0 ? '+' : '') + formatMoney(d) : formatDelta(d);
          const good = BAD_WHEN_UP.has(c.path) ? d < 0 : d > 0;
          lines.push({
            text: `${t('ui.statPath.' + c.path)} ${amount}`,
            tone: good ? 'pos' : 'neg',
          });
          break;
        }
        case 'relationship': {
          const d = c.after - c.before;
          if (Math.abs(d) < 0.5) break;
          const npc = this.game.state()?.world.npcs.find((n) => n.id === c.npcId);
          const who = npc ? `${npc.firstName} ${npc.lastName}` : '';
          lines.push({
            text: `${t('ui.event.change.relationship', { name: who })} ${formatDelta(d)}`,
            tone: d > 0 ? 'pos' : 'neg',
          });
          break;
        }
        case 'injury':
          lines.push({
            text: t('ui.event.change.injury', {
              injury: t('injuries.' + c.injuryType),
              weeks: c.weeks,
            }),
            tone: 'neg',
          });
          break;
        case 'trait':
          lines.push({
            text: t(
              c.action === 'add' ? 'ui.event.change.traitAdd' : 'ui.event.change.traitRemove',
              {
                trait: t('traits.' + c.traitId + '.name'),
              },
            ),
            tone: 'none',
          });
          break;
        case 'transferRequest':
          lines.push({ text: t('ui.event.change.transferRequest'), tone: 'none' });
          break;
        case 'partner': {
          const d = c.after - c.before;
          if (Math.abs(d) < 0.5) break;
          lines.push({
            text: `${t('ui.event.change.partner', { name: c.name })} ${formatDelta(d)}`,
            tone: d > 0 ? 'pos' : 'neg',
          });
          break;
        }
        case 'meet':
          lines.push({ text: t('ui.event.change.meet', { name: c.name }), tone: 'pos' });
          break;
        case 'affair':
          lines.push({
            text: t(
              c.action === 'start' ? 'ui.event.change.affairStart' : 'ui.event.change.affairEnd',
            ),
            tone: 'none',
          });
          break;
        case 'breakup':
          lines.push({ text: t('ui.event.change.breakup', { name: c.name }), tone: 'neg' });
          if (c.settlement > 0) {
            lines.push({
              text: t('ui.event.change.settlement', {
                name: c.name,
                amount: formatMoney(c.settlement),
              }),
              tone: 'neg',
            });
          }
          break;
        case 'business': {
          const d = c.after - c.before;
          if (Math.abs(d) < 0.5) break;
          lines.push({
            text: `${t('ui.event.change.business', { name: c.name })} ${formatDelta(d)}`,
            tone: d > 0 ? 'pos' : 'neg',
          });
          break;
        }
        default:
          break;
      }
    }
    return lines;
  }
}
