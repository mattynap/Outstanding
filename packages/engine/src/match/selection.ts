import type { GameContext } from '../context';
import { selectionFreshnessPenalty } from '../player/freshness';
import { computeOvr } from '../player/ratings';
import type { Rng } from '../rng';
import type { Club, Player, Selection } from '../types';

/**
 * Decide se il giocatore è titolare, in panchina o fuori.
 * Il suo punteggio (OVR, forma, morale, fiducia dell'allenatore) viene confrontato con quello dei
 * compagni dello stesso ruolo; un po' di rumore rappresenta le scelte tecniche della settimana.
 */
export function selectPlayer(player: Player, club: Club, rng: Rng, ctx: GameContext): Selection {
  if (player.injury && player.injury.weeksLeft > 0) return 'out';
  const cfg = ctx.config.match.selection;
  const { form, morale } = player.condition;
  const trust = player.relationships[club.coachId] ?? 0;
  const score =
    computeOvr(player.skills, player.role, ctx.config.ratings) +
    (form - 50) * cfg.formWeight +
    (morale - 50) * cfg.moraleWeight +
    trust * cfg.relationshipWeight -
    selectionFreshnessPenalty(player.condition.energy, ctx) +
    rng.normal(0, cfg.noise);

  const rivals = club.roster
    .filter((p) => p.role === player.role)
    .map((p) => p.ovr + rng.normal(0, cfg.noise));
  const rank = rivals.filter((s) => s > score).length;
  const starters = ctx.config.world.formation[player.role];
  if (rank < starters) return 'starter';
  if (rank < starters + cfg.benchPerRole[player.role]) return 'bench';
  return 'out';
}

/** Minuti di ingresso e uscita in base alla convocazione (cambi decisi dall'allenatore). */
export function planMinutes(
  selection: Selection,
  totalMinutes: number,
  rng: Rng,
  ctx: GameContext,
): { minuteIn: number | null; minuteOut: number } {
  const cfg = ctx.config.match.substitutions;
  if (selection === 'starter') {
    const subbed = rng.chance(cfg.subOffChance);
    return {
      minuteIn: 0,
      minuteOut: subbed ? rng.int(cfg.subOffMinute[0], cfg.subOffMinute[1]) : totalMinutes,
    };
  }
  if (selection === 'bench' && rng.chance(cfg.subOnChance)) {
    return { minuteIn: rng.int(cfg.subOnMinute[0], cfg.subOnMinute[1]), minuteOut: totalMinutes };
  }
  return { minuteIn: null, minuteOut: totalMinutes };
}
