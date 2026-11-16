import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronBack, chevronForward, shuffleOutline } from 'ionicons/icons';
import { ROLES, type Appearance, type Role } from '@outstanding/engine';
import { GameService } from '../core/game.service';
import { I18nService, TranslatePipe } from '../core/i18n.service';
import { ToastService } from '../core/toast.service';
import { AvatarComponent } from '../ui/avatar.component';

type Part = keyof Appearance;

/** Creazione del giocatore: nome, città, ruolo, tratti, livello di partenza e aspetto. */
@Component({
  selector: 'app-create',
  imports: [IonContent, IonIcon, RouterLink, TranslatePipe, AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-content class="o-page">
      <main class="o-wrap o-enter">
        <header class="top">
          <a class="o-icon-btn" routerLink="/" [attr.aria-label]="'ui.common.back' | t">
            <ion-icon name="chevron-back" aria-hidden="true"></ion-icon>
          </a>
          <span class="o-label">{{ 'ui.create.kicker' | t }}</span>
          <span class="spacer"></span>
        </header>
        <h1 class="o-display title">{{ 'ui.create.title' | t }}</h1>

        <section class="o-card look" [attr.aria-label]="'ui.create.look' | t">
          <app-avatar [appearance]="appearance()" [size]="120" [label]="'ui.create.look' | t" />
          <div class="parts">
            @for (p of parts; track p.part) {
              <div class="part">
                <button
                  class="o-icon-btn"
                  type="button"
                  (click)="cycle(p.part, -1)"
                  [attr.aria-label]="('ui.create.prev' | t) + ' ' + (p.label | t)"
                >
                  <ion-icon name="chevron-back" aria-hidden="true"></ion-icon>
                </button>
                <span class="part-label">
                  <span class="o-label">{{ p.label | t }}</span>
                  @if (partColor(p.part); as color) {
                    <span class="swatch" [style.background]="color"></span>
                  } @else {
                    <span>{{ partValue(p.part) }}</span>
                  }
                </span>
                <button
                  class="o-icon-btn"
                  type="button"
                  (click)="cycle(p.part, 1)"
                  [attr.aria-label]="('ui.create.next' | t) + ' ' + (p.label | t)"
                >
                  <ion-icon name="chevron-forward" aria-hidden="true"></ion-icon>
                </button>
              </div>
            }
          </div>
        </section>

        <section class="o-card">
          <div class="o-section-head">
            <h2 class="o-section-title">{{ 'ui.create.identity' | t }}</h2>
            <button class="o-chip" type="button" (click)="randomName()">
              <ion-icon name="shuffle-outline" aria-hidden="true"></ion-icon
              >{{ 'ui.create.random' | t }}
            </button>
          </div>
          <label class="o-field">
            <span class="o-label">{{ 'ui.create.firstName' | t }}</span>
            <input
              class="o-input"
              [value]="firstName()"
              (input)="firstName.set(value($event))"
              maxlength="20"
              autocomplete="off"
            />
          </label>
          <label class="o-field">
            <span class="o-label">{{ 'ui.create.lastName' | t }}</span>
            <input
              class="o-input"
              [value]="lastName()"
              (input)="lastName.set(value($event))"
              maxlength="20"
              autocomplete="off"
            />
          </label>
          <label class="o-field">
            <span class="o-label">{{ 'ui.create.hometown' | t }}</span>
            <input
              class="o-input"
              list="cities"
              [value]="hometown()"
              (input)="hometown.set(value($event))"
              autocomplete="off"
            />
            <datalist id="cities">
              @for (c of cities; track c) {
                <option [value]="c"></option>
              }
            </datalist>
            @if (hometown() && !cityValid()) {
              <span class="error">{{ 'ui.create.unknownCity' | t }}</span>
            }
          </label>
        </section>

        <section class="o-card">
          <h2 class="o-section-title">{{ 'ui.create.role' | t }}</h2>
          <div class="grid2" role="radiogroup" [attr.aria-label]="'ui.create.role' | t">
            @for (r of roles; track r) {
              <button
                class="o-choice role"
                type="button"
                role="radio"
                [attr.aria-checked]="role() === r"
                [attr.aria-pressed]="role() === r"
                (click)="setRole(r)"
              >
                <span class="o-choice__body">
                  <span>{{ 'roles.' + r | t }}</span>
                  <span class="o-choice__hint">{{ 'ui.create.roleHint.' + r | t }}</span>
                </span>
              </button>
            }
          </div>
        </section>

        <section class="o-card">
          <div class="o-section-head">
            <h2 class="o-section-title">{{ 'ui.create.traits' | t }}</h2>
            <span class="o-muted small">{{
              'ui.create.traitsCount' | t: { n: traits().length, max: maxTraits }
            }}</span>
          </div>
          <div class="traits">
            @for (tr of availableTraits(); track tr.id) {
              <button
                class="o-choice"
                type="button"
                [attr.aria-pressed]="traits().includes(tr.id)"
                (click)="toggleTrait(tr.id)"
                [disabled]="!traits().includes(tr.id) && traits().length >= maxTraits"
              >
                <span class="o-choice__body">
                  <span>{{ 'traits.' + tr.id + '.name' | t }}</span>
                  <span class="o-choice__hint">{{ 'traits.' + tr.id + '.desc' | t }}</span>
                </span>
              </button>
            }
          </div>
        </section>

        <section class="o-card">
          <h2 class="o-section-title">{{ 'ui.create.startLevel' | t }}</h2>
          <div class="grid2" role="radiogroup" [attr.aria-label]="'ui.create.startLevel' | t">
            @for (l of startLevels; track l) {
              <button
                class="o-choice"
                type="button"
                role="radio"
                [attr.aria-checked]="startLevel() === l"
                [attr.aria-pressed]="startLevel() === l"
                (click)="startLevel.set(l)"
              >
                <span class="o-choice__body">
                  <span>{{ 'leagues.' + l + '.name' | t }}</span>
                  <span class="o-choice__hint">{{ 'ui.create.levelHint.' + l | t }}</span>
                </span>
              </button>
            }
          </div>
        </section>

        @if (targetSlot() === null) {
          <p class="warning">{{ 'ui.create.noSlot' | t }}</p>
        } @else if (overwrites()) {
          <p class="warning">{{ 'ui.create.overwrite' | t: { slot: targetSlot()! } }}</p>
        } @else {
          <p class="o-muted slot-note">{{ 'ui.create.slot' | t: { slot: targetSlot()! } }}</p>
        }
        <button
          class="o-btn"
          type="button"
          [disabled]="!valid() || busy() || targetSlot() === null"
          (click)="start()"
        >
          {{ 'ui.create.start' | t }}
        </button>
      </main>
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
      font-size: 40px;
    }
    .look {
      flex-direction: row;
      align-items: center;
      gap: var(--o-space-4);
    }
    .parts {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }
    .part {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .part .o-icon-btn {
      width: 36px;
      height: 36px;
    }
    .part-label {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      font-size: 13px;
      font-weight: 600;
      min-width: 0;
    }
    .part-label .o-label {
      font-size: 10px;
    }
    .swatch {
      width: 18px;
      height: 18px;
      border-radius: 50%;
    }
    .grid2 {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .role {
      min-height: 64px;
    }
    .traits {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .small {
      font-size: var(--o-text-sm);
    }
    .error {
      font-size: var(--o-text-sm);
      color: var(--o-negative);
    }
    .slot-note {
      margin: 0;
      font-size: 13px;
      text-align: center;
    }
    .warning {
      margin: 0;
      font-size: 13px;
      color: var(--o-accent-text);
      text-align: center;
    }
  `,
})
export class CreatePage {
  private readonly game = inject(GameService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly content = this.game.ctx.content;

  protected readonly roles = ROLES;
  protected readonly cities = this.content.cities
    .map((c) => c.name)
    .sort((a, b) => a.localeCompare(b, 'it'));
  protected readonly startLevels = [...this.game.ctx.config.world.startLevels].sort(
    (a, b) => b - a,
  );
  protected readonly maxTraits = this.game.ctx.config.player.maxTraitsAtCreation;
  private readonly route = inject(ActivatedRoute);
  /** Slot di destinazione: quello richiesto, altrimenti il primo libero, altrimenti quello attuale. */
  protected readonly targetSlot = computed(() => {
    const asked = Number(this.route.snapshot.queryParamMap.get('slot'));
    if (Number.isInteger(asked) && this.game.slots().some((v) => v.slot === asked)) return asked;
    return this.game.freeSlot() ?? this.game.slot();
  });
  protected readonly overwrites = computed(() => {
    const slot = this.targetSlot();
    return this.game.slots().some((v) => v.slot === slot && v.summary !== null);
  });

  protected readonly firstName = signal('');
  protected readonly lastName = signal('');
  protected readonly hometown = signal('');
  protected readonly role = signal<Role>('ATT');
  protected readonly traits = signal<string[]>([]);
  protected readonly startLevel = signal(this.game.ctx.config.world.defaultStartLevel);
  protected readonly appearance = signal<Appearance>({
    skin: 1,
    hairColor: 1,
    hairStyle: 0,
    face: 0,
    beard: 0,
  });
  protected readonly busy = signal(false);

  protected readonly parts: { part: Part; label: string }[] = [
    { part: 'skin', label: 'ui.create.parts.skin' },
    { part: 'hairStyle', label: 'ui.create.parts.hairStyle' },
    { part: 'hairColor', label: 'ui.create.parts.hairColor' },
    { part: 'face', label: 'ui.create.parts.face' },
    { part: 'beard', label: 'ui.create.parts.beard' },
  ];

  protected readonly availableTraits = computed(() =>
    this.content.traits.filter(
      (t) => t.selectableAtCreation && (!t.roles || t.roles.includes(this.role())),
    ),
  );
  protected readonly cityValid = computed(() => {
    const wanted = this.hometown().trim().toLocaleLowerCase('it');
    return this.cities.some((c) => c.toLocaleLowerCase('it') === wanted);
  });
  protected readonly valid = computed(
    () =>
      this.firstName().trim().length > 0 && this.lastName().trim().length > 0 && this.cityValid(),
  );

  constructor() {
    addIcons({ chevronBack, chevronForward, shuffleOutline });
    this.randomName();
    this.randomLook();
  }

  protected value(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  private sizes(): Record<Part, number> {
    const a = this.content.avatar;
    return {
      skin: a.skinTones.length,
      hairColor: a.hairColors.length,
      hairStyle: a.hairStyles.length,
      face: a.faceShapes.length,
      beard: a.beards.length,
    };
  }

  protected cycle(part: Part, step: number): void {
    const n = this.sizes()[part];
    this.appearance.update((a) => ({ ...a, [part]: (a[part] + step + n) % n }));
  }

  protected partColor(part: Part): string | null {
    const a = this.content.avatar;
    const i = this.appearance()[part];
    if (part === 'skin') return a.skinTones[i] ?? null;
    if (part === 'hairColor') return a.hairColors[i] ?? null;
    return null;
  }

  protected partValue(part: Part): string {
    const a = this.content.avatar;
    const i = this.appearance()[part];
    switch (part) {
      case 'hairStyle':
        return this.i18n.t(`avatar.hairStyles.${a.hairStyles[i]}`);
      case 'face':
        return this.i18n.t(`avatar.faceShapes.${a.faceShapes[i]}`);
      case 'beard':
        return this.i18n.t(`avatar.beards.${a.beards[i]}`);
      default:
        return `${i + 1} / ${this.sizes()[part]}`;
    }
  }

  protected setRole(r: Role): void {
    this.role.set(r);
    // I tratti non adatti al nuovo ruolo si tolgono.
    const ok = new Set(this.availableTraits().map((t) => t.id));
    this.traits.update((list) => list.filter((id) => ok.has(id)));
  }

  protected toggleTrait(id: string): void {
    this.traits.update((list) =>
      list.includes(id) ? list.filter((x) => x !== id) : [...list, id].slice(0, this.maxTraits),
    );
  }

  protected randomName(): void {
    const names = this.content.names;
    this.firstName.set(pick(names.firstNames));
    this.lastName.set(pick(names.lastNames));
    if (!this.hometown()) this.hometown.set(pick(this.cities));
  }

  private randomLook(): void {
    const s = this.sizes();
    this.appearance.set({
      skin: randInt(s.skin),
      hairColor: randInt(s.hairColor),
      hairStyle: randInt(s.hairStyle),
      face: randInt(s.face),
      beard: randInt(s.beard),
    });
  }

  protected async start(): Promise<void> {
    if (!this.valid() || this.busy()) return;
    this.busy.set(true);
    try {
      const seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
      await this.game.newGame(
        {
          firstName: this.firstName(),
          lastName: this.lastName(),
          hometown: this.hometown(),
          role: this.role(),
          traits: this.traits(),
          startLevel: this.startLevel(),
          appearance: this.appearance(),
        },
        seed,
        this.targetSlot()!,
      );
      await this.router.navigateByUrl('/settimana', { replaceUrl: true });
    } catch {
      await this.toast.show(this.i18n.t('ui.common.error'), 'error');
    } finally {
      this.busy.set(false);
    }
  }
}

// Fuori dal motore il caso non deve essere riproducibile: qui basta Math.random.
const randInt = (n: number) => Math.floor(Math.random() * n);
const pick = <T>(items: readonly T[]): T => items[randInt(items.length)]!;
