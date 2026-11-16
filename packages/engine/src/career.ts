import { defaultContext, type GameContext } from './context';
import { createPlayer, type NewPlayerOptions } from './player/create';
import { Rng } from './rng';
import { CURRENT_SAVE_VERSION } from './save/serialize';
import type { GameState } from './types';

export type NewCareerOptions = NewPlayerOptions;

/** Starts a new career. Same options + same seed always produce the same state. */
export function newCareer(
  options: NewCareerOptions,
  seed: number,
  ctx: GameContext = defaultContext,
): GameState {
  const normalizedSeed = seed >>> 0;
  const rng = Rng.fromSeed(normalizedSeed);
  const player = createPlayer(options, 'p0', rng, ctx);

  return {
    saveVersion: CURRENT_SAVE_VERSION,
    seed: normalizedSeed,
    rngState: rng.getState(),
    week: 0,
    season: 1,
    player,
    world: { clubs: [], leagues: [], competitions: [], npcs: [] },
    calendar: [],
    eventLog: [],
    cooldowns: {},
    scheduled: [],
    nextId: 1,
  };
}
