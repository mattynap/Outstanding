/** Schema degli eventi: condizioni, scelte ed effetti. */
import { z } from 'zod';

const id = z.string().regex(/^[a-z0-9_]+$/, 'ids use lowercase letters, digits and underscores');
const textKey = z.string().regex(/^[a-z0-9_.]+$/, 'text keys use lowercase dotted ids');

/** Statistiche del giocatore limitate tra 0 e 100. */
export const PCT_STAT_PATHS = [
  'condition.form',
  'condition.energy',
  'condition.morale',
  'condition.injuryRisk',
  'persona.discipline',
  'persona.temperament',
  'persona.happiness',
  'image.popularity',
  'image.reputation',
  'skills.pace',
  'skills.shooting',
  'skills.passing',
  'skills.dribbling',
  'skills.defending',
  'skills.physical',
  'skills.vision',
  'skills.goalkeeping',
] as const;

/** Statistiche non percentuali: mai negative, tranne i soldi in cassa (i debiti esistono). */
export const OTHER_STAT_PATHS = [
  'image.followers',
  'money.cash',
  'money.salaryWeekly',
  'money.assets',
] as const;

export const STAT_PATHS = [...PCT_STAT_PATHS, ...OTHER_STAT_PATHS] as const;
export const statPathSchema = z.enum(STAT_PATHS);
export type StatPath = (typeof STAT_PATHS)[number];

/** Segnaposto ammessi nei testi degli eventi. */
export const EVENT_PLACEHOLDERS = [
  'firstName',
  'lastName',
  'club',
  'coach',
  'agent',
  'city',
  'hometown',
  'business',
  'partner',
  'child',
] as const;

/**
 * Eventi che il motore fa arrivare da solo quando succede qualcosa nella vita privata (un
 * tradimento scoperto, una nascita, il partner che se ne va). Ogni evento con `trigger` è anche
 * `chainOnly`.
 */
export const EVENT_TRIGGERS = ['affairDiscovered', 'childBorn', 'partnerLeft'] as const;
export type EventTrigger = (typeof EVENT_TRIGGERS)[number];

/** Situazione sentimentale richiesta da un evento: `partner` vale per qualsiasi relazione. */
export const RELATIONSHIP_STATES = ['single', 'partner', 'dating', 'engaged', 'married'] as const;

export const EVENT_CATEGORIES = [
  'dressing_room',
  'training',
  'media',
  'life',
  'family',
  'transfer',
  'business',
  'love',
] as const;

const range = z
  .object({ min: z.number().optional(), max: z.number().optional() })
  .refine((r) => r.min === undefined || r.max === undefined || r.min <= r.max, {
    message: 'min must be <= max',
  });

const statCondition = z
  .object({ path: statPathSchema, gte: z.number().optional(), lte: z.number().optional() })
  .refine((c) => c.gte !== undefined || c.lte !== undefined, { message: 'needs gte or lte' });

export const eventConditionsSchema = z
  .object({
    age: range.optional(),
    stats: z.array(statCondition).optional(),
    /** Finestra di mercato: estiva, invernale o chiusa. */
    window: z.enum(['summer', 'winter', 'closed']).optional(),
    flags: z.array(id).optional(),
    flagsNot: z.array(id).optional(),
    roles: z.array(z.enum(['GK', 'DEF', 'MID', 'ATT'])).optional(),
    /** Livello del campionato del club (1 = massima serie). */
    level: range.optional(),
    professional: z.boolean().optional(),
    traits: z.array(id).optional(),
    traitsNot: z.array(id).optional(),
    injured: z.boolean().optional(),
    /** Rapporto con l'allenatore del club (-100..100). */
    coachRelationship: range.optional(),
    /** Settimana all'interno della stagione (da 0). */
    seasonWeek: range.optional(),
    /** Il giocatore ha (o non ha) almeno un'attività aperta; `{business}` è la principale. */
    business: z.boolean().optional(),
    /** Situazione sentimentale; `{partner}` richiede una relazione. */
    relationship: z.enum(RELATIONSHIP_STATES).optional(),
    /** Affinità con il partner (0–100): vale solo se c'è un partner. */
    affinity: range.optional(),
    /** Il giocatore ha (o non ha) figli; `{child}` è il più giovane. */
    children: z.boolean().optional(),
    /** C'è (o non c'è) una storia segreta in corso. */
    affair: z.boolean().optional(),
  })
  .strict();

const effectBase = {
  stat: z.object({ type: z.literal('stat'), path: statPathSchema, delta: z.number() }),
  money: z.object({ type: z.literal('money'), delta: z.number() }),
  flag: z.object({
    type: z.literal('flag'),
    flag: id,
    /** Valore da impostare (predefinito: true); null rimuove il flag. */
    value: z.union([z.boolean(), z.number(), z.string(), z.null()]).optional(),
  }),
  relationship: z.object({
    type: z.literal('relationship'),
    target: z.enum(['coach', 'agent']),
    delta: z.number(),
  }),
  schedule: z.object({
    type: z.literal('schedule'),
    eventId: id,
    inWeeks: z.number().int().min(1),
  }),
  startTransfer: z.object({
    type: z.literal('startTransfer'),
    /** Destinazione rispetto al livello attuale (il mercato vero arriva in M7). */
    to: z.enum(['higher_level', 'same_level', 'lower_level']),
  }),
  injury: z.object({
    type: z.literal('injury'),
    injuryType: id,
    weeks: z
      .tuple([z.number().int().min(1), z.number().int().min(1)])
      .refine(([a, b]) => a <= b, { message: 'weeks min must be <= max' }),
  }),
  trait: z.object({ type: z.literal('trait'), traitId: id, action: z.enum(['add', 'remove']) }),
  /** Cambia l'andamento (0–100) dell'attività principale del giocatore. */
  business: z.object({ type: z.literal('business'), health: z.number() }),
  /** Cambia l'affinità con il partner (nessun effetto da single). */
  partner: z.object({ type: z.literal('partner'), affinity: z.number() }),
  /** Il giocatore conosce qualcuno: una persona da invitare a uscire (solo da single). */
  meet: z.object({ type: z.literal('meet') }),
  /** Inizia o chiude una storia segreta (iniziarla richiede un partner). */
  affair: z.object({ type: z.literal('affair'), action: z.enum(['start', 'end']) }),
  /** La relazione finisce (con le conseguenze di una separazione o di un divorzio). */
  breakup: z.object({ type: z.literal('breakup') }),
};

type BaseEffect = z.infer<(typeof effectBase)[keyof typeof effectBase]>;
/** Effetto con esito incerto: con probabilità `p` si applicano `effects`, altrimenti `otherwise`. */
export interface ChanceEffect {
  type: 'chance';
  p: number;
  effects: EventEffect[];
  otherwise?: EventEffect[];
}
export type EventEffect = BaseEffect | ChanceEffect;

export const eventEffectSchema: z.ZodType<EventEffect> = z.lazy(() =>
  z.discriminatedUnion('type', [
    effectBase.stat,
    effectBase.money,
    effectBase.flag,
    effectBase.relationship,
    effectBase.schedule,
    effectBase.startTransfer,
    effectBase.injury,
    effectBase.trait,
    effectBase.business,
    effectBase.partner,
    effectBase.meet,
    effectBase.affair,
    effectBase.breakup,
    z.object({
      type: z.literal('chance'),
      p: z.number().min(0).max(1),
      effects: z.array(eventEffectSchema).min(1),
      otherwise: z.array(eventEffectSchema).optional(),
    }),
  ]),
);

export const eventChoiceSchema = z.object({
  textKey,
  effects: z.array(eventEffectSchema),
});

export const eventSchema = z
  .object({
    id,
    category: z.enum(EVENT_CATEGORIES),
    conditions: eventConditionsSchema.optional(),
    /** Peso nell'estrazione casuale. */
    weight: z.number().positive(),
    /** Settimane prima che l'evento possa ripresentarsi. */
    cooldownWeeks: z.number().int().min(0),
    /** Al massimo una volta per carriera. */
    once: z.boolean().optional(),
    /** Mai estratto a caso: arriva solo tramite un effetto `schedule`. */
    chainOnly: z.boolean().optional(),
    /** Arriva quando succede il fatto indicato nella vita privata (richiede `chainOnly`). */
    trigger: z.enum(EVENT_TRIGGERS).optional(),
    /** Titolo in stile prima pagina. */
    titleKey: textKey,
    /** Testo; con più varianti le chiavi sono `<textKey>.1` ... `<textKey>.n`. */
    textKey,
    textVariants: z.number().int().min(1).optional(),
    choices: z.array(eventChoiceSchema).min(1).max(4),
  })
  .strict()
  .refine((e) => !e.trigger || e.chainOnly, { message: 'events with a trigger must be chainOnly' });

export const eventsSchema = z.array(eventSchema);

export type EventConditions = z.infer<typeof eventConditionsSchema>;
export type EventChoice = z.infer<typeof eventChoiceSchema>;
export type GameEvent = z.infer<typeof eventSchema>;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

/** Chiavi di testo di un evento, varianti comprese. */
export function eventTextKeys(event: GameEvent): string[] {
  const n = event.textVariants ?? 1;
  return n === 1
    ? [event.textKey]
    : Array.from({ length: n }, (_, i) => `${event.textKey}.${i + 1}`);
}

/** Tutti gli effetti di una scelta, compresi quelli annidati negli effetti `chance`. */
export function flattenEffects(effects: readonly EventEffect[]): EventEffect[] {
  return effects.flatMap((e) =>
    e.type === 'chance'
      ? [e, ...flattenEffects(e.effects), ...flattenEffects(e.otherwise ?? [])]
      : [e],
  );
}
