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

/** Tabella di traduzioni piatta: "chiave.puntata" -> testo. */
export const translationsSchema = z.record(z.string(), z.string().min(1));

export type Names = z.infer<typeof namesSchema>;
export type Trait = z.infer<typeof traitSchema>;
export type City = z.infer<typeof citySchema>;
export type ClubsData = z.infer<typeof clubsDataSchema>;
export type Translations = z.infer<typeof translationsSchema>;
