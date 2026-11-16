import { defaultConfig, type GameConfig } from '@outstanding/config';
import { defaultContent, type GameContent } from '@outstanding/content';

/** Tutto ciò che il motore legge oltre allo stato di gioco: configurazione di bilanciamento e contenuti. */
export interface GameContext {
  config: GameConfig;
  content: GameContent;
}

export const defaultContext: GameContext = { config: defaultConfig, content: defaultContent };
