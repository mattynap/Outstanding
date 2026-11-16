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

const intRange = z
  .tuple([z.number().int().min(0), z.number().int().min(0)])
  .refine(([a, b]) => a <= b, { message: 'range min must be <= max' });
const share = z.number().min(0).max(1);

export const economySchema = z
  .object({
    startContract: z.object({
      salaryWeekly: z.tuple([z.number().min(0), z.number().min(0)]),
      seasons: z.number().int().min(1),
    }),
    initialCoachRelationship: z.number().min(-100).max(100),
    /** Stipendio settimanale offerto per livello, dal giocatore più debole al più forte del livello. */
    salaryByLevel: z.array(
      z.object({ level: z.number().int().min(1), min: z.number().min(0), max: z.number().min(0) }),
    ),
    salaryRound: z.number().int().min(1),
    lifestyles: z
      .array(
        z.object({
          id: z.string().regex(/^[a-z0-9_]+$/),
          weeklyCost: z.number().min(0),
          happinessPerWeek: z.number(),
        }),
      )
      .min(1),
    defaultLifestyle: z.string(),
    /** Effetti settimanali quando i soldi in cassa sono negativi. */
    debt: z.object({ happinessPerWeek: z.number(), moralePerWeek: z.number() }),
    agents: z.object({
      qualityRange: intRange,
      /** Commissione per qualità (indice 0 = qualità 1). */
      commissionByQuality: z.array(share).min(1),
      /** Reputazione minima per ogni stella di qualità del procuratore. */
      reputationPerQuality: z.number().min(0),
      offerChanceBonusPerQuality: z.number().min(0),
      negotiationRoomPerQuality: z.number().min(0),
      initialRelationship: z.number().min(-100).max(100),
      candidates: z.number().int().min(1),
    }),
    offers: z.object({
      weeklyChance: share,
      freeAgentWeeklyChance: share,
      popularityFactor: z.number().min(0),
      formFactor: z.number().min(0),
      maxOpen: z.number().int().min(1),
      lifetimeWeeks: z.number().int().min(1),
      /** Differenza ammessa tra OVR percepito del giocatore e rating del club. */
      minFit: z.number(),
      maxFit: z.number(),
      youthBonusPerYear: z.number().min(0),
      youthBonusUntilAge: z.number().int(),
      /** Dopo questa età gli osservatori scontano l'OVR percepito ogni anno. */
      agePenaltyFromAge: z.number().int(),
      agePenaltyPerYear: z.number().min(0),
      maxLevelsUp: z.number().int().min(0),
      maxLevelsDown: z.number().int().min(0),
      levelWeights: z.object({
        higher: z.number().min(0),
        same: z.number().min(0),
        lower: z.number().min(0),
      }),
      seasonsByAge: z
        .array(
          z.object({
            maxAge: z.number().int(),
            min: z.number().int().min(1),
            max: z.number().int().min(1),
          }),
        )
        .min(1),
      salaryNoise: share,
      signingBonusWeeks: intRange,
    }),
    negotiation: z.object({
      roomMin: z.number().min(0),
      roomMax: z.number().min(0),
      rounds: z.number().int().min(0),
      maxSeasons: z.number().int().min(1),
    }),
    renewal: z.object({
      fromSeasonWeek: z.number().int().min(0),
      minFit: z.number(),
      /** Bonus sulla valutazione per ogni punto di fiducia dell'allenatore. */
      trustBonusPerPoint: z.number().min(0),
      raise: z.number(),
    }),
    loans: z.object({
      maxAge: z.number().int(),
      gapBelowClub: z.number(),
      weeklyChance: share,
      minFit: z.number(),
      maxFit: z.number(),
    }),
    sponsors: z.object({
      minPopularity: pct,
      weeklyChance: share,
      max: z.number().int().min(0),
      baseWeekly: z.number().min(0),
      perPopularityPoint: z.number().min(0),
      seasons: intRange,
      lifetimeWeeks: z.number().int().min(1),
      /** Settimane di compenso extra per un servizio fotografico. */
      shootBonusWeeks: z.number().min(0),
    }),
    retirement: z.object({ minAge: z.number().int(), maxAge: z.number().int() }),
  })
  .superRefine((e, ctx) => {
    if (!e.lifestyles.some((l) => l.id === e.defaultLifestyle)) {
      ctx.addIssue({ code: 'custom', message: 'defaultLifestyle must be one of lifestyles' });
    }
    const [qMin, qMax] = e.agents.qualityRange;
    if (qMin < 1 || e.agents.commissionByQuality.length < qMax) {
      ctx.addIssue({ code: 'custom', message: 'commissionByQuality must cover every quality' });
    }
    if (e.offers.minFit > e.offers.maxFit || e.loans.minFit > e.loans.maxFit) {
      ctx.addIssue({ code: 'custom', message: 'minFit must be <= maxFit' });
    }
    if (e.negotiation.roomMin > e.negotiation.roomMax) {
      ctx.addIssue({ code: 'custom', message: 'roomMin must be <= roomMax' });
    }
    if (e.retirement.minAge > e.retirement.maxAge) {
      ctx.addIssue({ code: 'custom', message: 'retirement minAge must be <= maxAge' });
    }
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

export const eventsConfigSchema = z
  .object({
    /** Peso di avere 0, 1, 2, ... eventi casuali in una settimana (la lunghezza fissa il massimo). */
    perWeekWeights: z.array(z.number().min(0)).min(1),
    maxPerCategoryPerWeek: z.number().int().min(1),
    /** Limiti delle statistiche percentuali modificate dagli eventi. */
    statLimits: z.object({ pctMin: z.number(), pctMax: z.number() }),
  })
  .refine((e) => e.perWeekWeights.some((w) => w > 0), {
    message: 'perWeekWeights needs a positive weight',
  });

export type EventsConfig = z.infer<typeof eventsConfigSchema>;

const conditionDelta = z
  .object({
    energy: z.number(),
    morale: z.number(),
    happiness: z.number(),
    discipline: z.number(),
    injuryRisk: z.number(),
    popularity: z.number(),
  })
  .partial();

const weekAction = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  kind: z.enum(['training', 'rest', 'recovery', 'leisure', 'sponsor']),
  /** Moltiplicatore della crescita per gli allenamenti. */
  intensity: z.number().positive().optional(),
  /** L'allenamento si concentra su un'abilità scelta dal giocatore. */
  focus: z.boolean().optional(),
  /** Probabilità di infortunarsi durante la sessione (prima dei moltiplicatori di rischio). */
  injuryChance: prob.optional(),
  /** Probabilità di recuperare una settimana in più da un infortunio. */
  healChance: prob.optional(),
  effects: conditionDelta,
});

const ageBands = z
  .array(z.object({ maxAge: z.number().int(), value: z.number().min(0) }))
  .min(1)
  .refine((b) => b.every((x, i) => i === 0 || x.maxAge > b[i - 1]!.maxAge), {
    message: 'age bands must be sorted by maxAge',
  });

export const progressionSchema = z
  .object({
    actionsPerWeek: z.number().int().min(1),
    actions: z.array(weekAction).min(1),
    /** Azioni applicate in automatico alle settimane saltate. */
    skipWeekPlan: z.array(z.string()),
    growth: z.object({
      /** Punti abilità per sessione di allenamento normale, prima dei moltiplicatori. */
      basePerSession: z.number().positive(),
      focusMultiplier: z.number().positive(),
      /** Quota minima di crescita per le abilità poco pesate nel ruolo (0–1). */
      minWeightShare: prob,
      /** Crescita di una partita intera, in sessioni equivalenti. */
      matchPer90: z.number().min(0),
      ageMultipliers: ageBands,
      /** Distacco OVR–potenziale sotto il quale la crescita rallenta. */
      potentialGapScale: z.number().positive(),
      /** Moltiplicatore massimo della crescita per chi è lontano dal potenziale (i talenti crescono più in fretta). */
      maxGapFactor: z.number().min(1),
      skillCapOverPotential: z.number().min(0),
      skillMax: z.number().max(100),
      disciplineFactor: z.object({ min: z.number().min(0), max: z.number().min(0) }),
      lowEnergyThreshold: z.number().min(0).max(100),
      lowEnergyFactor: prob,
    }),
    decline: z.object({
      startAge: z.number().int(),
      basePerSeason: z.number().min(0),
      extraPerYear: z.number().min(0),
      skillMultipliers: perSkill(z.number().min(0)),
      disciplineMitigation: prob,
    }),
    condition: z.object({
      energyRecoveryPerWeek: z.number().min(0),
      energyPer90: z.number().min(0),
      formTarget: pct,
      formDriftPerWeek: prob,
      formPerRatingPoint: z.number().min(0),
      formNotPlaying: z.number(),
      moraleTarget: pct,
      moraleDriftPerWeek: prob,
      moraleBySelection: z.object({ starter: z.number(), bench: z.number(), out: z.number() }),
      moraleByResult: z.object({ win: z.number(), draw: z.number(), loss: z.number() }),
      moralePerRatingPoint: z.number().min(0),
      trustPerRatingPoint: z.number().min(0),
      trustNotSelected: z.number(),
      injuryRiskTarget: pct,
      injuryRiskDriftPerWeek: prob,
      lowEnergyInjuryRisk: z.number().min(0),
    }),
    injuries: z.object({
      matchChancePer90: prob,
      /** Aumento relativo della probabilità per ogni punto di rischio sopra il valore di riferimento. */
      riskPerPoint: z.number().min(0),
      lowEnergyMultiplier: z.number().min(1),
      formOnInjury: z.number(),
      moraleOnInjury: z.number(),
      types: z
        .array(
          z.object({
            id: z.string().regex(/^[a-z0-9_]+$/),
            weeks: z
              .tuple([z.number().int().min(1), z.number().int().min(1)])
              .refine(([a, b]) => a <= b, { message: 'weeks min must be <= max' }),
            weight: z.number().positive(),
          }),
        )
        .min(1),
    }),
  })
  .superRefine((p, ctx) => {
    const ids = new Set(p.actions.map((a) => a.id));
    if (ids.size !== p.actions.length)
      ctx.addIssue({ code: 'custom', message: 'duplicate action id' });
    for (const id of p.skipWeekPlan) {
      if (!ids.has(id))
        ctx.addIssue({ code: 'custom', message: `skipWeekPlan: unknown action "${id}"` });
      if (p.actions.find((a) => a.id === id)?.focus) {
        ctx.addIssue({ code: 'custom', message: `skipWeekPlan: "${id}" needs a focus` });
      }
    }
    if (p.skipWeekPlan.length > p.actionsPerWeek) {
      ctx.addIssue({ code: 'custom', message: 'skipWeekPlan has too many actions' });
    }
    if (p.growth.disciplineFactor.min > p.growth.disciplineFactor.max) {
      ctx.addIssue({ code: 'custom', message: 'disciplineFactor min must be <= max' });
    }
    if (p.actions.some((a) => a.kind === 'training' && a.intensity === undefined)) {
      ctx.addIssue({ code: 'custom', message: 'training actions need an intensity' });
    }
  });

const cupId = z.string().regex(/^[a-z0-9_]+$/);
const sortedDistinct = (weeks: readonly number[]) =>
  weeks.every((w, i) => i === 0 || w > weeks[i - 1]!);

/** Coppe: Coppa Tricolore a eliminazione diretta e due coppe europee con gironi. */
export const cupsSchema = z
  .object({
    nationalCup: z.object({
      id: cupId,
      /** Livelli che partecipano al completo. */
      levels: z.array(z.number().int().min(1)).min(1),
      /** Le migliori `count` squadre (per forza) di un livello in più. */
      extra: z.object({ level: z.number().int().min(1), count: z.number().int().min(0) }),
      /** Ogni turno è a gara secca; `entrants` = squadre nuove che entrano in quel turno (le più deboli). */
      rounds: z
        .array(
          z.object({
            weekOfSeason: seasonWeek,
            entrants: z.number().int().min(0),
            neutral: z.boolean().optional(),
          }),
        )
        .min(1),
      winnerQualifiesTo: cupId,
    }),
    continental: z.object({
      cups: z
        .array(
          z.object({
            id: cupId,
            /** Posizioni finali in massima serie che qualificano (stagione precedente). */
            leaguePlaces: z.array(z.number().int().min(1)).min(1),
          }),
        )
        .min(1),
      teams: z.number().int().min(4),
      groups: z.number().int().min(1),
      advancePerGroup: z.number().int().min(1),
      /** Settimane delle giornate dei gironi (andata e ritorno). */
      groupWeeks: z.array(seasonWeek).min(2),
      /** Turni a eliminazione diretta: una settimana = gara secca, due = andata e ritorno. */
      knockout: z
        .array(
          z.object({
            weeks: z.array(seasonWeek).min(1).max(2),
            neutral: z.boolean().optional(),
          }),
        )
        .min(1),
    }),
    extraTime: z.object({ xgFactor: z.number().min(0).max(1) }),
    penalties: z.object({
      /** Effetto della differenza di forza sulla probabilità di vincere ai rigori. */
      ratingScale: z.number().min(0),
      minChance: share,
      maxChance: share,
      winnerGoals: intRange,
      maxMargin: z.number().int().min(1),
    }),
    /** Club stranieri generati per le coppe europee, per fascia di forza. */
    foreign: z.object({
      tiers: z.array(z.object({ count: z.number().int().min(1), ratingRange: pctRange })).min(1),
    }),
  })
  .superRefine((c, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
    // Coppa nazionale: ogni turno deve avere un numero pari di squadre e finire con una vincitrice.
    let alive = 0;
    c.nationalCup.rounds.forEach((r, i) => {
      const teams = alive + r.entrants;
      if (teams < 2 || teams % 2 !== 0) issue(`nationalCup round ${i + 1} has ${teams} teams`);
      alive = Math.floor(teams / 2);
    });
    if (alive !== 1) issue('nationalCup rounds must end with a single winner');
    if (!sortedDistinct(c.nationalCup.rounds.map((r) => r.weekOfSeason))) {
      issue('nationalCup round weeks must be increasing');
    }
    if (!c.continental.cups.some((cup) => cup.id === c.nationalCup.winnerQualifiesTo)) {
      issue('nationalCup.winnerQualifiesTo must be a continental cup');
    }
    // Coppe europee: gironi uguali, tabellone a potenze di due, settimane in ordine.
    const k = c.continental;
    const groupSize = k.teams / k.groups;
    if (!Number.isInteger(groupSize) || groupSize < 2) issue('teams must split evenly in groups');
    if (k.groupWeeks.length !== (groupSize - 1) * 2) {
      issue(`groupWeeks must list ${(groupSize - 1) * 2} matchdays`);
    }
    if (k.advancePerGroup > groupSize) issue('advancePerGroup is larger than a group');
    if (k.groups * k.advancePerGroup !== 2 ** k.knockout.length) {
      issue('qualified teams must halve down to one winner in the knockout rounds');
    }
    const contWeeks = [...k.groupWeeks, ...k.knockout.flatMap((r) => r.weeks)];
    if (!sortedDistinct(contWeeks)) issue('continental weeks must be increasing');
    const national = new Set(c.nationalCup.rounds.map((r) => r.weekOfSeason));
    if (contWeeks.some((w) => national.has(w))) {
      issue('national and continental cups cannot share a week');
    }
    if (c.penalties.minChance > c.penalties.maxChance) issue('penalties minChance > maxChance');
  });

export type CupsConfig = z.infer<typeof cupsSchema>;

/** Punteggio di fine carriera e fasce di giudizio (l'ultima è la "leggenda"). */
export const careerSchema = z
  .object({
    score: z.object({
      /** Voto in pagella che non dà né toglie punti. */
      baseRating: z.number(),
      /** Punti per livello di campionato (indice 0 = massima serie). */
      perLevel: z
        .array(
          z.object({
            appearance: z.number().min(0),
            goal: z.number().min(0),
            assist: z.number().min(0),
            cleanSheet: z.number().min(0),
            /** Punti per ogni punto di voto sopra (o sotto) `baseRating`, partita per partita. */
            ratingPoint: z.number().min(0),
          }),
        )
        .min(1),
      /**
       * Moltiplicatore per ruolo dei punti di rendimento (non dei trofei): ogni ruolo deve poter
       * diventare leggenda con una frequenza simile.
       */
      roleFactors: perRole(z.number().positive()),
      /** Punti per trofeo: id del campionato (L1, L2, ...) o della coppa. */
      trophies: z.record(z.string(), z.number().min(0)),
    }),
    tiers: z.array(z.object({ id: cupId, min: z.number().min(0) })).min(2),
  })
  .superRefine((c, ctx) => {
    if (c.tiers[0]!.min !== 0)
      ctx.addIssue({ code: 'custom', message: 'first tier must start at 0' });
    if (!sortedDistinct(c.tiers.map((t) => t.min))) {
      ctx.addIssue({ code: 'custom', message: 'tier thresholds must be increasing' });
    }
  });

export type CareerConfig = z.infer<typeof careerSchema>;
export type ProgressionConfig = z.infer<typeof progressionSchema>;
export type WeekActionConfig = z.infer<typeof weekAction>;
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

/** Editor del giocatore: lunghezze massime dei nomi e versione del file di esportazione. */
export const editorSchema = z.object({
  limits: z.object({
    clubName: z.number().int().positive(),
    shortName: z.number().int().positive(),
    initials: z.number().int().positive(),
    personName: z.number().int().positive(),
    competitionName: z.number().int().positive(),
  }),
  fileVersion: z.number().int().positive(),
  /** Dimensione massima del file da importare, in byte. */
  maxFileBytes: z.number().int().positive(),
});
export type EditorConfig = z.infer<typeof editorSchema>;

export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** Modificatori di una difficoltà: moltiplicatori (1 = invariato) e bonus sulle probabilità in partita. */
const difficultyLevelSchema = z.object({
  /** Moltiplica la crescita da allenamento e partite. */
  growth: z.number().positive(),
  /** Moltiplica la probabilità di infortunio. */
  injury: z.number().positive(),
  /** Moltiplica la probabilità settimanale di ricevere offerte. */
  offerChance: z.number().positive(),
  /** Moltiplica gli stipendi offerti dai club. */
  salary: z.number().positive(),
  /** Si somma alla probabilità di successo dei momenti chiave (prima dei limiti min/max). */
  matchChance: z.number().min(-0.5).max(0.5),
});
export type DifficultyLevel = z.infer<typeof difficultyLevelSchema>;

/** Difficoltà scelta alla creazione della carriera. */
export const difficultySchema = z.object({
  default: z.enum(DIFFICULTIES),
  levels: z.object({
    easy: difficultyLevelSchema,
    normal: difficultyLevelSchema,
    hard: difficultyLevelSchema,
  }),
});
export type DifficultyConfig = z.infer<typeof difficultySchema>;

/** Cambi di aspetto in carriera (barbiere, accessori, tatuatore): costi in euro. */
export const lookSchema = z.object({
  /** Un cambio di taglio, colore, barba o accessori, comunque sia ampio. */
  styleChangeCost: z.number().int().nonnegative(),
  /** Ogni tatuaggio nuovo o sostituito. */
  tattooCost: z.number().int().nonnegative(),
  /** Ogni tatuaggio tolto. */
  tattooRemovalCost: z.number().int().nonnegative(),
});
export type LookConfig = z.infer<typeof lookSchema>;

const pair = z
  .tuple([z.number().nonnegative(), z.number().nonnegative()])
  .refine(([a, b]) => a <= b, { message: 'min must be <= max' });
export const INSTRUMENT_KINDS = ['fund', 'stocks', 'crypto'] as const;
export const PROPERTY_CATEGORIES = ['home', 'villa', 'palace', 'car', 'boat', 'yacht'] as const;

/**
 * Finanze personali: conto deposito, mercato di titoli e monete inventati (prezzi settimanali),
 * beni con mantenimento e valore che cambia, attività con rendita, mutui e prestiti.
 */
export const financeSchema = z.object({
  deposit: z.object({ annualRate: z.number().min(0).max(0.5) }),
  market: z.object({
    /** Settimane di prezzi conservate per i grafici. */
    historyWeeks: z.number().int().min(4),
    /** Commissione su ogni acquisto o vendita. */
    tradeFee: share,
    minPrice: z.number().positive(),
    instruments: z
      .array(
        z.object({
          id: z.string().regex(/^[a-z0-9_]+$/),
          kind: z.enum(INSTRUMENT_KINDS),
          startPrice: z.number().positive(),
          driftPerSeason: z.number().min(-1).max(1),
          volatilityWeekly: z.number().min(0).max(0.5),
          crashChance: share,
          crashDrop: pair,
          boomChance: share,
          boomRise: pair,
        }),
      )
      .min(1),
  }),
  properties: z.object({
    sellFee: share,
    /** Felicità settimanale massima che i beni possono dare tutti insieme. */
    maxHappinessPerWeek: z.number().nonnegative(),
    catalog: z
      .array(
        z.object({
          id: z.string().regex(/^[a-z0-9_]+$/),
          category: z.enum(PROPERTY_CATEGORIES),
          price: z.number().int().positive(),
          upkeepWeekly: z.number().int().nonnegative(),
          happinessPerWeek: z.number().nonnegative(),
          popularityOnBuy: z.number().nonnegative(),
          /** Variazione di valore in una stagione (negativa = svalutazione). */
          valuePerSeason: z.number().min(-1).max(1),
          /** Si può comprare con il mutuo (solo immobili). */
          mortgage: z.boolean(),
        }),
      )
      .min(1),
  }),
  businesses: z.object({
    healthStart: z.number().min(0).max(100),
    healthTarget: z.number().min(0).max(100),
    healthDrift: share,
    healthNoise: z.number().nonnegative(),
    /** Salute a cui l'attività non guadagna né perde. */
    breakEvenHealth: z.number().min(0).max(100),
    /** Punti di salute sopra il pareggio per rendere quanto la rendita base. */
    healthScale: z.number().positive(),
    incomeNoise: z.number().min(0).max(1),
    closeBelowHealth: z.number().min(0).max(100),
    /** Quota del costo recuperata vendendo un'attività in piena salute. */
    saleShare: share,
    maxOpen: z.number().int().positive(),
    catalog: z
      .array(
        z.object({
          id: z.string().regex(/^[a-z0-9_]+$/),
          cost: z.number().int().positive(),
          baseWeekly: z.number().int().positive(),
          /** Rendita in più per ogni punto di popolarità del giocatore. */
          popularityBonus: z.number().nonnegative(),
        }),
      )
      .min(1),
  }),
  loans: z.object({
    /** Rate non pagate prima del pignoramento. */
    missedToDefault: z.number().int().positive(),
    missedHappiness: z.number(),
    missedMorale: z.number(),
    /** Le rate settimanali di tutti i prestiti non superano questa quota dello stipendio. */
    maxPaymentShareOfSalary: share,
    mortgage: z.object({
      downPayment: share,
      annualRate: z.number().min(0).max(0.5),
      seasons: z.array(z.number().int().positive()).min(1),
    }),
    personal: z.object({
      annualRate: z.number().min(0).max(0.5),
      seasons: z.array(z.number().int().positive()).min(1),
      /** Importo massimo in settimane di stipendio. */
      maxWeeksOfSalary: z.number().positive(),
    }),
  }),
});
export type FinanceConfig = z.infer<typeof financeSchema>;
