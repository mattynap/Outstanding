/** Game content (names, cities, clubs, traits, texts) validated with Zod. */
import type { z } from 'zod';
import itJson from '../data/i18n/it.json';
import namesJson from '../data/names.json';
import traitsJson from '../data/traits.json';
import {
  namesSchema,
  traitsSchema,
  translationsSchema,
  type Names,
  type Trait,
  type Translations,
} from './schemas';

export * from './schemas';
export { checkContent } from './check';

export interface GameContent {
  names: Names;
  traits: Trait[];
  i18n: { it: Translations };
}

function parse<S extends z.ZodType>(name: string, schema: S, raw: unknown): z.infer<S> {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid content "${name}": ${result.error.message}`);
  }
  return result.data;
}

export interface RawContent {
  names: unknown;
  traits: unknown;
  i18n: { it: unknown };
}

/** Parses raw JSON objects into validated content; throws a readable error on failure. */
export function parseContent(raw: RawContent): GameContent {
  return {
    names: parse('names.json', namesSchema, raw.names),
    traits: parse('traits.json', traitsSchema, raw.traits),
    i18n: { it: parse('i18n/it.json', translationsSchema, raw.i18n.it) },
  };
}

/** Default content shipped with the game. */
export const defaultContent: GameContent = parseContent({
  names: namesJson,
  traits: traitsJson,
  i18n: { it: itJson },
});
