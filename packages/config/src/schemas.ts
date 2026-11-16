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

/** Un record con esattamente una voce per abilità. */
const perSkill = <T extends z.ZodTypeAny>(value: T) =>
  z.object(Object.fromEntries(SKILLS.map((s) => [s, value])) as Record<(typeof SKILLS)[number], T>);
/** Un record con esattamente una voce per ruolo. */
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
    /** Un'area per girone; vuoto per un girone unico nazionale. */
    areas: z.array(areaSchema),
    clubsPerGroup: z
      .number()
      .int()
      .min(4)
      .refine((n) => n % 2 === 0, { message: 'clubsPerGroup must be even' }),
    promotePerGroup: z.number().int().min(0),
    relegatePerGroup: z.number().int().min(0),
    ratingRange: pctRange,
    /** Peso di estrazione di una città, indicizzato per dimensione 1..4. */
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
    points: z.object({ win: z.number().int().min(1), draw: z.number().int().min(0) }),
    /** Evoluzione di fine stagione delle rose dei club controllati dal computer. */
    rosterAging: z.object({
      /** Variazione di OVR per stagione per fascia d'età (prima fascia con maxAge >= età). */
      growthByAge: z
        .array(z.object({ maxAge: z.number().int(), delta: z.number() }))
        .min(1)
        .refine((bands) => bands.every((b, i) => i === 0 || b.maxAge > bands[i - 1]!.maxAge), {
          message: 'age bands must be sorted by maxAge',
        }),
      noise: z.number().min(0),
      retireAge: z.number().int(),
      youthAgeRange: z.tuple([z.number().int(), z.number().int()]),
      /** Frazione del distacco dal rating medio del livello recuperata ogni stagione (mercato, budget). */
      levelPull: z.number().min(0).max(1),
    }),
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

const prob = z.number().min(0).max(1);
const minuteRange = z
  .tuple([z.number().int().min(1), z.number().int().min(1)])
  .refine(([a, b]) => a <= b, { message: 'range min must be <= max' });
const momentTag = z.enum([
  'finishing',
  'passing',
  'dribble',
  'tackle',
  'duel',
  'composure',
  'penalty',
]);

/** Esito di un'opzione: variazione del voto ed eventuale gol (a favore o contro) con probabilità. */
const momentOutcome = z.object({
  rating: z.number(),
  /** Probabilità che ne nasca un gol della squadra del giocatore. */
  goalFor: prob.optional(),
  /** Chi segna il gol a favore: il giocatore, un compagno su suo assist, o un compagno e basta. */
  by: z.enum(['self', 'assist', 'team']).optional(),
  /** Probabilità che ne nasca un gol degli avversari. */
  goalAgainst: prob.optional(),
});

const momentOption = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  /** Pesi delle abilità usate per calcolare la probabilità di successo. */
  skills: z
    .partialRecord(z.enum(SKILLS), z.number().positive())
    .refine((w) => Object.keys(w).length > 0, { message: 'option needs at least one skill' }),
  /** Difficoltà relativa alla forza dell'avversario (positiva = più difficile). */
  difficulty: z.number(),
  /** Etichetta usata dai modificatori dei tratti (`match.tag.<tag>`). */
  tag: momentTag.optional(),
  success: momentOutcome,
  failure: momentOutcome,
});

const momentType = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  /** Peso di estrazione del momento per ciascun ruolo (ruoli assenti = mai). */
  weights: z.partialRecord(roleSchema, z.number().positive()),
  /** Numero di varianti di testo (`match.moments.<id>.text.<n>`, da 1). */
  textVariants: z.number().int().min(1),
  options: z.array(momentOption).min(2).max(4),
});

export const matchSchema = z
  .object({
    /** Simulazione rapida delle partite che non coinvolgono il giocatore. */
    quickSim: z.object({
      baseGoals: z.number().positive(),
      homeAdvantage: z.number(),
      ratingScale: z.number().positive(),
    }),
    blocks: z.number().int().min(1),
    minutesPerBlock: z.number().int().min(1),
    /** Quota del distacco tra OVR del giocatore e rating del club che pesa sulla forza della squadra. */
    playerImpact: z.number().min(0).max(1),
    /** Gol attesi moltiplicati mentre il giocatore è in campo (i momenti chiave aggiungono i loro). */
    xgScaleWhileOnPitch: z.object({ for: z.number().positive(), against: z.number().positive() }),
    /** Peso dei ruoli nella scelta del marcatore per i gol dei compagni e degli avversari. */
    scorerWeights: perRole(z.number().min(0)),
    selection: z.object({
      formWeight: z.number().min(0),
      moraleWeight: z.number().min(0),
      relationshipWeight: z.number().min(0),
      noise: z.number().min(0),
      benchPerRole: perRole(z.number().int().min(0)),
    }),
    substitutions: z.object({
      subOffChance: prob,
      subOffMinute: minuteRange,
      subOnChance: prob,
      subOnMinute: minuteRange,
    }),
    moments: z.object({
      countByRole: perRole(
        z
          .tuple([z.number().int().min(0), z.number().int().min(0)])
          .refine(([a, b]) => a <= b, { message: 'range min must be <= max' }),
      ),
      minMinutesForMoment: z.number().int().min(0),
      logisticScale: z.number().positive(),
      minChance: prob,
      maxChance: prob,
      formWeight: z.number().min(0),
      moraleWeight: z.number().min(0),
      energyWeight: z.number().min(0),
      types: z.array(momentType).min(1),
    }),
    rating: z.object({
      base: z.number(),
      min: z.number(),
      max: z.number(),
      step: z.number().positive(),
      /** Sotto questi minuti il giocatore è "senza voto" (salvo gol o assist). */
      minMinutes: z.number().int().min(0),
      goal: z.number(),
      assist: z.number(),
      result: z.object({ win: z.number(), draw: z.number(), loss: z.number() }),
      cleanSheet: perRole(z.number()),
      cleanSheetMinMinutes: z.number().int().min(0),
      concededPerGoal: perRole(z.number()),
      noise: z.number().min(0),
      /** Fasce di commento ordinate per voto massimo (`match.comment.<id>.<n>`). */
      commentBands: z
        .array(
          z.object({
            upTo: z.number(),
            id: z.string().regex(/^[a-z0-9_]+$/),
            variants: z.number().int().min(1),
          }),
        )
        .min(1),
    }),
  })
  .superRefine((m, ctx) => {
    const bands = m.rating.commentBands;
    if (bands.some((b, i) => i > 0 && b.upTo <= bands[i - 1]!.upTo)) {
      ctx.addIssue({ code: 'custom', message: 'comment bands must be sorted by upTo' });
    }
    if (bands[bands.length - 1]!.upTo < m.rating.max) {
      ctx.addIssue({ code: 'custom', message: 'last comment band must cover the max rating' });
    }
    if (m.moments.minChance > m.moments.maxChance) {
      ctx.addIssue({ code: 'custom', message: 'minChance must be <= maxChance' });
    }
    const ids = new Set<string>();
    for (const t of m.moments.types) {
      if (ids.has(t.id)) ctx.addIssue({ code: 'custom', message: `duplicate moment "${t.id}"` });
      ids.add(t.id);
      const optIds = new Set(t.options.map((o) => o.id));
      if (optIds.size !== t.options.length) {
        ctx.addIssue({ code: 'custom', message: `duplicate option id in moment "${t.id}"` });
      }
      for (const o of t.options) {
        for (const out of [o.success, o.failure]) {
          if (out.goalFor !== undefined && !out.by) {
            ctx.addIssue({ code: 'custom', message: `${t.id}.${o.id}: goalFor needs "by"` });
          }
        }
      }
    }
    for (const role of ROLES) {
      if (m.moments.countByRole[role][1] > 0 && !m.moments.types.some((t) => t.weights[role])) {
        ctx.addIssue({ code: 'custom', message: `no key moment available for role ${role}` });
      }
    }
  });

export type MatchConfig = z.infer<typeof matchSchema>;
export type MomentTypeConfig = z.infer<typeof momentType>;
export type MomentOptionConfig = z.infer<typeof momentOption>;
export type MomentOutcomeConfig = z.infer<typeof momentOutcome>;
export type WorldConfig = z.infer<typeof worldSchema>;
export type LevelConfig = z.infer<typeof levelSchema>;
export type EconomyConfig = z.infer<typeof economySchema>;
export type RatingsConfig = z.infer<typeof ratingsSchema>;
export type PlayerConfig = z.infer<typeof playerConfigSchema>;
export type CalendarConfig = z.infer<typeof calendarSchema>;
