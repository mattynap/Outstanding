import { PCT_STAT_PATHS, type StatPath } from '@outstanding/content';
import type { Player } from '../types';

const PCT = new Set<string>(PCT_STAT_PATHS);

type Group = 'condition' | 'persona' | 'image' | 'money' | 'skills';

function split(path: StatPath): [Group, string] {
  const [group, key] = path.split('.') as [Group, string];
  return [group, key];
}

/** Legge una statistica numerica del giocatore dal suo percorso (es. `image.popularity`). */
export function getStat(player: Player, path: StatPath): number {
  const [group, key] = split(path);
  return (player[group] as Record<string, number>)[key]!;
}

/**
 * Imposta una statistica senza mutare il giocatore, rispettando i limiti: le percentuali restano
 * tra `pctMin` e `pctMax`, le altre non scendono sotto zero, tranne i soldi in cassa.
 */
export function setStat(
  player: Player,
  path: StatPath,
  value: number,
  limits: { pctMin: number; pctMax: number },
): Player {
  const [group, key] = split(path);
  let v = value;
  if (PCT.has(path)) v = Math.min(limits.pctMax, Math.max(limits.pctMin, v));
  else if (path !== 'money.cash') v = Math.max(0, v);
  return { ...player, [group]: { ...(player[group] as Record<string, number>), [key]: v } };
}
