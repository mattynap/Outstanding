import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronBack, chevronForward, lockClosed } from 'ionicons/icons';
import type { Tattoo, TattooZone } from '@outstanding/content';
import {
  APPEARANCE_LISTS,
  appearanceSizes,
  FIXED_PARTS,
  TATTOO_ZONES,
  tattooUnlocked,
  type Appearance,
  type AppearancePart,
  type GameState,
} from '@outstanding/engine';
import { GameService } from '../core/game.service';
import { I18nService, TranslatePipe } from '../core/i18n.service';

type Group = 'body' | 'face' | 'hair' | 'extras' | 'tattoos';

const GROUPS: { id: Group; parts: AppearancePart[] }[] = [
  { id: 'body', parts: ['skin', 'body'] },
  { id: 'face', parts: ['face', 'eyes', 'eyeColor', 'nose', 'brows', 'beard'] },
  { id: 'hair', parts: ['hairStyle', 'hairColor'] },
  { id: 'extras', parts: ['earring', 'necklace', 'headband'] },
  { id: 'tattoos', parts: [] },
];
const COLOR_PARTS = new Set<AppearancePart>(['skin', 'hairColor', 'eyeColor']);

/**
 * Editor dell'aspetto diviso per gruppi (corpo, viso, capelli, accessori, tatuaggi). Alla
 * creazione tutto si sceglie; in carriera (`state` presente) le parti fisse spariscono e i
 * tatuaggi bloccati mostrano come si sbloccano.
 */
@Component({
  selector: 'app-look-editor',
  imports: [IonIcon, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tabs" role="tablist" [attr.aria-label]="'ui.look.title' | t">
      @for (g of groups(); track g.id) {
        <button
          class="o-chip"
          type="button"
          role="tab"
          [class.o-chip--accent]="active() === g.id"
          [attr.aria-selected]="active() === g.id"
          (click)="group.set(g.id)"
        >
          {{ 'ui.look.groups.' + g.id | t }}
        </button>
      }
    </div>

    @if (active() === 'tattoos') {
      <div class="zones">
        <div class="zone-tabs" role="tablist" [attr.aria-label]="'ui.look.groups.tattoos' | t">
          @for (z of zones; track z) {
            <button
              class="zone-tab"
              type="button"
              role="tab"
              [class.on]="zone() === z"
              [attr.aria-selected]="zone() === z"
              (click)="zone.set(z)"
            >
              <span>{{ 'avatar.zones.' + z | t }}</span>
              <span class="worn">{{
                value().tattoos[z] ? ('avatar.tattoos.' + value().tattoos[z] | t) : '—'
              }}</span>
            </button>
          }
        </div>
        <div class="tats" role="radiogroup" [attr.aria-label]="'avatar.zones.' + zone() | t">
          <button
            class="o-chip"
            type="button"
            role="radio"
            [class.o-chip--accent]="!value().tattoos[zone()]"
            [attr.aria-checked]="!value().tattoos[zone()]"
            (click)="setTattoo(zone(), null)"
          >
            {{ 'ui.look.noTattoo' | t }}
          </button>
          @for (tt of openFor(zone()); track tt.id) {
            <button
              class="o-chip"
              type="button"
              role="radio"
              [class.o-chip--accent]="value().tattoos[zone()] === tt.id"
              [attr.aria-checked]="value().tattoos[zone()] === tt.id"
              (click)="setTattoo(zone(), tt.id)"
            >
              {{ 'avatar.tattoos.' + tt.id | t }}
            </button>
          }
        </div>
        @if (lockedFor(zone()).length > 0) {
          <div class="locks">
            <span class="o-label">{{
              (state() ? 'ui.look.lockedCareer' : 'ui.look.lockedCreate') | t
            }}</span>
            <ul>
              @for (tt of lockedFor(zone()); track tt.id) {
                <li>
                  <ion-icon name="lock-closed" aria-hidden="true"></ion-icon>
                  <b>{{ 'avatar.tattoos.' + tt.id | t }}</b>
                  <span>{{ unlockText(tt) }}</span>
                </li>
              }
            </ul>
          </div>
        }
      </div>
    } @else {
      <div class="parts">
        @for (p of currentParts(); track p) {
          <div class="part">
            <button
              class="o-icon-btn"
              type="button"
              (click)="cycle(p, -1)"
              [attr.aria-label]="('ui.create.prev' | t) + ' ' + ('ui.look.parts.' + p | t)"
            >
              <ion-icon name="chevron-back" aria-hidden="true"></ion-icon>
            </button>
            <span class="part-label">
              <span class="o-label">{{ 'ui.look.parts.' + p | t }}</span>
              @if (color(p); as c) {
                <span class="swatch" [style.background]="c"></span>
              } @else {
                <span>{{ text(p) }}</span>
              }
            </span>
            <button
              class="o-icon-btn"
              type="button"
              (click)="cycle(p, 1)"
              [attr.aria-label]="('ui.create.next' | t) + ' ' + ('ui.look.parts.' + p | t)"
            >
              <ion-icon name="chevron-forward" aria-hidden="true"></ion-icon>
            </button>
          </div>
        }
        @if (active() === 'extras') {
          <button
            class="o-choice ageing"
            type="button"
            role="switch"
            [attr.aria-checked]="value().ageing"
            [attr.aria-pressed]="value().ageing"
            (click)="emit({ ageing: !value().ageing })"
          >
            <span class="o-choice__body">
              <span>{{ 'ui.look.ageing' | t }}</span>
              <span class="o-choice__hint">{{ 'ui.look.ageingHint' | t: { age: greyFrom } }}</span>
            </span>
            <span class="toggle" [class.on]="value().ageing" aria-hidden="true"><span></span></span>
          </button>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
    }
    .tabs {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      scrollbar-width: none;
      padding-bottom: 2px;
    }
    .tabs .o-chip {
      flex: 0 0 auto;
    }
    .parts {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .part {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .part .o-icon-btn {
      width: 40px;
      height: 40px;
    }
    .part-label {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      font-size: 14px;
      font-weight: 600;
      min-width: 0;
      text-align: center;
    }
    .part-label .o-label {
      font-size: 10px;
    }
    .swatch {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      box-shadow: 0 0 0 2px var(--o-border-strong);
    }
    .zones {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .zone-tabs {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 6px;
    }
    .zone-tab {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-height: var(--o-touch);
      padding: 8px 10px;
      border: 1px solid var(--o-border);
      border-radius: var(--o-radius-sm);
      background: transparent;
      color: var(--o-text-soft);
      font: inherit;
      font-size: 12px;
      text-align: left;
      cursor: pointer;
    }
    .zone-tab.on {
      border-color: var(--o-accent);
      color: var(--o-text);
    }
    .worn {
      font-family: var(--o-font-display);
      font-weight: 700;
      font-size: 15px;
      text-transform: uppercase;
      color: var(--o-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tats {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .locks {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-top: 10px;
      border-top: 1px dashed var(--o-border);
    }
    .locks ul {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12.5px;
      color: var(--o-text-muted);
    }
    .locks li {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .locks ion-icon {
      font-size: 12px;
      flex: 0 0 auto;
    }
    .locks b {
      color: var(--o-text-soft);
      font-weight: 600;
    }
    .ageing {
      flex-direction: row;
      align-items: center;
      gap: 12px;
      margin-top: 4px;
    }
    .toggle {
      flex: 0 0 auto;
      width: 44px;
      height: 26px;
      padding: 3px;
      border-radius: 13px;
      background: var(--o-border-strong);
      transition: background var(--o-fast) var(--o-ease);
    }
    .toggle span {
      display: block;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--o-text);
      transition: transform var(--o-fast) var(--o-ease);
    }
    .toggle.on {
      background: var(--o-accent);
    }
    .toggle.on span {
      transform: translateX(18px);
      background: var(--o-accent-ink);
    }
  `,
})
export class LookEditorComponent {
  readonly value = input.required<Appearance>();
  /** Carriera in corso: nasconde le parti fisse e sblocca i tatuaggi secondo i traguardi. */
  readonly state = input<GameState | null>(null);
  readonly changed = output<Appearance>();

  private readonly game = inject(GameService);
  private readonly i18n = inject(I18nService);
  private readonly ctx = this.game.ctx;
  private readonly avatar = this.ctx.content.avatar;
  private readonly sizes = appearanceSizes(this.ctx);

  protected readonly zones: readonly TattooZone[] = TATTOO_ZONES;
  protected readonly greyFrom = this.avatar.ageing.greyFromAge;
  protected readonly group = signal<Group>('body');

  protected readonly groups = computed(() => {
    const career = this.state() !== null;
    return GROUPS.filter(
      (g) =>
        g.id === 'tattoos' ||
        g.id === 'extras' ||
        g.parts.some((p) => !career || !FIXED_PARTS.includes(p)),
    );
  });

  /** Gruppo mostrato: quello scelto, o il primo disponibile se in carriera non esiste. */
  protected readonly active = computed<Group>(() =>
    this.groups().some((g) => g.id === this.group()) ? this.group() : this.groups()[0]!.id,
  );

  protected readonly currentParts = computed(() => {
    const career = this.state() !== null;
    const g = GROUPS.find((x) => x.id === this.active())!;
    return g.parts.filter((p) => !career || !FIXED_PARTS.includes(p));
  });

  protected readonly zone = signal<TattooZone>('armRight');

  constructor() {
    addIcons({ chevronBack, chevronForward, lockClosed });
  }

  /** Tatuaggi possibili nella zona: sbloccati, o già fatti. */
  protected openFor(zone: TattooZone): Tattoo[] {
    return this.avatar.tattoos.filter(
      (tt) => tt.zones.includes(zone) && (this.open(tt) || this.value().tattoos[zone] === tt.id),
    );
  }

  protected lockedFor(zone: TattooZone): Tattoo[] {
    return this.avatar.tattoos.filter(
      (tt) => tt.zones.includes(zone) && !this.open(tt) && this.value().tattoos[zone] !== tt.id,
    );
  }

  protected open(tt: Tattoo): boolean {
    return tattooUnlocked(tt, this.state(), this.ctx);
  }

  protected unlockText(tt: Tattoo): string {
    const u = tt.unlock;
    if (!u) return '';
    if (u.type === 'topLevel') {
      return this.i18n.t('avatar.unlock.topLevel', { league: this.i18n.t('leagues.1.name') });
    }
    return this.i18n.t(`avatar.unlock.${u.type}`, { min: 'min' in u ? u.min : 0 });
  }

  protected color(p: AppearancePart): string | null {
    if (!COLOR_PARTS.has(p)) return null;
    const list = this.avatar[APPEARANCE_LISTS[p]] as readonly string[];
    return list[this.value()[p]] ?? null;
  }

  protected text(p: AppearancePart): string {
    const list = APPEARANCE_LISTS[p];
    const id = (this.avatar[list] as readonly string[])[this.value()[p]] ?? '';
    return this.i18n.t(`avatar.${list}.${id}`);
  }

  protected cycle(p: AppearancePart, step: number): void {
    const n = this.sizes[p];
    this.emit({ [p]: (this.value()[p] + step + n) % n });
  }

  protected setTattoo(zone: TattooZone, id: string | null): void {
    const tattoos = { ...this.value().tattoos };
    if (id) tattoos[zone] = id;
    else delete tattoos[zone];
    this.emit({ tattoos });
  }

  protected emit(changes: Partial<Appearance>): void {
    this.changed.emit({ ...this.value(), ...changes });
  }
}
