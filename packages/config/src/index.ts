/** Balancing parameters (JSON validated with Zod). */
import calendarJson from '../data/calendar.json';
import playerJson from '../data/player.json';
import ratingsJson from '../data/ratings.json';
import {
  calendarSchema,
  playerConfigSchema,
  ratingsSchema,
  type CalendarConfig,
  type PlayerConfig,
  type RatingsConfig,
} from './schemas';

export * from './schemas';

export const configSchema = {
  ratings: ratingsSchema,
  player: playerConfigSchema,
  calendar: calendarSchema,
} as const;

export interface GameConfig {
  ratings: RatingsConfig;
  player: PlayerConfig;
  calendar: CalendarConfig;
}

/** Parses raw JSON objects into a validated config; throws a readable error on failure. */
export function parseConfig(raw: Record<keyof GameConfig, unknown>): GameConfig {
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

/** Default config shipped with the game. */
export const defaultConfig: GameConfig = parseConfig({
  ratings: ratingsJson,
  player: playerJson,
  calendar: calendarJson,
});
