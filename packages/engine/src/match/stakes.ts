import type { MatchConfig } from '@outstanding/config';
import { defaultContext, type GameContext } from '../context';
import { bigMatchKind } from '../media/media';
import { computeOvr } from '../player/ratings';
import type { Fixture, GameState, RosterPlayer } from '../types';
import { clamp } from '../util';
import { getAnyClub, getClub, levelOfClub } from '../world/queries';

/**
 * Segnali che alzano la posta di una partita. `rival` è riservato al rivale di carriera (non
 * ancora implementato): quando esisterà avrà la precedenza su `keyOpponent`.
 */
export type StakeSignal =
  'cup' | 'derby' | 'top' | 'debut' | 'contractExpiring' | 'lowTrust' | 'scout' | 'keyOpponent';

/** L'avversario più forte dello stesso ruolo, se è alla pari o sopra il giocatore (meno lo scarto). */
export function keyOpponentOf(
  state: GameState,
  fixture: Fixture,
  ctx: GameContext = defaultContext,
): RosterPlayer | null {
  const clubId = state.player.clubId;
  if (!clubId) return null;
  const oppId = fixture.homeId === clubId ? fixture.awayId : fixture.homeId;
  const p = state.player;
  const threshold =
    computeOvr(p.skills, p.role, ctx.config.ratings) - ctx.config.match.stakes.keyOpponentGap;
  let best: RosterPlayer | null = null;
  for (const r of getAnyClub(state.world, oppId).roster) {
    if (r.role !== p.role || r.ovr < threshold) continue;
    if (!best || r.ovr > best.ovr) best = r;
  }
  return best;
}

/** I segnali attivi per la partita del giocatore. */
export function matchSignals(
  state: GameState,
  fixture: Fixture,
  ctx: GameContext = defaultContext,
): StakeSignal[] {
  const cfg = ctx.config.match.stakes;
  const p = state.player;
  const out: StakeSignal[] = [];
  const kind = bigMatchKind(state, fixture, ctx);
  if (kind === 'cup' || kind === 'derby' || kind === 'top') out.push(kind);

  const clubId = p.clubId;
  if (clubId) {
    const level = levelOfClub(state.world, clubId);
    const played =
      p.seasonStats.appearances > 0 ||
      p.history.some((h) => h.leagueLevel === level && h.stats.appearances > 0);
    if (!played) out.push('debut');
    const coachTrust = p.relationships[getClub(state.world, clubId).coachId] ?? 0;
    if (coachTrust < cfg.lowTrustBelow) out.push('lowTrust');
  }
  if (p.contract?.untilSeason === state.season) out.push('contractExpiring');
  if (fixture.scout) out.push('scout');
  if (keyOpponentOf(state, fixture, ctx)) out.push('keyOpponent');
  return out;
}

/** La posta è il peso del segnale più forte, non la somma: sempre in [0, 1]. */
export function matchStakes(
  signals: StakeSignal[],
  cfg: MatchConfig['stakes'] = defaultContext.config.match.stakes,
): number {
  return clamp(Math.max(0, ...signals.map((s) => cfg[s])), 0, 1);
}
