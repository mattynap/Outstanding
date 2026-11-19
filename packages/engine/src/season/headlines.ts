import type { HeadlineKind } from '@outstanding/config';
import { defaultContext, type GameContext } from '../context';
import type { ChapterLog, GameState } from '../types';
import { getAnyClub, getClub, levelOfClub } from '../world/queries';
import { playerTable } from './director';

export type { HeadlineKind };

export interface Headline {
  kind: HeadlineKind;
  /** Chiave `headlines.<tipo>[.<esito>].<n>`: la variante è scelta senza `Rng`. */
  textKey: string;
  params: Record<string, string | number>;
}

/** Zona di classifica del club del giocatore. */
export type TableZone = 'promotion' | 'relegation' | 'mid';

/**
 * Zona del club del giocatore nel suo girone; nulla senza club o prima che si siano giocate
 * abbastanza giornate (le classifiche di inizio stagione non dicono niente).
 */
export function tableZone(state: GameState, ctx: GameContext = defaultContext): TableZone | null {
  const clubId = state.player.clubId;
  const table = playerTable(state, ctx);
  if (!clubId || !table) return null;
  const pos = table.findIndex((r) => r.clubId === clubId);
  if (pos < 0 || table[pos]!.played < ctx.config.calendar.chapterWeights.table.fromMatchday) {
    return null;
  }
  const level = ctx.config.world.levels.find((l) => l.level === levelOfClub(state.world, clubId));
  if (!level) return null;
  if (pos < level.promotePerGroup) return 'promotion';
  if (pos >= level.clubsPerGroup - level.relegatePerGroup) return 'relegation';
  return 'mid';
}

interface Candidate {
  kind: HeadlineKind;
  /** Esito dentro il tipo (vuoto se il tipo ne ha uno solo). */
  sub: string;
  week: number;
  params: Record<string, string | number>;
}

/**
 * I titoli del riepilogo, dal registro del tratto (`stretch`) e dal cambio di zona in classifica.
 * Un candidato per tipo; si sceglie per priorità e poi per settimana più recente, al massimo
 * `headlines.max`. Funzione pura, senza `Rng`: la variante dipende solo dalla settimana.
 */
export function buildHeadlines(
  state: GameState,
  stretch: ChapterLog,
  zoneFrom: TableZone | null,
  zoneTo: TableZone | null,
  ctx: GameContext = defaultContext,
): Headline[] {
  const cfg = ctx.config.calendar.headlines;
  const clubId = state.player.clubId;
  const base: Record<string, string | number> = {
    firstName: state.player.firstName,
    lastName: state.player.lastName,
    club: clubId ? getClub(state.world, clubId).shortName : '',
  };
  const opponent = (fixtureId: string): string => {
    const f = state.calendar.find((x) => x.id === fixtureId);
    if (!f) return '';
    const id = f.homeId === clubId ? f.awayId : f.homeId;
    return getAnyClub(state.world, id).shortName;
  };
  const out: Candidate[] = [];
  const add = (kind: HeadlineKind, sub: string, week: number, extra = {}) =>
    out.push({ kind, sub, week, params: { ...base, ...extra } });

  const l = stretch.lastLegend;
  if (l) {
    add('legend', l.success ? 'success' : 'failure', l.week, { opponent: opponent(l.fixtureId) });
  }
  const d = stretch.decisive;
  if (d)
    add('peak', d.success ? 'success' : 'failure', d.week, { opponent: opponent(d.fixtureId) });
  const b = stretch.bestRating;
  if (b && b.rating >= cfg.ratingFrom) {
    add('rating', '', b.week, { rating: b.rating, opponent: opponent(b.fixtureId) });
  }
  if (zoneFrom && zoneTo && zoneFrom !== zoneTo) {
    const sub = zoneTo === 'mid' ? (zoneFrom === 'relegation' ? 'safe' : 'slip') : zoneTo;
    add('table', sub, state.week);
  }
  if (stretch.events > 0) add('event', '', state.week, { n: stretch.events });
  const r = stretch.lastResult;
  if (r) {
    add('result', r.result, r.week, {
      opponent: opponent(r.fixtureId),
      goalsFor: r.goalsFor,
      goalsAgainst: r.goalsAgainst,
    });
  }

  const rank = (k: HeadlineKind) => cfg.priority.indexOf(k);
  return out
    .sort((x, y) => rank(x.kind) - rank(y.kind) || y.week - x.week)
    .slice(0, cfg.max)
    .map((c) => {
      const n = 1 + ((c.week + rank(c.kind)) % cfg.variants);
      return {
        kind: c.kind,
        textKey: `headlines.${c.kind}${c.sub ? `.${c.sub}` : ''}.${n}`,
        params: c.params,
      };
    });
}
