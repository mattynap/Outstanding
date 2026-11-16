import { z } from 'zod';

export const roleSchema = z.enum(['GK', 'DEF', 'MID', 'ATT']);

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

/** Flat translation table: "dotted.key" -> text. */
export const translationsSchema = z.record(z.string(), z.string().min(1));

export type Names = z.infer<typeof namesSchema>;
export type Trait = z.infer<typeof traitSchema>;
export type Translations = z.infer<typeof translationsSchema>;
