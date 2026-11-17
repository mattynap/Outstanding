import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';
import {
  decideMoment,
  type GameState,
  type KeyMoment,
  type MatchReport,
  type Role,
  type MatchStep,
} from '@outstanding/engine';
import { TranslatePipe } from '../core/i18n.service';
import { createPractice } from '../scenes/practice';
import {
  resolvedStage,
  sceneForMoment,
  type SceneKind,
  type StageModel,
} from '../scenes/stage-model';
import { GameStageComponent } from '../ui/game-stage.component';
import { TimingControlComponent } from '../ui/timing-control.component';

type ProofKind = 'attack' | 'bell' | 'pendulum' | 'press';
@Component({
  selector: 'app-proof',
  imports: [IonContent, RouterLink, TranslatePipe, GameStageComponent, TimingControlComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-content class="o-page">
      <main class="o-wrap proof">
        <header class="head">
          <a routerLink="/" class="back">← {{ 'ui.stage.back' | t }}</a
          ><span class="edition">{{ 'ui.stage.edition' | t }}</span>
        </header>
        <div class="title">
          <span class="o-kicker o-kicker--accent">{{ 'ui.stage.kicker' | t }}</span>
          <h1>{{ 'ui.stage.title' | t }}</h1>
          <p>{{ 'ui.stage.subtitle' | t }}</p>
        </div>
        <nav class="tabs" [attr.aria-label]="'ui.stage.scenes' | t">
          @for (kind of kinds; track kind) {
            <button
              type="button"
              [class.selected]="kind === selected()"
              [attr.aria-pressed]="kind === selected()"
              (click)="select(kind)"
            >
              {{ 'ui.stage.tab.' + kind | t }}
            </button>
          }
        </nav>
        <app-game-stage
          [model]="stage()"
          [active]="active()"
          [label]="'ui.stage.tab.' + selected() | t"
        />
        @if (selected() === 'attack') {
          <div class="roles" [attr.aria-label]="'ui.create.role' | t">
            @for (r of roles; track r) {
              <button
                type="button"
                [attr.aria-pressed]="r === role()"
                [class.selected]="r === role()"
                [disabled]="busy()"
                (click)="restart(r)"
              >
                {{ 'roles.' + r | t }}
              </button>
            }
          </div>
          @if (moment(); as m) {
            <section class="action">
              <div class="minute">
                <span>{{ m.minute }}′</span><b>{{ m.score.home }} : {{ m.score.away }}</b>
              </div>
              <p>{{ m.textKey | t: m.params }}</p>
              @if (aimIndex() !== null && active()) {
                <app-timing-control (decided)="resolve($event)" />
              } @else {
                <div class="choices">
                  @for (o of m.options; track o.id) {
                    <button
                      class="o-choice"
                      type="button"
                      [disabled]="busy()"
                      (click)="aim($index)"
                    >
                      <span>{{ o.textKey | t }}</span><b>{{ pct(o.chance) }}%</b>
                    </button>
                  }
                </div>
              }
            </section>
          }
          @if (report(); as r) {
            <section class="result">
              <span class="o-kicker">{{ 'ui.match.final' | t }}</span><strong
                >{{ r.score.home }} : {{ r.score.away }}</strong
              >
              <p>{{ 'ui.stage.finished' | t }}</p>
              <button class="o-btn" type="button" (click)="restart(role())">
                {{ 'ui.stage.again' | t }}
              </button>
            </section>
          }
          @if (busy()) {
            <button class="o-btn o-btn--ghost" type="button" (click)="continue()">
              {{ 'ui.stage.next' | t }}
            </button>
          }
        } @else {
          <section class="o-paper story">
            <span class="o-kicker">{{ 'ui.stage.storyKicker' | t }}</span>
            <h2>{{ 'ui.stage.story.' + selected() + '.title' | t }}</h2>
            <p>{{ 'ui.stage.story.' + selected() + '.text' | t }}</p>
            <button class="o-btn" type="button" (click)="replay()">
              {{ 'ui.stage.replay' | t }}
            </button>
          </section>
        }
        @if (stage().result; as result) {
          <p class="status" role="status">{{ 'ui.stage.result.' + result | t }}</p>
        }
        @if (error()) {
          <p class="o-neg" role="alert">{{ 'ui.stage.error' | t }}</p>
        }
        <p class="note">{{ 'ui.stage.isolated' | t }}</p>
      </main>
    </ion-content>
  `,
  styles: `
    .proof {
      gap: 18px;
      padding-top: 20px;
      padding-bottom: 40px;
    }
    .head {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .back {
      color: var(--o-text-muted);
      font-size: 13px;
      text-decoration: none;
    }
    .edition {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: var(--o-accent-fg);
    }
    .title h1 {
      font: 800 52px/0.94 var(--o-font-display);
      text-transform: uppercase;
      margin: 8px 0 10px;
      letter-spacing: -1px;
    }
    .title p {
      margin: 0;
      color: var(--o-text-muted);
      font-size: 14px;
      line-height: 1.5;
      max-width: 34ch;
    }
    .tabs {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 5px;
    }
    .tabs button,
    .roles button {
      border: 1px solid var(--o-border-strong);
      border-radius: 5px;
      color: var(--o-text-muted);
      background: var(--o-surface);
      min-height: 44px;
      font: 600 12px var(--o-font-body);
      padding: 6px;
    }
    .tabs button.selected,
    .roles button.selected {
      background: var(--o-accent);
      border-color: var(--o-accent);
      color: #17241d;
    }
    .roles {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 5px;
    }
    .roles button {
      font-size: 11px;
    }
    .action {
      display: grid;
      gap: 14px;
    }
    .action p {
      font-size: 17px;
      line-height: 1.4;
      margin: 0;
    }
    .minute {
      display: flex;
      justify-content: space-between;
      font: 700 26px var(--o-font-display);
      color: var(--o-accent-fg);
    }
    .choices {
      display: grid;
      gap: 8px;
    }
    .o-choice {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      text-align: left;
    }
    .o-choice b {
      color: var(--o-accent-fg);
    }
    .story h2 {
      font: 700 30px/1 var(--o-font-display);
      margin: 8px 0;
    }
    .story p {
      font-size: 16px;
      line-height: 1.5;
    }
    .story .o-btn {
      margin-top: 14px;
    }
    .status {
      margin: 0;
      color: var(--o-accent-fg);
      font-size: 14px;
    }
    .note {
      font-size: 12px;
      color: var(--o-text-muted);
      margin: 0;
    }
    .result {
      display: grid;
      gap: 12px;
      text-align: center;
    }
    .result strong {
      font: 700 56px var(--o-font-display);
    }
  `,
})
export class ProofPage {
  protected readonly kinds: ProofKind[] = ['attack', 'bell', 'pendulum', 'press'];
  protected readonly roles: Role[] = ['GK', 'DEF', 'MID', 'ATT'];
  protected readonly selected = signal<ProofKind>('attack');
  protected readonly active = signal(true);
  protected readonly role = signal<Role>('ATT');
  protected readonly stage = signal<StageModel>({ key: 'start', scene: 'attack', phase: 'ready' });
  protected readonly moment = signal<KeyMoment | null>(null);
  protected readonly report = signal<MatchReport | null>(null);
  protected readonly aimIndex = signal<number | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal(false);
  private state: GameState | undefined;
  private pending: MatchStep | undefined;
  private serial = 0;
  constructor() {
    this.restart('ATT');
  }
  ionViewDidEnter(): void {
    this.active.set(true);
  }
  ionViewDidLeave(): void {
    this.active.set(false);
    this.aimIndex.set(null);
    this.continue();
  }
  protected pct(n: number): number {
    return Math.round(n * 100);
  }
  protected select(kind: ProofKind): void {
    this.continue();
    this.aimIndex.set(null);
    this.selected.set(kind);
    if (kind === 'attack') this.restart(this.role());
    else this.replay();
  }
  protected restart(role: Role): void {
    this.role.set(role);
    this.error.set(false);
    this.busy.set(false);
    this.aimIndex.set(null);
    try {
      const start = createPractice(role);
      this.state = start.state;
      this.show(start.step);
    } catch {
      this.error.set(true);
    }
  }
  protected aim(index: number): void {
    this.aimIndex.set(index);
  }
  protected resolve(quality: number): void {
    const index = this.aimIndex(),
      moment = this.moment();
    if (index === null || !moment || !this.state || this.busy()) return;
    try {
      const before = this.state.currentMatch?.events ?? [];
      const side = this.state.currentMatch?.side ?? 'home';
      const resolved = decideMoment(this.state, { optionIndex: index, quality });
      this.state = resolved.state;
      this.pending = resolved.step;
      const events =
        resolved.step.kind === 'finished'
          ? resolved.step.report.events
          : (resolved.state.currentMatch?.events ?? []);
      this.stage.set(resolvedStage(moment, side, events, before));
      this.busy.set(true);
      this.aimIndex.set(null);
    } catch {
      this.error.set(true);
    }
  }
  protected continue(): void {
    if (this.pending) {
      this.show(this.pending);
      this.pending = undefined;
    }
    this.busy.set(false);
  }
  protected replay(): void {
    this.stage.set({
      key: `story:${++this.serial}`,
      scene: this.selected() as SceneKind,
      phase: 'success',
    });
  }
  private show(step: MatchStep): void {
    if (step.kind === 'finished') {
      this.report.set(step.report);
      this.moment.set(null);
      return;
    }
    this.report.set(null);
    this.moment.set(step.moment);
    this.stage.set({
      key: `moment:${++this.serial}`,
      scene: sceneForMoment(step.moment.momentId),
      phase: 'ready',
    });
  }
}
