/** Balancing parameters (JSON validated with Zod). */
import calendarJson from '../data/calendar.json';
import economyJson from '../data/economy.json';
import playerJson from '../data/player.json';
import ratingsJson from '../data/ratings.json';
import worldJson from '../data/world.json';
import {
  calendarSchema,
  economySchema,
  playerConfigSchema,
  ratingsSchema,
  worldSchema,
  type CalendarConfig,
  type EconomyConfig,
  type PlayerConfig,
  type RatingsConfig,
  type WorldConfig,
} from './schemas';

export * from './schemas';

export const configSchema = {
  ratings: ratingsSchema,
  player: playerConfigSchema,
  calendar: calendarSchema,
  world: worldSchema,
  economy: economySchema,
} as const;

export interface GameConfig {
  ratings: RatingsConfig;
  player: PlayerConfig;
  calendar: CalendarConfig;
  world: WorldConfig;
  economy: EconomyConfig;
}

/** Raw (unvalidated) config objects, one per JSON file. */
export type RawConfig = Record<keyof GameConfig, unknown>;

/** Parses raw JSON objects into a validated config; throws a readable error on failure. */
export function parseConfig(raw: RawConfig): GameConfig {
  const out: Partial<GameConfig> = {};
  for (const key of Object.keys(configSchema) as (keyof GameConfig)[]) {
    const result = configSchema[key].safeParse(raw[key]);
    if (!result.success) {
      throw new Error(`Invalid config "${key}.json": ${result.error.message}`);
    }
    (out as Record<string, unknown>)[key] = result.data;
  }
  return out as GameConfig;
}

/** The JSON files shipped with the game, before validation. */
export const rawDefaultConfig: RawConfig = {
  ratings: ratingsJson,
  player: playerJson,
  calendar: calendarJson,
  world: worldJson,
  economy: economyJson,
};

/** Default config shipped with the game. */
export const defaultConfig: GameConfig = parseConfig(rawDefaultConfig);
