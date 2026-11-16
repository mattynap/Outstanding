/** Parametri di bilanciamento (JSON validati con Zod). */
import calendarJson from '../data/calendar.json';
import economyJson from '../data/economy.json';
import eventsJson from '../data/events.json';
import matchJson from '../data/match.json';
import playerJson from '../data/player.json';
import ratingsJson from '../data/ratings.json';
import worldJson from '../data/world.json';
import {
  calendarSchema,
  economySchema,
  eventsConfigSchema,
  matchSchema,
  playerConfigSchema,
  ratingsSchema,
  worldSchema,
  type CalendarConfig,
  type EconomyConfig,
  type EventsConfig,
  type MatchConfig,
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
  match: matchSchema,
  events: eventsConfigSchema,
} as const;

export interface GameConfig {
  ratings: RatingsConfig;
  player: PlayerConfig;
  calendar: CalendarConfig;
  world: WorldConfig;
  economy: EconomyConfig;
  match: MatchConfig;
  events: EventsConfig;
}

/** Oggetti di configurazione grezzi (non validati), uno per file JSON. */
export type RawConfig = Record<keyof GameConfig, unknown>;

/** Converte gli oggetti JSON grezzi in configurazione validata; in caso di errore lancia un messaggio leggibile. */
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

/** I file JSON distribuiti con il gioco, prima della validazione. */
export const rawDefaultConfig: RawConfig = {
  ratings: ratingsJson,
  player: playerJson,
  calendar: calendarJson,
  world: worldJson,
  economy: economyJson,
  match: matchJson,
  events: eventsJson,
};

/** Configurazione predefinita distribuita con il gioco. */
export const defaultConfig: GameConfig = parseConfig(rawDefaultConfig);
