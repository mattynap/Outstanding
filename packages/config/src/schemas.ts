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

export const areaSchema = z.enum(['N', 'C', 'S']);
const perRoleInt = perRole(z.number().int().min(0));

const levelSchema = z
  .object({
    level: z.number().int().min(1),
    professional: z.boolean(),
    groups: z.number().int().min(1),
    /** One area per group; empty for a single national group. */
    areas: z.array(areaSchema),
    clubsPerGroup: z
      .number()
      .int()
      .min(4)
      .refine((n) => n % 2 === 0, { message: 'clubsPerGroup must be even' }),
    promotePerGroup: z.number().int().min(0),
    relegatePerGroup: z.number().int().min(0),
    ratingRange: pctRange,
    /** Weight of a city being picked, indexed by city size 1..4. */
    citySizeWeights: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  })
  .refine((l) => l.areas.length === l.groups || (l.groups === 1 && l.areas.length === 0), {
    message: 'areas must list one area per group (or be empty for a single group)',
  });

export const worldSchema = z
  .object({
    levels: z.array(levelSchema).min(2),
    startLevels: z.array(z.number().int()).min(1),
    defaultStartLevel: z.number().int(),
    roster: z.object({
      composition: perRoleInt,
      ovrSpread: z.number().min(0),
      ageRange: z.tuple([z.number().int(), z.number().int()]),
    }),
    formation: perRoleInt,
    kitPatternWeights: z.object({
      solid: z.number().min(0),
      vstripes: z.number().min(0),
      hstripes: z.number().min(0),
      sash: z.number().min(0),
    }),
    agents: z.number().int().min(1),
    maxClubsPerCityPerGroup: z.number().int().min(1),
  })
  .superRefine((w, ctx) => {
    w.levels.forEach((l, i) => {
      if (l.level !== i + 1) {
        ctx.addIssue({ code: 'custom', message: `levels must be ordered 1..n (index ${i})` });
      }
      const lower = w.levels[i + 1];
      if (lower && l.groups * l.relegatePerGroup !== lower.groups * lower.promotePerGroup) {
        ctx.addIssue({
          code: 'custom',
          message: `level ${l.level} relegations must equal level ${lower.level} promotions`,
        });
      }
    });
    const first = w.levels[0];
    const last = w.levels[w.levels.length - 1];
    if (first && first.promotePerGroup !== 0) {
      ctx.addIssue({ code: 'custom', message: 'top level cannot promote' });
    }
    if (last && last.relegatePerGroup !== 0) {
      ctx.addIssue({ code: 'custom', message: 'bottom level cannot relegate' });
    }
    for (const s of [...w.startLevels, w.defaultStartLevel]) {
      if (!w.levels.some((l) => l.level === s)) {
        ctx.addIssue({ code: 'custom', message: `start level ${s} does not exist` });
      }
    }
    if (!w.startLevels.includes(w.defaultStartLevel)) {
      ctx.addIssue({ code: 'custom', message: 'defaultStartLevel must be one of startLevels' });
    }
    for (const role of ROLES) {
      if (w.formation[role] > w.roster.composition[role]) {
        ctx.addIssue({ code: 'custom', message: `roster has too few ${role} for the formation` });
      }
    }
  });

export const economySchema = z.object({
  startContract: z.object({
    salaryWeekly: z.tuple([z.number().min(0), z.number().min(0)]),
    seasons: z.number().int().min(1),
  }),
  initialCoachRelationship: z.number().min(-100).max(100),
});

export type WorldConfig = z.infer<typeof worldSchema>;
export type LevelConfig = z.infer<typeof levelSchema>;
export type EconomyConfig = z.infer<typeof economySchema>;
export type RatingsConfig = z.infer<typeof ratingsSchema>;
export type PlayerConfig = z.infer<typeof playerConfigSchema>;
export type CalendarConfig = z.infer<typeof calendarSchema>;
