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
  label: string;
  /** Valore firmato (+5, −3), separato dall'etichetta per allinearlo a destra. */
  value?: string;
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
            <h1 class="o-headline headline">{{ e.titleKey | t: e.params }}</h1>
            <div class="o-standfirst">
              <p>{{ e.textKey | t: e.params }}</p>
            </div>
            @if (!result()) {
              <div class="foot">
                <ion-icon name="time-outline" aria-hidden="true"></ion-icon>
                {{ 'ui.event.hint' | t }}
              </div>
            }
          </article>

          @if (result(); as r) {
            <section
              class="o-paper clipping o-enter-steps"
              role="status"
              [attr.aria-label]="'ui.event.outcome' | t"
            >
              <span class="o-kicker">{{ 'ui.event.nextEdition' | t }}</span>
              <h2 class="clip-title">{{ e.choices[r.choice]!.textKey | t: e.params }}</h2>
              @if (r.lines.length > 0) {
                <dl class="effects">
                  @for (l of r.lines; track $index) {
                    <div
                      class="effect"
                      [class.pos]="l.tone === 'pos'"
                      [class.neg]="l.tone === 'neg'"
                    >
                      <dt>{{ l.label }}</dt>
                      @if (l.value) {
                        <dd class="o-num">{{ l.value }}</dd>
                      }
                    </div>
                  }
                </dl>
              } @else {
                <p class="quiet">{{ 'ui.event.noChanges' | t }}</p>
              }
            </section>
            <button class="o-btn" type="button" (click)="next()">
              {{ (remaining() > 0 ? 'ui.event.nextNews' : 'ui.event.backToWeek') | t }}
            </button>
          } @else {
            <app-tip tip="event.choice" />
            <div class="choices" role="group" [attr.aria-label]="'ui.event.choices' | t">
              @for (c of e.choices; track $index) {
                <button
                  class="o-choice o-px--paper"
                  type="button"
                  [disabled]="busy()"
                  (click)="choose($index)"
                >
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
      min-height: 320px;
    }
    .headline {
      font-size: clamp(40px, 11.6vw, 46px);
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
    /* Esito come ritaglio dell'edizione successiva: leggermente storto, come appoggiato. */
    .clipping {
      transform: rotate(1deg);
      margin: 4px 6px 8px 2px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .clip-title {
      margin: 0;
      font-family: var(--o-font-display);
      font-weight: 800;
      font-size: 24px;
      line-height: 1.05;
      color: var(--o-ink);
    }
    .effects {
      margin: 0;
      border-top: 3px double var(--o-ink);
    }
    .effect {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 0;
      border-bottom: 1px solid var(--o-paper-rule);
    }
    .effect dt {
      font-size: 15px;
      color: var(--o-ink-soft);
    }
    .effect dd {
      margin: 0;
      font-size: 24px;
      line-height: 1;
      color: var(--o-ink);
      white-space: nowrap;
    }
    .effect.pos dd {
      color: var(--o-ink-pos);
    }
    .effect.neg dd {
      color: var(--o-ink-neg);
    }
    /* Senza valore il colore va sull'etichetta, unico segnale di bene o male. */
    .effect.pos dt:only-child {
      color: var(--o-ink-pos);
      font-weight: 600;
    }
    .effect.neg dt:only-child {
      color: var(--o-ink-neg);
      font-weight: 600;
    }
    .quiet {
      margin: 0;
      font-size: 14px;
      color: var(--o-ink-muted);
    }
    .o-px--paper .o-choice__letter {
      color: var(--o-headline-red);
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
            label: t('ui.statPath.' + c.path),
            value: amount,
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
            label: t('ui.event.change.relationship', { name: who }),
            value: formatDelta(d),
            tone: d > 0 ? 'pos' : 'neg',
          });
          break;
        }
        case 'injury':
          lines.push({
            label: t('ui.event.change.injury', {
              injury: t('injuries.' + c.injuryType),
              weeks: c.weeks,
            }),
            tone: 'neg',
          });
          break;
        case 'trait':
          lines.push({
            label: t(
              c.action === 'add' ? 'ui.event.change.traitAdd' : 'ui.event.change.traitRemove',
              {
                trait: t('traits.' + c.traitId + '.name'),
              },
            ),
            tone: 'none',
          });
          break;
        case 'transferRequest':
          lines.push({ label: t('ui.event.change.transferRequest'), tone: 'none' });
          break;
        case 'partner': {
          const d = c.after - c.before;
          if (Math.abs(d) < 0.5) break;
          lines.push({
            label: t('ui.event.change.partner', { name: c.name }),
            value: formatDelta(d),
            tone: d > 0 ? 'pos' : 'neg',
          });
          break;
        }
        case 'meet':
          lines.push({ label: t('ui.event.change.meet', { name: c.name }), tone: 'pos' });
          break;
        case 'affair':
          lines.push({
            label: t(
              c.action === 'start' ? 'ui.event.change.affairStart' : 'ui.event.change.affairEnd',
            ),
            tone: 'none',
          });
          break;
        case 'breakup':
          lines.push({ label: t('ui.event.change.breakup', { name: c.name }), tone: 'neg' });
          if (c.settlement > 0) {
            lines.push({
              label: t('ui.event.change.settlement', {
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
            label: t('ui.event.change.business', { name: c.name }),
            value: formatDelta(d),
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
