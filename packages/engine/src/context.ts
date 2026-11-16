import { defaultConfig, type GameConfig } from '@outstanding/config';
import { defaultContent, type GameContent } from '@outstanding/content';

/** Everything the engine reads besides the game state: balancing config and content. */
export interface GameContext {
  config: GameConfig;
  content: GameContent;
}

export const defaultContext: GameContext = { config: defaultConfig, content: defaultContent };
