import { z } from 'zod';

export const ROLES = ['GK', 'DEF', 'MID', 'ATT'] as const;
export const SKILLS = [
  'pace',
  'shooting',
  'passing',
  'dribbling',
  'defending',
  'physical',
  'vision',
  'goalkeeping',
] as const;

export const roleSchema = z.enum(ROLES);
export const skillSchema = z.enum(SKILLS);

const pct = z.number().min(0).max(100);
const range = z
  .tuple([z.number(), z.number()])
  .refine(([a, b]) => a <= b, { message: 'range min must be <= max' });
const pctRange = z
  .tuple([pct, pct])
  .refine(([a, b]) => a <= b, { message: 'range min must be <= max' });

/** A record with exactly one entry per skill. */
const perSkill = <T extends z.ZodTypeAny>(value: T) =>
  z.object(Object.fromEntries(SKILLS.map((s) => [s, value])) as Record<(typeof SKILLS)[number], T>);
/** A record with exactly one entry per role. */
const perRole = <T extends z.ZodTypeAny>(value: T) =>
  z.object(Object.fromEntries(ROLES.map((r) => [r, value])) as Record<(typeof ROLES)[number], T>);

export const ratingsSchema = z.object({
  roleWeights: perRole(
    perSkill(z.number().min(0)).refine(
      (w) => Object.values(w).reduce((a: number, b) => a + (b as number), 0) > 0,
      { message: 'role weights must not all be zero' },
    ),
  ),
});

export const playerConfigSchema = z.object({
  startAge: z.number().int().min(14).max(20),
  skillRanges: perRole(perSkill(pctRange)),
  potential: z
    .object({
      min: pct,
      max: pct,
      mean: pct,
      sd: z.number().positive(),
    })
    .refine((p) => p.min <= p.mean && p.mean <= p.max, {
      message: 'potential mean must lie between min and max',
    }),
  initial: z.object({
    condition: z.object({ form: pct, energy: pct, morale: pct, injuryRisk: pct }),
    persona: z.object({ discipline: pctRange, temperament: pctRange, happiness: pct }),
    image: z.object({ popularity: pct, reputation: pct, followers: range }),
    money: z.object({
      cash: z.number().min(0),
      salaryWeekly: z.number().min(0),
      assets: z.number().min(0),
    }),
  }),
  maxTraitsAtCreation: z.number().int().min(0).max(3),
});

const seasonWeek = z.number().int().min(0);

export const calendarSchema = z
  .object({
    weeksPerSeason: z.number().int().min(20),
    firstMatchWeek: seasonWeek,
    winterBreakWeeks: z.array(seasonWeek),
    transferWindows: z.object({
      summer: z.object({ fromWeek: seasonWeek, toWeek: seasonWeek }),
      winter: z.object({ fromWeek: seasonWeek, toWeek: seasonWeek }),
    }),
  })
  .refine((c) => c.firstMatchWeek < c.weeksPerSeason, {
    message: 'firstMatchWeek must be inside the season',
  });

export type RatingsConfig = z.infer<typeof ratingsSchema>;
export type PlayerConfig = z.infer<typeof playerConfigSchema>;
export type CalendarConfig = z.infer<typeof calendarSchema>;
