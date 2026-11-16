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

/** A real Italian city; clubs get invented names built from its epithets. */
export const citySchema = z.object({
  name: z.string().min(2),
  region: z.string().min(2),
  area: areaSchema,
  /** 1 = small town ... 4 = metropolis. */
  size: z.number().int().min(1).max(4),
  /** Invented or poetic names used to build club names (never real club names). */
  epithets: z.array(z.string().min(2)).min(1),
});
export const citiesSchema = z.array(citySchema).min(10);

export const clubsDataSchema = z.object({
  prefixes: z.array(z.object({ name: z.string().min(2), short: z.string().min(1) })).min(5),
  colors: z.array(z.object({ id, hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/) })).min(4),
  symbols: z.array(id).min(4),
});

/** Flat translation table: "dotted.key" -> text. */
export const translationsSchema = z.record(z.string(), z.string().min(1));

export type Names = z.infer<typeof namesSchema>;
export type Trait = z.infer<typeof traitSchema>;
export type City = z.infer<typeof citySchema>;
export type ClubsData = z.infer<typeof clubsDataSchema>;
export type Translations = z.infer<typeof translationsSchema>;
