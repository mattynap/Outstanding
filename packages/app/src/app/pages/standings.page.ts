import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { IonContent } from '@ionic/angular';
import { cupGroupTables, getAnyClub, type Fixture, type StandingRow } from '@outstanding/engine';
import { GameService } from '../core/game.service';
import { I18nService, TranslatePipe } from '../core/i18n.service';
import { clubInfo, groupTable } from '../core/views';
import { CrestComponent } from '../ui/crest.component';
import { TabBarComponent } from '../ui/tab-bar.component';

interface TableRow {
  pos: number;
  id: string;
  name: string;
  crest: ReturnType<typeof getAnyClub>['crest'];
  played: number;
  diff: number;
  points: number;
  mine: boolean;
  zone: 'up' | 'down' | null;
}

/** Classifica del girone del giocatore e stato delle coppe. */
@Component({
  selector: 'app-standings',
  imports: [IonContent, NgTemplateOutlet, TranslatePipe, CrestComponent, TabBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-content class="o-page">
      <main class="o-wrap o-enter">
        <h1 class="o-display title">{{ 'ui.standings.title' | t }}</h1>
        <div class="tabs" role="tablist">
          @for (tab of tabs(); track tab.id) {
            <button
              class="o-chip"
              type="button"
              role="tab"
              [class.o-chip--accent]="selected() === tab.id"
              [attr.aria-selected]="selected() === tab.id"
              (click)="selected.set(tab.id)"
            >
              {{ tab.label }}
            </button>
          }
        </div>

        @if (selected() === 'league') {
          @if (league(); as l) {
            <section class="o-card">
              <div class="o-section-head">
                <h2 class="o-section-title">{{ l.title }}</h2>
              </div>
              <ng-container *ngTemplateOutlet="tableTpl; context: { rows: l.rows }" />
              <p class="legend o-muted">
                <span class="dot up"></span>{{ 'ui.standings.promotion' | t }}
                <span class="dot down"></span>{{ 'ui.standings.relegation' | t }}
              </p>
            </section>
          }
        } @else {
          @if (cup(); as c) {
            <section class="o-card">
              <div class="o-section-head">
                <h2 class="o-section-title">{{ c.name }}</h2>
                <span class="o-muted small">{{ c.status }}</span>
              </div>
              @if (c.winner) {
                <div class="winner">
                  <app-crest [crest]="c.winner.crest" [size]="36" />
                  <span class="o-display">{{ c.winner.name }}</span>
                </div>
              }
            </section>
            @if (c.group; as g) {
              <section class="o-card">
                <h2 class="o-section-title">{{ 'cups.group' | t: { letter: g.letter } }}</h2>
                <ng-container *ngTemplateOutlet="tableTpl; context: { rows: g.rows }" />
              </section>
            }
            @if (c.round.length > 0) {
              <section class="o-card">
                <h2 class="o-section-title">{{ c.roundTitle }}</h2>
                <div class="o-lines">
                  @for (m of c.round; track m.id) {
                    <div class="o-line fixture" [class.mine]="m.mine">
                      <span class="grow right">{{ m.home }}</span>
                      <span class="o-num res">{{ m.score }}</span>
                      <span class="grow">{{ m.away }}</span>
                    </div>
                  }
                </div>
              </section>
            }
          }
        }

        <ng-template #tableTpl let-rows="rows">
          <table class="table">
            <thead>
              <tr>
                <th scope="col" class="num">#</th>
                <th scope="col">{{ 'ui.standings.club' | t }}</th>
                <th scope="col" class="num">{{ 'ui.standings.played' | t }}</th>
                <th scope="col" class="num">{{ 'ui.standings.diff' | t }}</th>
                <th scope="col" class="num">{{ 'ui.standings.points' | t }}</th>
              </tr>
            </thead>
            <tbody>
              @for (r of asRows(rows); track r.id) {
                <tr
                  [class.mine]="r.mine"
                  [class.up]="r.zone === 'up'"
                  [class.down]="r.zone === 'down'"
                >
                  <td class="num pos">{{ r.pos }}</td>
                  <td>
                    <span class="club"
                      ><app-crest [crest]="r.crest" [size]="20" />{{ r.name }}</span
                    >
                  </td>
                  <td class="num">{{ r.played }}</td>
                  <td class="num">{{ r.diff > 0 ? '+' + r.diff : r.diff }}</td>
                  <td class="num pts o-num">{{ r.points }}</td>
                </tr>
              }
            </tbody>
          </table>
        </ng-template>
      </main>
    </ion-content>
    <app-tab-bar active="standings" />
  `,
  styles: `
    .title {
      font-size: 36px;
    }
    .tabs {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding-bottom: 2px;
    }
    .tabs .o-chip {
      flex: 0 0 auto;
    }
    .small {
      font-size: var(--o-text-sm);
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th {
      font-size: var(--o-text-xs);
      font-weight: 600;
      color: var(--o-text-muted);
      text-align: left;
      padding: 0 4px 6px;
    }
    td {
      padding: 7px 4px;
      border-top: 1px solid var(--o-border);
    }
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
      width: 34px;
    }
    .pos {
      text-align: center;
      border-left: var(--o-px-drop) solid transparent;
    }
    tr.up .pos {
      border-left-color: var(--o-positive);
    }
    tr.down .pos {
      border-left-color: var(--o-negative);
    }
    tr.mine td {
      background: var(--o-accent-soft);
      font-weight: 700;
      /* La propria riga ha il filetto oro sopra e sotto, a pixel pieni. */
      border-top: var(--o-px) solid var(--o-accent);
      border-bottom: var(--o-px) solid var(--o-accent);
    }
    .pts {
      width: 40px;
      font-size: 22px;
      line-height: 1;
    }
    .club {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .legend {
      margin: 0;
      font-size: var(--o-text-xs);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .dot {
      width: 10px;
      height: 10px;
      display: inline-block;
    }
    .dot.up {
      background: var(--o-positive);
    }
    .dot.down {
      background: var(--o-negative);
      margin-left: 8px;
    }
    .winner {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .winner .o-display {
      font-size: 24px;
    }
    .fixture.mine {
      color: var(--o-accent-fg);
      font-weight: 700;
    }
    .grow {
      flex: 1 1 0;
      min-width: 0;
    }
    .right {
      text-align: right;
    }
    .res {
      font-size: 22px;
      line-height: 1;
      min-width: 64px;
      text-align: center;
    }
  `,
})
export class StandingsPage {
  private readonly game = inject(GameService);
  private readonly i18n = inject(I18nService);
  protected readonly selected = signal('league');

  protected readonly tabs = computed(() => {
    const s = this.game.state();
    if (!s) return [];
    return [
      { id: 'league', label: this.i18n.t('ui.standings.league') },
      ...s.cups.map((c) => ({
        id: c.competitionId,
        label: this.i18n.t(`competitions.${c.competitionId}.name`),
      })),
    ];
  });

  protected readonly league = computed(() => {
    const s = this.game.state();
    if (!s) return null;
    const ctx = this.game.ctx;
    const info = clubInfo(s, ctx);
    const groupId = info?.groupId ?? s.world.leagues.find((l) => l.level === 1)!.groups[0]!.id;
    const league = s.world.leagues.find((l) => l.groups.some((g) => g.id === groupId))!;
    const group = league.groups.find((g) => g.id === groupId)!;
    const levelCfg = ctx.config.world.levels.find((l) => l.level === league.level)!;
    const table = info?.table ?? groupTable(s, groupId, ctx);
    return {
      title: `${this.i18n.t(league.nameKey)} · ${this.i18n.t(group.nameKey)}`,
      rows: this.rows(table, levelCfg.promotePerGroup, levelCfg.relegatePerGroup),
    };
  });

  protected readonly cup = computed(() => {
    const s = this.game.state();
    const id = this.selected();
    const cup = s?.cups.find((c) => c.competitionId === id);
    if (!s || !cup) return null;
    const own = s.player.clubId;
    const t = (k: string, p?: Record<string, string | number>) => this.i18n.t(k, p);
    const fixtures = s.calendar.filter(
      (f) => f.season === cup.season && f.cup?.competitionId === id,
    );
    const lastRound = Math.max(...fixtures.map((f) => f.cup!.round));
    const roundFixtures = fixtures.filter((f) => f.cup!.round === lastRound);
    const ownGroup = cup.groups.find((g) => own && g.clubIds.includes(own));
    const tables = cupGroupTables(cup, s.calendar, this.game.ctx);
    const showGroup = ownGroup ?? (lastRound === 0 ? cup.groups[0] : undefined);
    const groupTableRows = showGroup ? tables.find((g) => g.id === showGroup.id)?.table : undefined;
    const inCup = !!own && cup.participants.includes(own);
    const stage = roundFixtures[0]?.cup?.stage;
    const winner = cup.winnerId ? getAnyClub(s.world, cup.winnerId) : null;
    return {
      name: t(`competitions.${id}.name`),
      status: winner
        ? t('ui.standings.cupOver')
        : inCup
          ? t('ui.standings.inCup')
          : t('ui.standings.notInCup'),
      winner: winner ? { name: winner.name, crest: winner.crest } : null,
      group:
        showGroup && groupTableRows
          ? {
              letter: showGroup.letter,
              rows: this.rows(
                groupTableRows,
                this.game.ctx.config.cups.continental.advancePerGroup,
                0,
              ),
            }
          : null,
      roundTitle: stage ? t(`cups.stages.${stage}`) : '',
      round: lastRound > 0 ? this.fixtureLines(roundFixtures, own) : [],
    };
  });

  /** I tipi del template generico: le righe arrivano come `any` dal contesto. */
  protected asRows(rows: unknown): TableRow[] {
    return rows as TableRow[];
  }

  private rows(table: StandingRow[], up: number, down: number): TableRow[] {
    const s = this.game.state()!;
    return table.map((r, i) => {
      const club = getAnyClub(s.world, r.clubId);
      return {
        pos: i + 1,
        id: r.clubId,
        name: club.shortName,
        crest: club.crest,
        played: r.played,
        diff: r.goalsFor - r.goalsAgainst,
        points: r.points,
        mine: r.clubId === s.player.clubId,
        zone: i < up ? 'up' : i >= table.length - down ? 'down' : null,
      };
    });
  }

  private fixtureLines(fixtures: Fixture[], own: string | undefined) {
    const s = this.game.state()!;
    const lines = fixtures
      .map((f) => {
        let score = '–';
        if (f.result) {
          score = `${f.result.home + (f.extraTime?.home ?? 0)}–${f.result.away + (f.extraTime?.away ?? 0)}`;
          if (f.penalties) score += ` (${f.penalties.home}–${f.penalties.away})`;
        }
        return {
          id: f.id,
          home: getAnyClub(s.world, f.homeId).shortName,
          away: getAnyClub(s.world, f.awayId).shortName,
          score,
          mine: f.homeId === own || f.awayId === own,
        };
      })
      .sort((a, b) => Number(b.mine) - Number(a.mine));
    return lines.slice(0, 16);
  }
}
