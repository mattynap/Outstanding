import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronBack, shuffleOutline } from 'ionicons/icons';
import {
  DIFFICULTIES,
  ROLES,
  completeAppearance,
  type Appearance,
  type Difficulty,
  type Interest,
  INTERESTS,
  type Role,
} from '@outstanding/engine';
import { GameService } from '../core/game.service';
import { I18nService, TranslatePipe } from '../core/i18n.service';
import { ToastService } from '../core/toast.service';
import { TutorialService } from '../core/tutorial.service';
import { AvatarComponent } from '../ui/avatar.component';
import { LookEditorComponent } from '../ui/look-editor.component';

/** Creazione del giocatore: nome, città, ruolo, tratti, livello di partenza e aspetto. */
@Component({
  selector: 'app-create',
  imports: [IonContent, IonIcon, RouterLink, TranslatePipe, AvatarComponent, LookEditorComponent],
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
          <div class="mirror">
            <app-avatar [appearance]="appearance()" [size]="132" [label]="'ui.create.look' | t" />
            <button class="o-chip" type="button" (click)="randomLook()">
              <ion-icon name="shuffle-outline" aria-hidden="true"></ion-icon
              >{{ 'ui.create.random' | t }}
            </button>
          </div>
          <app-look-editor
            class="editor"
            [value]="appearance()"
            (changed)="appearance.set($event)"
          />
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
              [value]="hometown()"
              (input)="hometown.set(value($event))"
              (focus)="cityFocus.set(true)"
              (blur)="cityFocus.set(false)"
              autocomplete="off"
              autocorrect="off"
              spellcheck="false"
            />
            @if (citySuggestions().length > 0) {
              <!-- mousedown.preventDefault: il tocco non toglie il focus prima della scelta -->
              <ul class="suggest o-px" role="listbox">
                @for (c of citySuggestions(); track c) {
                  <li>
                    <button
                      type="button"
                      role="option"
                      (mousedown)="$event.preventDefault()"
                      (click)="pickCity(c)"
                    >
                      {{ c }}
                    </button>
                  </li>
                }
              </ul>
            } @else if (hometown() && !cityValid() && !cityFocus()) {
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

        <section class="o-card">
          <h2 class="o-section-title">{{ 'ui.create.difficulty' | t }}</h2>
          <div class="levels" role="radiogroup" [attr.aria-label]="'ui.create.difficulty' | t">
            @for (d of difficulties; track d) {
              <button
                class="o-choice level"
                type="button"
                role="radio"
                [attr.aria-checked]="difficulty() === d"
                [attr.aria-pressed]="difficulty() === d"
                (click)="difficulty.set(d)"
              >
                <span class="pips" aria-hidden="true">
                  @for (i of [0, 1, 2]; track i) {
                    <span class="pip" [class.on]="i <= difficulties.indexOf(d)"></span>
                  }
                </span>
                <span class="o-choice__body">
                  <span>{{ 'difficulty.' + d + '.name' | t }}</span>
                  <span class="o-choice__hint">{{ 'difficulty.' + d + '.hint' | t }}</span>
                </span>
              </button>
            }
          </div>
        </section>

        <section class="o-card">
          <h2 class="o-section-title">{{ 'ui.create.interest' | t }}</h2>
          <p class="hint">{{ 'ui.create.interestHint' | t }}</p>
          <div
            class="o-row interest"
            role="radiogroup"
            [attr.aria-label]="'ui.create.interest' | t"
          >
            @for (i of interests; track i) {
              <button
                class="o-chip"
                type="button"
                role="radio"
                [class.o-chip--accent]="interest() === i"
                [attr.aria-checked]="interest() === i"
                (click)="interest.set(i)"
              >
                {{ 'ui.interest.' + i | t }}
              </button>
            }
          </div>
        </section>

        <section class="o-card guide">
          <button
            class="o-choice"
            type="button"
            role="switch"
            [attr.aria-checked]="guided()"
            [attr.aria-pressed]="guided()"
            (click)="guided.set(!guided())"
          >
            <span class="o-choice__body">
              <span>{{ 'ui.create.guided' | t }}</span>
              <span class="o-choice__hint">{{ 'ui.create.guidedHint' | t }}</span>
            </span>
            <span class="toggle" [class.on]="guided()" aria-hidden="true"><span></span></span>
          </button>
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
      gap: var(--o-space-4);
    }
    .mirror {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
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
    .suggest {
      list-style: none;
      margin: 6px 0 0;
      padding: 4px;
      --px-d: var(--o-px);
      background: var(--o-surface-raised);
    }
    .suggest button {
      width: 100%;
      min-height: var(--o-touch);
      padding: 0 var(--o-space-3);
      border: 0;
      border-radius: 0;
      background: transparent;
      color: var(--o-text);
      font: inherit;
      text-align: left;
    }
    .suggest button:active {
      background: var(--o-accent-soft);
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
    .levels {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .level {
      flex-direction: row;
      align-items: center;
      gap: 14px;
    }
    .hint {
      margin: 0;
      font-size: 13px;
      color: var(--o-text-soft);
    }
    .interest {
      flex-wrap: wrap;
      gap: 8px;
    }
    .pips {
      display: flex;
      align-items: flex-end;
      gap: 3px;
      flex: 0 0 auto;
    }
    .pip {
      width: 6px;
      background: var(--o-border-strong);
    }
    .pip:nth-child(1) {
      height: 10px;
    }
    .pip:nth-child(2) {
      height: 16px;
    }
    .pip:nth-child(3) {
      height: 22px;
    }
    .pip.on {
      background: var(--o-accent);
    }
    .guide .o-choice {
      flex-direction: row;
      align-items: center;
      gap: 12px;
    }
    .toggle {
      flex: 0 0 auto;
      width: 44px;
      height: 26px;
      padding: 3px;
      background: var(--o-border-strong);
      transition: background var(--o-fast) steps(2, end);
    }
    /* Interruttore a blocchi: cursore quadrato che scatta, come un selettore da cabinato. */
    .toggle span {
      display: block;
      width: 20px;
      height: 20px;
      background: var(--o-text);
      transition: transform var(--o-fast) steps(3, end);
    }
    .toggle.on {
      background: var(--o-accent);
    }
    .toggle.on span {
      transform: translateX(18px);
      background: var(--o-accent-ink);
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
  protected readonly difficulties = DIFFICULTIES;
  private readonly tutorial = inject(TutorialService);
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
  protected readonly appearance = signal<Appearance>(completeAppearance({}));
  protected readonly busy = signal(false);
  protected readonly difficulty = signal<Difficulty>(this.game.ctx.config.difficulty.default);
  protected readonly interests = INTERESTS;
  protected readonly interest = signal<Interest>(this.game.ctx.config.private.defaultInterest);
  /** Settimana guidata: proposta in automatico se non c'è ancora nessuna carriera salvata. */
  protected readonly guided = signal(this.game.slots().every((v) => v.summary === null));

  protected readonly availableTraits = computed(() =>
    this.content.traits.filter(
      (t) => t.selectableAtCreation && (!t.roles || t.roles.includes(this.role())),
    ),
  );
  protected readonly cityFocus = signal(false);
  /** Nome ufficiale della città scritta, ignorando maiuscole e accenti; null se non esiste. */
  private readonly canonicalCity = computed(() => {
    const wanted = norm(this.hometown());
    return this.cities.find((c) => norm(c) === wanted) ?? null;
  });
  protected readonly cityValid = computed(() => this.canonicalCity() !== null);
  /** Suggerimenti: prima le città che iniziano col testo, poi quelle che lo contengono. */
  protected readonly citySuggestions = computed(() => {
    const q = norm(this.hometown());
    if (!this.cityFocus() || q.length === 0 || this.cityValid()) return [];
    const starts = this.cities.filter((c) => norm(c).startsWith(q));
    const contains = this.cities.filter((c) => !norm(c).startsWith(q) && norm(c).includes(q));
    return [...starts, ...contains].slice(0, 6);
  });
  protected readonly valid = computed(
    () =>
      this.firstName().trim().length > 0 && this.lastName().trim().length > 0 && this.cityValid(),
  );

  constructor() {
    addIcons({ chevronBack, shuffleOutline });
    this.randomName();
    this.randomLook();
  }

  protected pickCity(c: string): void {
    this.hometown.set(c);
  }

  protected value(e: Event): string {
    return (e.target as HTMLInputElement).value;
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

  protected randomLook(): void {
    const a = this.content.avatar;
    this.appearance.update((cur) => ({
      ...cur,
      skin: randInt(a.skinTones.length),
      hairColor: randInt(a.hairColors.length),
      hairStyle: randInt(a.hairStyles.length),
      face: randInt(a.faceShapes.length),
      beard: randInt(a.beards.length),
      body: randInt(a.bodies.length),
      eyes: randInt(a.eyeShapes.length),
      eyeColor: randInt(a.eyeColors.length),
      brows: randInt(a.brows.length),
      nose: randInt(a.noses.length),
    }));
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
          hometown: this.canonicalCity() ?? this.hometown(),
          role: this.role(),
          traits: this.traits(),
          startLevel: this.startLevel(),
          appearance: this.appearance(),
          difficulty: this.difficulty(),
          interest: this.interest(),
        },
        seed,
        this.targetSlot()!,
      );
      if (this.guided()) await this.tutorial.start(this.targetSlot()!);
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
/** Testo confrontabile: minuscolo, senza accenti e spazi doppi. */
const norm = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('it')
    .replace(/\s+/g, ' ')
    .trim();

const pick = <T>(items: readonly T[]): T => items[randInt(items.length)]!;
