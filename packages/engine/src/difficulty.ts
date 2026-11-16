import type { DifficultyLevel } from '@outstanding/config';
import type { GameContext } from './context';
import type { Difficulty, GameState } from './types';

/** Difficoltà della carriera: quella scelta, oppure la predefinita per i salvataggi che non ce l'hanno. */
export function careerDifficulty(state: GameState, ctx: GameContext): Difficulty {
  return state.difficulty ?? ctx.config.difficulty.default;
}

/** Modificatori della difficoltà della carriera (crescita, infortuni, mercato, partite). */
export function difficultyMods(state: GameState, ctx: GameContext): DifficultyLevel {
  return ctx.config.difficulty.levels[careerDifficulty(state, ctx)];
}
