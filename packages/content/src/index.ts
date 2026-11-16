/** Game content (names, cities, clubs, traits, texts) validated with Zod. */
import type { z } from 'zod';
import citiesJson from '../data/cities.json';
import clubsJson from '../data/clubs.json';
import itJson from '../data/i18n/it.json';
import namesJson from '../data/names.json';
import traitsJson from '../data/traits.json';
import {
  citiesSchema,
  clubsDataSchema,
  namesSchema,
  traitsSchema,
  translationsSchema,
  type City,
  type ClubsData,
  type Names,
  type Trait,
  type Translations,
} from './schemas';

export * from './schemas';
export { checkContent } from './check';

export interface GameContent {
  names: Names;
  traits: Trait[];
  cities: City[];
  clubs: ClubsData;
  i18n: { it: Translations };
}

export interface RawContent {
  names: unknown;
  traits: unknown;
  cities: unknown;
  clubs: unknown;
  i18n: { it: unknown };
}

function parse<S extends z.ZodType>(name: string, schema: S, raw: unknown): z.infer<S> {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid content "${name}": ${result.error.message}`);
  }
  return result.data;
}

/** Parses raw JSON objects into validated content; throws a readable error on failure. */
export function parseContent(raw: RawContent): GameContent {
  return {
    names: parse('names.json', namesSchema, raw.names),
    traits: parse('traits.json', traitsSchema, raw.traits),
    cities: parse('cities.json', citiesSchema, raw.cities),
    clubs: parse('clubs.json', clubsDataSchema, raw.clubs),
    i18n: { it: parse('i18n/it.json', translationsSchema, raw.i18n.it) },
  };
}

/** The JSON files shipped with the game, before validation. */
export const rawDefaultContent: RawContent = {
  names: namesJson,
  traits: traitsJson,
  cities: citiesJson,
  clubs: clubsJson,
  i18n: { it: itJson },
};

/** Default content shipped with the game. */
export const defaultContent: GameContent = parseContent(rawDefaultContent);
