import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { AlertController, IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronBack } from 'ionicons/icons';
import {
  clubLook,
  editCount,
  KIT_PATTERNS,
  levelOfClub,
  worldPeople,
  type ClubBase,
  type ClubLook,
  type Crest,
  type ForeignClub,
  type Kit,
  type PersonRef,
} from '@outstanding/engine';
import { trophyKey } from '../core/career-view';
import { EditsFileError } from '../core/editor/edits-file';
import { deliverTextFile } from '../core/editor/file-transfer';
import { GameService } from '../core/game.service';
import { I18nService, TranslatePipe } from '../core/i18n.service';
import { ToastService } from '../core/toast.service';
import { CrestComponent } from '../ui/crest.component';
import { KitComponent } from '../ui/kit.component';

type Tab = 'clubs' | 'people' | 'competitions' | 'file';
type ClubFilter = number | 'foreign';
type PeopleScope = 'team' | 'coach' | 'agent';

const TABS: readonly Tab[] = ['clubs', 'people', 'competitions', 'file'];
const SCOPES: readonly PeopleScope[] = ['team', 'coach', 'agent'];
/** Caratteri minimi per cercare e risultati massimi mostrati. */
const MIN_QUERY = 2;
const MAX_RESULTS = 40;

const norm = (s: string) => s.toLocaleLowerCase('it').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Iniziali proposte da un nome: prima lettera delle prime parole. */
function initialsOf(name: string, max: number): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0))
    .join('')
    .slice(0, max)
    .toUpperCase();
}

interface ClubRow {
  id: string;
  name: string;
  sub: string;
  crest: Crest;
  /** Nome generato in origine, se il nome è cambiato. */
  was: string | null;
  /** Vero se il club ha una qualunque modifica (anche solo i colori). */
  edited: boolean;
}

interface PersonRow extends PersonRef {
  sub: string;
  was: string | null;
}

/**
 * Editor ("Redazione"): nomi e colori dei club, nomi di calciatori, allenatori e procuratori, nomi
 * di campionati e coppe, esportazione e importazione delle modifiche. Le correzioni appaiono come
 * su una bozza: il nome originale barrato sopra quello nuovo.
 */
@Component({
  selector: 'app-editor',
  imports: [IonContent, IonIcon, TranslatePipe, CrestComponent, KitComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-content class="o-page">
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
          <h1 class="o-display title">{{ 'ui.editor.title' | t }}</h1>
          @if (count() > 0) {
            <span class="o-chip o-chip--accent count">{{
              'ui.editor.count' | t: { n: count() }
            }}</span>
          }
        </header>

        <article class="o-paper intro">
          <span class="o-kicker">{{ 'ui.editor.kicker' | t }}</span>
          <p class="intro__text">{{ 'ui.editor.intro' | t }}</p>
        </article>

        <div class="tabs" role="tablist" [attr.aria-label]="'ui.editor.title' | t">
          @for (tb of tabs; track tb) {
            <button
              class="o-chip"
              type="button"
              role="tab"
              [class.o-chip--accent]="tab() === tb"
              [attr.aria-selected]="tab() === tb"
              (click)="selectTab(tb)"
            >
              {{ 'ui.editor.tabs.' + tb | t }}
            </button>
          }
        </div>

        @switch (tab()) {
          <!-- Club ------------------------------------------------------------------------- -->
          @case ('clubs') {
            <section class="o-card">
              <label class="o-field">
                <span class="o-label">{{ 'ui.editor.search' | t }}</span>
                <input
                  class="o-input"
                  type="search"
                  [value]="clubQuery()"
                  (input)="clubQuery.set(val($event))"
                  [placeholder]="'ui.editor.clubSearchHint' | t"
                />
              </label>
              @if (clubQuery().length < minQuery) {
                <div class="filters">
                  @for (f of clubFilters(); track f.id) {
                    <button
                      class="o-chip"
                      type="button"
                      [class.o-chip--accent]="clubFilter() === f.id"
                      [attr.aria-pressed]="clubFilter() === f.id"
                      (click)="clubFilter.set(f.id)"
                    >
                      {{ f.label }}
                    </button>
                  }
                </div>
              }
              <ul class="rows">
                @for (r of clubRows(); track r.id) {
                  <li class="row-wrap" [class.open]="openClub() === r.id">
                    <button
                      class="row"
                      type="button"
                      [attr.aria-expanded]="openClub() === r.id"
                      (click)="toggleClub(r.id)"
                    >
                      <app-crest [crest]="r.crest" [size]="30" />
                      <span class="row__text">
                        @if (r.was) {
                          <span class="was">{{ r.was }}</span>
                        }
                        <span class="row__name">{{ r.name }}</span>
                        <span class="o-muted row__sub">{{ r.sub }}</span>
                      </span>
                      @if (r.edited) {
                        <span class="mark" [attr.aria-label]="'ui.editor.edited' | t">✎</span>
                      }
                    </button>

                    @if (openClub() === r.id && draft(); as d) {
                      <div class="sheet">
                        <div class="preview" aria-hidden="true">
                          <app-crest [crest]="previewCrest()!" [size]="64" />
                          <app-kit [kit]="previewKit()!" [size]="72" />
                          <span class="preview__name">{{ d.name || '—' }}</span>
                        </div>

                        <label class="o-field">
                          <span class="o-label">{{ 'ui.editor.club.name' | t }}</span>
                          <input
                            class="o-input"
                            [value]="d.name"
                            [attr.maxlength]="limits.clubName"
                            (input)="setName(val($event))"
                          />
                        </label>
                        <div class="pair">
                          <label class="o-field">
                            <span class="o-label">{{ 'ui.editor.club.shortName' | t }}</span>
                            <input
                              class="o-input"
                              [value]="d.shortName"
                              [attr.maxlength]="limits.shortName"
                              (input)="patchDraft({ shortName: val($event) })"
                            />
                          </label>
                          <label class="o-field initials">
                            <span class="o-label">{{ 'ui.editor.club.initials' | t }}</span>
                            <input
                              class="o-input"
                              [value]="d.initials"
                              [attr.maxlength]="limits.initials"
                              (input)="setInitials(val($event))"
                            />
                          </label>
                        </div>

                        @for (slot of colorSlots; track slot) {
                          <div class="o-field">
                            <span class="o-label" [id]="'lbl-' + slot">{{
                              'ui.editor.club.' + slot | t
                            }}</span>
                            <div
                              class="swatches"
                              role="radiogroup"
                              [attr.aria-labelledby]="'lbl-' + slot"
                            >
                              @for (c of palette; track c.id) {
                                <button
                                  class="swatch"
                                  type="button"
                                  role="radio"
                                  [style.--sw]="c.hex"
                                  [attr.aria-checked]="d[slot] === c.hex"
                                  [attr.aria-label]="'ui.editor.colors.' + c.id | t"
                                  [disabled]="d[other(slot)] === c.hex"
                                  (click)="
                                    patchDraft(
                                      slot === 'primary' ? { primary: c.hex } : { secondary: c.hex }
                                    )
                                  "
                                >
                                  <span class="swatch__dot"></span>
                                </button>
                              }
                            </div>
                          </div>
                        }

                        <div class="o-field">
                          <span class="o-label" id="lbl-pattern">{{
                            'ui.editor.club.pattern' | t
                          }}</span>
                          <div class="patterns" role="radiogroup" aria-labelledby="lbl-pattern">
                            @for (p of patterns; track p) {
                              <button
                                class="pattern"
                                type="button"
                                role="radio"
                                [attr.aria-checked]="d.pattern === p"
                                [attr.aria-label]="'ui.editor.patterns.' + p | t"
                                (click)="patchDraft({ pattern: p })"
                              >
                                <app-kit
                                  [kit]="{ primary: d.primary, secondary: d.secondary, pattern: p }"
                                  [size]="38"
                                />
                              </button>
                            }
                          </div>
                        </div>

                        <div class="o-row">
                          @if (r.edited) {
                            <button
                              class="o-btn o-btn--ghost o-btn--small"
                              type="button"
                              [disabled]="busy()"
                              (click)="resetClub(r.id)"
                            >
                              {{ 'ui.editor.reset' | t }}
                            </button>
                          }
                          <button
                            class="o-btn o-btn--small"
                            type="button"
                            [disabled]="busy() || !draftValid()"
                            (click)="saveClub(r.id)"
                          >
                            {{ 'ui.editor.save' | t }}
                          </button>
                        </div>
                      </div>
                    }
                  </li>
                } @empty {
                  <li class="o-muted empty">{{ 'ui.editor.noResults' | t }}</li>
                }
              </ul>
              @if (clubOverflow() > 0) {
                <p class="o-muted small none">
                  {{ 'ui.editor.more' | t: { n: clubOverflow() } }}
                </p>
              }
            </section>
          }

          <!-- Persone ---------------------------------------------------------------------- -->
          @case ('people') {
            <section class="o-card">
              <label class="o-field">
                <span class="o-label">{{ 'ui.editor.search' | t }}</span>
                <input
                  class="o-input"
                  type="search"
                  [value]="peopleQuery()"
                  (input)="peopleQuery.set(val($event))"
                  [placeholder]="'ui.editor.peopleSearchHint' | t"
                />
              </label>
              @if (peopleQuery().length < minQuery) {
                <div class="filters">
                  @for (s of scopes; track s) {
                    <button
                      class="o-chip"
                      type="button"
                      [class.o-chip--accent]="peopleScope() === s"
                      [attr.aria-pressed]="peopleScope() === s"
                      (click)="peopleScope.set(s)"
                    >
                      {{ 'ui.editor.scopes.' + s | t }}
                    </button>
                  }
                </div>
              }
              <ul class="rows">
                @for (p of peopleRows(); track p.id) {
                  <li class="row-wrap" [class.open]="openPerson() === p.id">
                    <button
                      class="row"
                      type="button"
                      [attr.aria-expanded]="openPerson() === p.id"
                      (click)="togglePerson(p)"
                    >
                      <span class="row__text">
                        @if (p.was) {
                          <span class="was">{{ p.was }}</span>
                        }
                        <span class="row__name">{{ p.firstName }} {{ p.lastName }}</span>
                        <span class="o-muted row__sub">{{ p.sub }}</span>
                      </span>
                      @if (p.was) {
                        <span class="mark" [attr.aria-label]="'ui.editor.edited' | t">✎</span>
                      }
                    </button>
                    @if (openPerson() === p.id) {
                      <div class="sheet">
                        <div class="pair">
                          <label class="o-field">
                            <span class="o-label">{{ 'ui.create.firstName' | t }}</span>
                            <input
                              class="o-input"
                              [value]="personDraft().firstName"
                              [attr.maxlength]="limits.personName"
                              (input)="
                                personDraft.set({
                                  firstName: val($event),
                                  lastName: personDraft().lastName,
                                })
                              "
                            />
                          </label>
                          <label class="o-field">
                            <span class="o-label">{{ 'ui.create.lastName' | t }}</span>
                            <input
                              class="o-input"
                              [value]="personDraft().lastName"
                              [attr.maxlength]="limits.personName"
                              (input)="
                                personDraft.set({
                                  firstName: personDraft().firstName,
                                  lastName: val($event),
                                })
                              "
                            />
                          </label>
                        </div>
                        <div class="o-row">
                          @if (p.was) {
                            <button
                              class="o-btn o-btn--ghost o-btn--small"
                              type="button"
                              [disabled]="busy()"
                              (click)="resetPerson(p.id)"
                            >
                              {{ 'ui.editor.reset' | t }}
                            </button>
                          }
                          <button
                            class="o-btn o-btn--small"
                            type="button"
                            [disabled]="busy() || !personValid()"
                            (click)="savePerson(p.id)"
                          >
                            {{ 'ui.editor.save' | t }}
                          </button>
                        </div>
                      </div>
                    }
                  </li>
                } @empty {
                  <li class="o-muted empty">{{ 'ui.editor.noResults' | t }}</li>
                }
              </ul>
              @if (peopleOverflow() > 0) {
                <p class="o-muted small none">
                  {{ 'ui.editor.more' | t: { n: peopleOverflow() } }}
                </p>
              }
            </section>
          }

          <!-- Competizioni ----------------------------------------------------------------- -->
          @case ('competitions') {
            <section class="o-card">
              <p class="o-muted small none">{{ 'ui.editor.competitionsHint' | t }}</p>
              <ul class="rows">
                @for (c of competitionRows(); track c.id) {
                  <li class="comp">
                    <label class="o-label" [for]="'comp-' + c.id">
                      @if (c.custom) {
                        <span class="was">{{ c.original }}</span>
                      } @else {
                        {{ c.original }}
                      }
                    </label>
                    <div class="comp-line">
                      <input
                        class="o-input"
                        [id]="'comp-' + c.id"
                        [value]="compDraft()[c.id] ?? c.custom"
                        [placeholder]="c.original"
                        [attr.maxlength]="limits.competitionName"
                        (input)="setCompDraft(c.id, val($event))"
                        (keydown.enter)="compDirty(c) && saveCompetition(c.id, compDraft()[c.id]!)"
                      />
                      @if (compDirty(c)) {
                        <button
                          class="o-chip o-chip--accent"
                          type="button"
                          [disabled]="busy()"
                          (click)="saveCompetition(c.id, compDraft()[c.id]!)"
                        >
                          {{ 'ui.editor.save' | t }}
                        </button>
                      } @else if (c.custom) {
                        <button
                          class="o-chip"
                          type="button"
                          [disabled]="busy()"
                          [attr.aria-label]="'ui.editor.reset' | t"
                          (click)="saveCompetition(c.id, null)"
                        >
                          {{ 'ui.editor.original' | t }}
                        </button>
                      }
                    </div>
                  </li>
                }
              </ul>
            </section>
          }

          <!-- File ------------------------------------------------------------------------- -->
          @case ('file') {
            <section class="o-card">
              <h2 class="o-section-title">{{ 'ui.editor.file.export' | t }}</h2>
              <p class="o-muted small none">{{ 'ui.editor.file.exportText' | t }}</p>
              <button
                class="o-btn o-btn--small"
                type="button"
                [disabled]="busy() || count() === 0"
                (click)="exportFile()"
              >
                {{ 'ui.editor.file.exportButton' | t }}
              </button>
            </section>
            <section class="o-card">
              <h2 class="o-section-title">{{ 'ui.editor.file.import' | t }}</h2>
              <p class="o-muted small none">{{ 'ui.editor.file.importText' | t }}</p>
              <label class="o-btn o-btn--ghost o-btn--small file-btn" [class.disabled]="busy()">
                {{ 'ui.editor.file.importButton' | t }}
                <input
                  class="o-visually-hidden"
                  type="file"
                  accept=".json,application/json"
                  [disabled]="busy()"
                  (change)="importFile($event)"
                />
              </label>
            </section>
            <section class="o-card">
              <h2 class="o-section-title">{{ 'ui.editor.file.resetTitle' | t }}</h2>
              <p class="o-muted small none">{{ 'ui.editor.file.resetText' | t }}</p>
              <button
                class="o-btn o-btn--danger o-btn--small"
                type="button"
                [disabled]="busy() || count() === 0"
                (click)="resetAll()"
              >
                {{ 'ui.editor.file.resetButton' | t }}
              </button>
            </section>
            <p class="o-muted small none fiction">{{ 'ui.editor.file.fiction' | t }}</p>
          }
        }
      </main>
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
      flex: 1 1 auto;
    }
    .count {
      flex: 0 0 auto;
    }
    .intro {
      transform: rotate(-0.6deg);
      gap: var(--o-space-2);
    }
    .intro__text {
      margin: 0;
      font-size: 14px;
      line-height: 1.5;
    }
    .tabs,
    .filters {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding-bottom: 2px;
    }
    .tabs .o-chip,
    .filters .o-chip {
      flex: 0 0 auto;
    }
    .small {
      font-size: var(--o-text-sm);
      line-height: 1.45;
    }
    .none {
      margin: 0;
    }
    .rows {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
    }
    .row-wrap {
      border-bottom: 1px solid var(--o-border);
    }
    .row-wrap:last-child {
      border-bottom: none;
    }
    .row {
      appearance: none;
      width: 100%;
      min-height: var(--o-touch);
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 2px;
      background: none;
      border: none;
      color: var(--o-text);
      text-align: left;
      font: inherit;
      cursor: pointer;
    }
    .row:focus-visible {
      outline: 3px solid var(--o-accent-fg);
      outline-offset: 2px;
    }
    .row__text {
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .row__name {
      font-family: var(--o-font-display);
      font-weight: 700;
      font-size: 18px;
      text-transform: uppercase;
      line-height: 1.1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .row__sub {
      font-size: var(--o-text-xs);
    }
    /* Correzione di bozza: il nome originale barrato in rosso */
    .was {
      font-size: var(--o-text-xs);
      color: var(--o-text-muted);
      text-decoration: line-through;
      text-decoration-color: var(--o-headline-red);
      text-decoration-thickness: 2px;
    }
    .mark {
      flex: 0 0 auto;
      font-size: 18px;
      color: var(--o-headline-red);
      transform: rotate(-8deg);
    }
    .empty {
      padding: 12px 0;
      font-size: var(--o-text-sm);
    }
    .open .row {
      color: var(--o-accent-fg);
    }
    .sheet {
      display: flex;
      flex-direction: column;
      gap: var(--o-space-3);
      padding: 4px 0 var(--o-space-4);
      animation: o-rise var(--o-normal) var(--o-ease) both;
    }
    .preview {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px;
      border-radius: var(--o-radius-md);
      background:
        repeating-linear-gradient(
          90deg,
          transparent 0,
          transparent 22px,
          var(--o-pitch-line) 22px,
          var(--o-pitch-line) 23px
        ),
        var(--o-bg-deep);
    }
    .preview__name {
      flex: 1 1 auto;
      min-width: 0;
      font-family: var(--o-font-display);
      font-weight: 800;
      font-size: 22px;
      line-height: 1;
      text-transform: uppercase;
      overflow-wrap: anywhere;
    }
    .pair {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: var(--o-space-2);
    }
    .pair .initials {
      max-width: 120px;
    }
    .swatches {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 2px;
    }
    .swatch {
      appearance: none;
      min-height: var(--o-touch);
      display: grid;
      place-items: center;
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
    }
    .swatch__dot {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: var(--sw);
      box-shadow:
        inset 0 0 0 1px rgba(255, 255, 255, 0.18),
        0 0 0 1px var(--o-border-strong);
      transition: transform var(--o-fast) var(--o-ease);
    }
    .swatch[aria-checked='true'] .swatch__dot {
      transform: scale(1.12);
      box-shadow:
        0 0 0 3px var(--o-bg),
        0 0 0 5px var(--o-accent-fg);
    }
    .swatch:disabled {
      cursor: not-allowed;
      opacity: 0.25;
    }
    .swatch:focus-visible,
    .pattern:focus-visible {
      outline: 3px solid var(--o-accent-fg);
      outline-offset: 1px;
      border-radius: var(--o-radius-sm);
    }
    .patterns {
      display: flex;
      gap: var(--o-space-2);
    }
    .pattern {
      appearance: none;
      min-width: 56px;
      min-height: 56px;
      display: grid;
      place-items: center;
      border-radius: var(--o-radius-md);
      border: 1px solid var(--o-border-strong);
      background: var(--o-bg-deep);
      cursor: pointer;
    }
    .pattern[aria-checked='true'] {
      border-color: var(--o-accent);
      background: var(--o-accent-soft);
    }
    .comp {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px 0;
      border-bottom: 1px solid var(--o-border);
    }
    .comp-line {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .comp-line .o-input {
      flex: 1 1 auto;
      min-width: 0;
    }
    .comp-line .o-chip {
      flex: 0 0 auto;
    }
    .comp:last-child {
      border-bottom: none;
    }
    .file-btn {
      position: relative;
      cursor: pointer;
    }
    .file-btn.disabled {
      opacity: 0.5;
      pointer-events: none;
    }
    .fiction {
      text-align: center;
    }
  `,
})
export class EditorPage {
  protected readonly game = inject(GameService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly alerts = inject(AlertController);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  protected readonly tabs = TABS;
  protected readonly scopes = SCOPES;
  protected readonly minQuery = MIN_QUERY;
  protected readonly limits = this.game.ctx.config.editor.limits;
  protected readonly palette = this.game.ctx.content.clubs.colors;
  protected readonly patterns = KIT_PATTERNS;
  protected readonly colorSlots = ['primary', 'secondary'] as const;

  protected readonly tab = signal<Tab>('clubs');
  protected readonly busy = signal(false);
  protected readonly count = computed(() => {
    const s = this.game.state();
    return s ? editCount(s) : 0;
  });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    addIcons({ chevronBack });
    // Il filtro della serie del giocatore può stare fuori schermo: lo si porta in vista.
    afterNextRender(() => {
      const chip = this.host.nativeElement.querySelector<HTMLElement>('.filters .o-chip--accent');
      const bar = chip?.parentElement;
      if (chip && bar) bar.scrollLeft = chip.offsetLeft - bar.offsetLeft - 16;
    });
  }

  // --- Club ----------------------------------------------------------------------------------

  protected readonly clubQuery = signal('');
  private readonly playerLevel = computed(() => {
    const s = this.game.state();
    return (s?.player.clubId ? levelOfClub(s.world, s.player.clubId) : undefined) ?? 1;
  });
  protected readonly clubFilter = signal<ClubFilter>(this.playerLevel());
  protected readonly openClub = signal<string | null>(null);
  protected readonly draft = signal<ClubLook | null>(null);
  private initialsTouched = false;

  protected readonly clubFilters = computed(() => {
    const s = this.game.state();
    if (!s) return [];
    return [
      ...[...s.world.leagues]
        .sort((a, b) => a.level - b.level)
        .map((l) => ({ id: l.level as ClubFilter, label: this.i18n.t(l.nameKey) })),
      { id: 'foreign' as ClubFilter, label: this.i18n.t('ui.editor.foreign') },
    ];
  });

  private readonly allClubRows = computed(() => {
    const s = this.game.state();
    if (!s) return [];
    const was = s.edits?.clubs ?? {};
    const levelOf = new Map(
      s.world.leagues.flatMap((l) => l.groups.flatMap((g) => g.clubIds.map((id) => [id, l.level]))),
    );
    const row = (c: ClubBase, sub: string, filter: ClubFilter) => ({
      id: c.id,
      name: c.name,
      sub,
      crest: c.crest,
      was: was[c.id] && was[c.id]!.name !== c.name ? was[c.id]!.name : null,
      edited: c.id in was,
      filter,
      search: norm(`${c.name} ${c.shortName} ${c.city}`),
    });
    return [
      ...s.world.clubs.map((c) => row(c, c.city, levelOf.get(c.id) ?? 1)),
      ...s.world.foreignClubs.map((c: ForeignClub) =>
        row(c, `${c.city} · ${this.i18n.t(`countries.${c.country}.name`)}`, 'foreign'),
      ),
    ];
  });

  private readonly clubMatches = computed(() => {
    const q = norm(this.clubQuery().trim());
    const rows = this.allClubRows();
    if (q.length >= MIN_QUERY) return rows.filter((r) => r.search.includes(q));
    const f = this.clubFilter();
    return rows.filter((r) => r.filter === f).sort((a, b) => a.name.localeCompare(b.name, 'it'));
  });

  protected readonly clubRows = computed<ClubRow[]>(() =>
    this.clubMatches()
      .slice(0, MAX_RESULTS * 2)
      .map((r) => ({
        id: r.id,
        name: r.name,
        sub: r.sub,
        crest: r.crest,
        was: r.was,
        edited: r.edited,
      })),
  );
  protected readonly clubOverflow = computed(() =>
    Math.max(0, this.clubMatches().length - MAX_RESULTS * 2),
  );

  private clubById(id: string): ClubBase | undefined {
    const w = this.game.state()?.world;
    return w?.clubs.find((c) => c.id === id) ?? w?.foreignClubs.find((c) => c.id === id);
  }

  protected readonly previewCrest = computed<Crest | null>(() => {
    const id = this.openClub();
    const d = this.draft();
    const club = id ? this.clubById(id) : undefined;
    if (!club || !d) return null;
    return {
      ...club.crest,
      primary: d.primary,
      secondary: d.secondary,
      initials: d.initials || club.crest.initials,
    };
  });
  protected readonly previewKit = computed<Kit | null>(() => {
    const d = this.draft();
    return d ? { primary: d.primary, secondary: d.secondary, pattern: d.pattern } : null;
  });

  protected readonly draftValid = computed(() => {
    const d = this.draft();
    return (
      !!d &&
      d.name.trim() !== '' &&
      d.shortName.trim() !== '' &&
      d.initials.trim() !== '' &&
      d.primary !== d.secondary
    );
  });

  protected toggleClub(id: string): void {
    if (this.openClub() === id) {
      this.openClub.set(null);
      return;
    }
    const club = this.clubById(id);
    if (!club) return;
    this.initialsTouched = false;
    this.draft.set(clubLook(club));
    this.openClub.set(id);
  }

  protected other(slot: 'primary' | 'secondary'): 'primary' | 'secondary' {
    return slot === 'primary' ? 'secondary' : 'primary';
  }

  protected patchDraft(changes: Partial<ClubLook>): void {
    this.draft.update((d) => (d ? { ...d, ...changes } : d));
  }

  protected setName(name: string): void {
    this.patchDraft(
      this.initialsTouched
        ? { name }
        : { name, initials: initialsOf(name, this.limits.initials) || this.draft()!.initials },
    );
  }

  protected setInitials(value: string): void {
    this.initialsTouched = true;
    this.patchDraft({ initials: value.toUpperCase() });
  }

  protected async saveClub(id: string): Promise<void> {
    const d = this.draft();
    if (!d) return;
    await this.run(async () => {
      await this.game.editClub(id, d);
      this.openClub.set(null);
      await this.toast.show(this.i18n.t('ui.editor.saved'));
    });
  }

  protected async resetClub(id: string): Promise<void> {
    await this.run(async () => {
      await this.game.resetClub(id);
      this.openClub.set(null);
      await this.toast.show(this.i18n.t('ui.editor.restored'));
    });
  }

  // --- Persone -------------------------------------------------------------------------------

  protected readonly peopleQuery = signal('');
  protected readonly peopleScope = signal<PeopleScope>('team');
  protected readonly openPerson = signal<string | null>(null);
  protected readonly personDraft = signal({ firstName: '', lastName: '' });

  private readonly allPeople = computed(() => {
    const s = this.game.state();
    if (!s) return [];
    const was = s.edits?.people ?? {};
    const shortOf = new Map(
      [...s.world.clubs, ...s.world.foreignClubs].map((c) => [c.id, c.shortName]),
    );
    return worldPeople(s.world).map((p) => {
      const club = p.clubId ? (shortOf.get(p.clubId) ?? '') : '';
      const label = this.i18n.t(`ui.editor.kinds.${p.kind}`);
      const base = was[p.id];
      return {
        ...p,
        sub: club ? `${label} · ${club}` : label,
        was: base ? `${base.firstName} ${base.lastName}` : null,
        search: norm(`${p.firstName} ${p.lastName}`),
      };
    });
  });

  private readonly peopleMatches = computed(() => {
    const q = norm(this.peopleQuery().trim());
    const all = this.allPeople();
    if (q.length >= MIN_QUERY) return all.filter((p) => p.search.includes(q));
    const scope = this.peopleScope();
    if (scope === 'team') {
      const clubId = this.game.state()?.player.clubId;
      // L'allenatore in cima, poi la rosa.
      return clubId
        ? all
            .filter((p) => p.clubId === clubId)
            .sort((a, b) => Number(b.kind === 'coach') - Number(a.kind === 'coach'))
        : [];
    }
    return all.filter((p) => p.kind === scope);
  });

  protected readonly peopleRows = computed<PersonRow[]>(() =>
    this.peopleMatches().slice(0, MAX_RESULTS),
  );
  protected readonly peopleOverflow = computed(() =>
    Math.max(0, this.peopleMatches().length - MAX_RESULTS),
  );
  protected readonly personValid = computed(() => {
    const d = this.personDraft();
    return d.firstName.trim() !== '' && d.lastName.trim() !== '';
  });

  protected togglePerson(p: PersonRow): void {
    if (this.openPerson() === p.id) {
      this.openPerson.set(null);
      return;
    }
    this.personDraft.set({ firstName: p.firstName, lastName: p.lastName });
    this.openPerson.set(p.id);
  }

  protected async savePerson(id: string): Promise<void> {
    await this.run(async () => {
      await this.game.editPerson(id, this.personDraft());
      this.openPerson.set(null);
      await this.toast.show(this.i18n.t('ui.editor.saved'));
    });
  }

  protected async resetPerson(id: string): Promise<void> {
    await this.run(async () => {
      await this.game.resetPerson(id);
      this.openPerson.set(null);
      await this.toast.show(this.i18n.t('ui.editor.restored'));
    });
  }

  // --- Competizioni --------------------------------------------------------------------------

  protected readonly compDraft = signal<Record<string, string>>({});

  protected readonly competitionRows = computed(() => {
    const s = this.game.state();
    if (!s) return [];
    const custom = s.edits?.competitions ?? {};
    const ids = [
      ...[...s.world.leagues].sort((a, b) => a.level - b.level).map((l) => l.id),
      ...s.world.competitions.map((c) => c.id),
    ];
    return ids.map((id) => ({
      id,
      original: this.i18n.original(trophyKey(id)),
      custom: custom[id] ?? '',
    }));
  });

  protected compDirty(c: { id: string; custom: string }): boolean {
    const d = this.compDraft()[c.id];
    return d !== undefined && d.trim() !== c.custom;
  }

  protected setCompDraft(id: string, value: string): void {
    this.compDraft.update((d) => ({ ...d, [id]: value }));
  }

  protected async saveCompetition(id: string, name: string | null): Promise<void> {
    await this.run(async () => {
      await this.game.setCompetitionName(id, name);
      this.compDraft.update((d) => {
        const { [id]: _done, ...rest } = d;
        return rest;
      });
      await this.toast.show(this.i18n.t(name?.trim() ? 'ui.editor.saved' : 'ui.editor.restored'));
    });
  }

  // --- File ----------------------------------------------------------------------------------

  protected async exportFile(): Promise<void> {
    await this.run(async () => {
      const text = JSON.stringify(this.game.exportEdits(), null, 2);
      await deliverTextFile(
        `outstanding-modifiche-slot${this.game.slot() ?? 0}.json`,
        text,
        this.i18n.t('ui.editor.file.export'),
      );
    });
  }

  protected async importFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.busy.set(true);
    try {
      if (file.size > this.game.ctx.config.editor.maxFileBytes) {
        throw new EditsFileError('tooLarge');
      }
      const { applied, skipped } = await this.game.importEdits(await file.text());
      await this.toast.show(this.i18n.t('ui.editor.file.imported', { applied, skipped }));
    } catch (err) {
      const code = err instanceof EditsFileError ? err.code : 'invalid';
      await this.toast.show(this.i18n.t(`ui.editor.file.errors.${code}`), 'error');
    } finally {
      this.busy.set(false);
    }
  }

  protected async resetAll(): Promise<void> {
    const alert = await this.alerts.create({
      header: this.i18n.t('ui.editor.file.resetTitle'),
      message: this.i18n.t('ui.editor.file.resetConfirm'),
      buttons: [
        { text: this.i18n.t('ui.common.cancel'), role: 'cancel' },
        { text: this.i18n.t('ui.editor.file.resetButton'), role: 'confirm' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'confirm') return;
    await this.run(async () => {
      await this.game.resetEdits();
      this.compDraft.set({});
      await this.toast.show(this.i18n.t('ui.editor.restored'));
    });
  }

  // --- Comuni --------------------------------------------------------------------------------

  protected selectTab(tab: Tab): void {
    this.tab.set(tab);
    this.openClub.set(null);
    this.openPerson.set(null);
  }

  protected val(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected back(): void {
    if (window.history.length > 1) this.location.back();
    else void this.router.navigateByUrl('/settimana');
  }

  /** Esegue un'azione bloccando i pulsanti; un errore del motore diventa un avviso. */
  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await action();
    } catch {
      await this.toast.show(this.i18n.t('ui.editor.invalid'), 'error');
    } finally {
      this.busy.set(false);
    }
  }
}
