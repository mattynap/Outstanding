/** Contenuti di gioco (nomi, città, club, tratti, testi) validati con Zod. */
import type { z } from 'zod';
import citiesJson from '../data/cities.json';
import avatarJson from '../data/avatar.json';
import clubsJson from '../data/clubs.json';
import foreignJson from '../data/foreign.json';
import itJson from '../data/i18n/it.json';
import chapterGoalsJson from '../data/chapter-goals.json';
import itChapterGoalsJson from '../data/i18n/it.chapterGoals.json';
import itEventsJson from '../data/i18n/it.events.json';
import itLegendsJson from '../data/i18n/it.legends.json';
import itUiJson from '../data/i18n/it.ui.json';
import { chapterGoalsSchema, type ChapterGoal } from './chapterGoals';
import { rawEvents } from './eventFiles';
import { eventsSchema, type GameEvent } from './events';
import namesJson from '../data/names.json';
import privateJson from '../data/private.json';
import mediaJson from '../data/media.json';
import sponsorsJson from '../data/sponsors.json';
import traitsJson from '../data/traits.json';
import {
  avatarSchema,
  citiesSchema,
  clubsDataSchema,
  foreignSchema,
  namesSchema,
  privateContentSchema,
  mediaContentSchema,
  sponsorsSchema,
  traitsSchema,
  translationsSchema,
  type AvatarParts,
  type City,
  type ClubsData,
  type ForeignCountry,
  type Names,
  type PrivateContent,
  type MediaContent,
  type Sponsor,
  type Trait,
  type Translations,
} from './schemas';

export * from './schemas';
export * from './events';
export * from './chapterGoals';
export {
  BUILDUP_MIN_LINES,
  BUILDUP_PHASES,
  buildupLines,
  checkContent,
  checkMomentKeys,
  checkHeadlineKeys,
  checkPeakKeys,
  HEADLINE_SUBS,
  type MomentTextSource,
} from './check';

export interface GameContent {
  names: Names;
  traits: Trait[];
  cities: City[];
  clubs: ClubsData;
  avatar: AvatarParts;
  /** Paesi stranieri per i club delle coppe europee. */
  foreign: ForeignCountry[];
  sponsors: Sponsor[];
  /** Nomi e dettagli per partner e figli. */
  private: PrivateContent;
  /** Tifosi e testi dei media. */
  media: MediaContent;
  events: GameEvent[];
  /** Obiettivi che mister e procuratore assegnano a inizio capitolo. */
  chapterGoals: ChapterGoal[];
  i18n: { it: Translations };
}

export interface RawContent {
  names: unknown;
  traits: unknown;
  cities: unknown;
  clubs: unknown;
  foreign: unknown;
  avatar: unknown;
  sponsors: unknown;
  private: unknown;
  media: unknown;
  /** Un array di eventi per file, con il nome del file per i messaggi di errore. */
  events: { file: string; data: unknown }[];
  chapterGoals: unknown;
  /** Le traduzioni sono divise in più file e unite al caricamento. */
  i18n: { it: { file: string; data: unknown }[] };
}

function parse<S extends z.ZodType>(name: string, schema: S, raw: unknown): z.infer<S> {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid content "${name}": ${result.error.message}`);
  }
  return result.data;
}

/** Unisce più file di traduzione; una chiave ripetuta in due file è un errore. */
function mergeTranslations(files: { file: string; data: unknown }[]): Translations {
  const out: Translations = {};
  for (const f of files) {
    const table = parse(f.file, translationsSchema, f.data);
    for (const [key, text] of Object.entries(table)) {
      if (key in out) throw new Error(`Invalid content "${f.file}": duplicate text key "${key}"`);
      out[key] = text;
    }
  }
  return out;
}

/** Converte gli oggetti JSON grezzi in contenuti validati; in caso di errore lancia un messaggio leggibile. */
export function parseContent(raw: RawContent): GameContent {
  return {
    names: parse('names.json', namesSchema, raw.names),
    traits: parse('traits.json', traitsSchema, raw.traits),
    cities: parse('cities.json', citiesSchema, raw.cities),
    clubs: parse('clubs.json', clubsDataSchema, raw.clubs),
    foreign: parse('foreign.json', foreignSchema, raw.foreign),
    avatar: parse('avatar.json', avatarSchema, raw.avatar),
    sponsors: parse('sponsors.json', sponsorsSchema, raw.sponsors),
    private: parse('private.json', privateContentSchema, raw.private),
    media: parse('media.json', mediaContentSchema, raw.media),
    events: raw.events.flatMap((f) => parse(f.file, eventsSchema, f.data)),
    chapterGoals: parse('chapter-goals.json', chapterGoalsSchema, raw.chapterGoals),
    i18n: { it: mergeTranslations(raw.i18n.it) },
  };
}

/** I file JSON distribuiti con il gioco, prima della validazione. */
export const rawDefaultContent: RawContent = {
  names: namesJson,
  traits: traitsJson,
  cities: citiesJson,
  clubs: clubsJson,
  foreign: foreignJson,
  avatar: avatarJson,
  sponsors: sponsorsJson,
  private: privateJson,
  media: mediaJson,
  events: rawEvents,
  chapterGoals: chapterGoalsJson,
  i18n: {
    it: [
      { file: 'i18n/it.json', data: itJson },
      { file: 'i18n/it.events.json', data: itEventsJson },
      { file: 'i18n/it.chapterGoals.json', data: itChapterGoalsJson },
      { file: 'i18n/it.legends.json', data: itLegendsJson },
      { file: 'i18n/it.ui.json', data: itUiJson },
    ],
  },
};

/** Contenuti predefiniti distribuiti con il gioco. */
export const defaultContent: GameContent = parseContent(rawDefaultContent);
