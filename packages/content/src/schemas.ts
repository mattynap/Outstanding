import { z } from 'zod';

export const roleSchema = z.enum(['GK', 'DEF', 'MID', 'ATT']);
export const areaSchema = z.enum(['N', 'C', 'S']);

const id = z.string().regex(/^[a-z0-9_]+$/, 'ids use lowercase letters, digits and underscores');

export const namesSchema = z.object({
  firstNames: z.array(z.string().min(2)).min(20),
  lastNames: z.array(z.string().min(2)).min(20),
});

export const traitSchema = z.object({
  id,
  selectableAtCreation: z.boolean(),
  roles: z.array(roleSchema).optional(),
  modifiers: z.array(z.object({ target: z.string().min(1), value: z.number() })),
});
export const traitsSchema = z.array(traitSchema);

/** Una città italiana reale; i club ricevono nomi inventati costruiti dai suoi epiteti. */
export const citySchema = z.object({
  name: z.string().min(2),
  region: z.string().min(2),
  area: areaSchema,
  /** 1 = piccolo centro ... 4 = metropoli. */
  size: z.number().int().min(1).max(4),
  /** Nomi inventati o poetici usati per comporre i nomi dei club (mai nomi di club reali). */
  epithets: z.array(z.string().min(2)).min(1),
});
export const citiesSchema = z.array(citySchema).min(10);

export const clubsDataSchema = z.object({
  prefixes: z.array(z.object({ name: z.string().min(2), short: z.string().min(1) })).min(5),
  colors: z.array(z.object({ id, hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/) })).min(4),
  symbols: z.array(id).min(4),
});

/** Un paese straniero con città reali e materiale per comporre club e calciatori inventati. */
export const foreignCountrySchema = z.object({
  id,
  /** "prefix": affisso prima dell'epiteto (Estrella Turia); "suffix": dopo (Thames Rovers). */
  nameFormat: z.enum(['prefix', 'suffix']),
  affixes: z.array(z.object({ name: z.string().min(2), short: z.string().min(1) })).min(2),
  cities: z
    .array(
      z.object({
        /** Nome della città in italiano. */
        name: z.string().min(2),
        size: z.number().int().min(1).max(4),
        /** Nomi inventati o poetici legati alla città (mai nomi di club reali). */
        epithets: z.array(z.string().min(2)).min(1),
      }),
    )
    .min(1),
  firstNames: z.array(z.string().min(2)).min(10),
  lastNames: z.array(z.string().min(2)).min(10),
});
export const foreignSchema = z.array(foreignCountrySchema).min(1);
export type ForeignCountry = z.infer<typeof foreignCountrySchema>;

/** Parti dell'avatar del giocatore: colori in esadecimale, forme come id (testi in `avatar.*`). */
const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
export const TATTOO_ZONES = ['armLeft', 'armRight', 'neck'] as const;
export type TattooZone = (typeof TATTOO_ZONES)[number];

/** Condizione per sbloccare un tatuaggio in carriera (senza condizione è disponibile da subito). */
export const tattooUnlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('age'), min: z.number().int().positive() }),
  z.object({ type: z.literal('appearances'), min: z.number().int().positive() }),
  z.object({ type: z.literal('trophies'), min: z.number().int().positive() }),
  z.object({ type: z.literal('topLevel') }),
]);
export type TattooUnlock = z.infer<typeof tattooUnlockSchema>;

export const tattooSchema = z.object({
  id,
  zones: z.array(z.enum(TATTOO_ZONES)).min(1),
  unlock: tattooUnlockSchema.optional(),
});
export type Tattoo = z.infer<typeof tattooSchema>;

/**
 * Le liste di id sono indicizzate dall'aspetto salvato (`Appearance`): le voci nuove vanno sempre
 * aggiunte in fondo, per non cambiare l'aspetto dei salvataggi esistenti.
 */
export const avatarSchema = z.object({
  skinTones: z.array(hex).min(2),
  hairColors: z.array(hex).min(2),
  hairStyles: z.array(id).min(2),
  faceShapes: z.array(id).min(1),
  beards: z.array(id).min(1),
  bodies: z.array(id).min(1),
  eyeShapes: z.array(id).min(1),
  eyeColors: z.array(hex).min(1),
  brows: z.array(id).min(1),
  noses: z.array(id).min(1),
  earrings: z.array(id).min(1),
  necklaces: z.array(id).min(1),
  headbands: z.array(id).min(1),
  tattoos: z.array(tattooSchema).min(1),
  /** Età (anni) in cui capelli e barba iniziano a ingrigire, sono grigi del tutto, e si stempia. */
  ageing: z.object({
    greyFromAge: z.number().int().positive(),
    fullGreyAge: z.number().int().positive(),
    recedeFromAge: z.number().int().positive(),
  }),
});
export type AvatarParts = z.infer<typeof avatarSchema>;

/** Marchio inventato di uno sponsor (mai marchi reali). */
export const sponsorSchema = z.object({
  id,
  name: z.string().min(2),
  category: z.enum(['sport', 'food', 'tech', 'cars', 'fashion']),
});
export const sponsorsSchema = z.array(sponsorSchema).min(4);
export type Sponsor = z.infer<typeof sponsorSchema>;

/** Tabella di traduzioni piatta: "chiave.puntata" -> testo. */
export const translationsSchema = z.record(z.string(), z.string().min(1));

export type Names = z.infer<typeof namesSchema>;
export type Trait = z.infer<typeof traitSchema>;
export type City = z.infer<typeof citySchema>;
export type ClubsData = z.infer<typeof clubsDataSchema>;
export type Translations = z.infer<typeof translationsSchema>;
