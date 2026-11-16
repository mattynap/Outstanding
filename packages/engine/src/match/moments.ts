import type { MomentOptionConfig, MomentTypeConfig } from '@outstanding/config';
import type { GameContext } from '../context';
import type { Rng } from '../rng';
import type { Player, Role } from '../types';
import { clamp } from '../util';

/** Opzione di un momento chiave come la vede l'interfaccia. */
export interface KeyMomentOption {
  id: string;
  textKey: string;
  /** Probabilità di successo (0–1), già comprensiva di forma, morale e tratti. */
  chance: number;
}

/** Momento chiave da mostrare al giocatore. */
export interface KeyMoment {
  momentId: string;
  minute: number;
  textKey: string;
  /** Valori per i segnaposto del testo (es. `{opponent}`). */
  params: Record<string, string>;
  score: { home: number; away: number };
  options: KeyMomentOption[];
}

export function getMomentType(id: string, ctx: GameContext): MomentTypeConfig {
  const type = ctx.config.match.moments.types.find((t) => t.id === id);
  if (!type) throw new Error(`Unknown key moment "${id}"`);
  return type;
}

/** Sceglie il tipo di momento in base al ruolo (pesi in config/match.json). */
export function pickMomentType(role: Role, rng: Rng, ctx: GameContext): MomentTypeConfig {
  const types = ctx.config.match.moments.types.filter((t) => (t.weights[role] ?? 0) > 0);
  return rng.weighted(types, (t) => t.weights[role] ?? 0);
}

/** Minuti dei momenti chiave, distinti e ordinati, dentro l'intervallo in cui il giocatore è in campo. */
export function planMomentMinutes(
  role: Role,
  minuteIn: number | null,
  minuteOut: number,
  totalMinutes: number,
  rng: Rng,
  ctx: GameContext,
): number[] {
  if (minuteIn === null) return [];
  const cfg = ctx.config.match.moments;
  const played = minuteOut - minuteIn;
  if (played < cfg.minMinutesForMoment) return [];
  const [min, max] = cfg.countByRole[role];
  const count = Math.min(
    played,
    Math.max(1, Math.round((rng.int(min, max) * played) / totalMinutes)),
  );
  const pool = Array.from({ length: played }, (_, i) => minuteIn + 1 + i);
  return rng
    .shuffle(pool)
    .slice(0, count)
    .sort((a, b) => a - b);
}

/** Somma dei modificatori dei tratti per un'etichetta di momento (`match.all` + `match.tag.<tag>`). */
function traitBonus(player: Player, tag: string | undefined, ctx: GameContext): number {
  let bonus = 0;
  for (const id of player.traits) {
    const trait = ctx.content.traits.find((t) => t.id === id);
    for (const mod of trait?.modifiers ?? []) {
      if (mod.target === 'match.all' || (tag && mod.target === `match.tag.${tag}`)) {
        bonus += mod.value;
      }
    }
  }
  return bonus;
}

/**
 * Probabilità di successo: funzione logistica di (abilità pesata − forza avversaria − difficoltà),
 * più i modificatori di forma, morale, energia e tratti, limitata tra minChance e maxChance.
 */
export function optionChance(
  player: Player,
  option: MomentOptionConfig,
  opponentRating: number,
  ctx: GameContext,
  /** Bonus della difficoltà sulla probabilità (vedi `difficultyMods`). */
  difficultyBonus = 0,
): number {
  const cfg = ctx.config.match.moments;
  let total = 0;
  let weights = 0;
  for (const [skill, w] of Object.entries(option.skills)) {
    total += player.skills[skill as keyof Player['skills']] * w;
    weights += w;
  }
  const x = (total / weights - opponentRating - option.difficulty) / cfg.logisticScale;
  const { form, morale, energy } = player.condition;
  const mods =
    (cfg.formWeight * (form - 50)) / 50 +
    (cfg.moraleWeight * (morale - 50)) / 50 +
    (cfg.energyWeight * (energy - 50)) / 50 +
    traitBonus(player, option.tag, ctx) +
    difficultyBonus;
  return clamp(1 / (1 + Math.exp(-x)) + mods, cfg.minChance, cfg.maxChance);
}
