import { z } from 'zod';
import { eventConditionsSchema } from './events';

/** Cosa si misura per decidere se l'obiettivo del capitolo è raggiunto. */
export const CHAPTER_GOAL_METRICS = [
  'starts',
  'goals',
  'assists',
  'avgRating',
  'cleanSheets',
  'pickGoal',
  'tablePosition',
] as const;

export const chapterGoalSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_]+$/, 'ids use lowercase letters, digits and underscores'),
    weight: z.number().positive(),
    /** Stesso formato delle condizioni degli eventi (ruolo, età, livello, rapporto col mister...). */
    conditions: eventConditionsSchema.optional(),
    metric: z.enum(CHAPTER_GOAL_METRICS),
    /** Soglia: per `tablePosition` è la posizione massima (1 = prima). */
    target: z.number().positive(),
    textKey: z.string().regex(/^[A-Za-z0-9_.]+$/, 'text keys use dotted ids'),
  })
  .strict();

export const chapterGoalsSchema = z.array(chapterGoalSchema).min(1);

export type ChapterGoalMetric = (typeof CHAPTER_GOAL_METRICS)[number];
export type ChapterGoal = z.infer<typeof chapterGoalSchema>;

/** Segnaposto ammessi nei testi di un obiettivo (testo, esito raggiunto, esito mancato). */
export const CHAPTER_GOAL_PLACEHOLDERS = ['firstName', 'lastName', 'club', 'target'] as const;

/** Chiavi di esito di un obiettivo: `<textKey senza .text>.met` e `.missed`. */
export function chapterGoalOutcomeKey(goal: Pick<ChapterGoal, 'textKey'>, met: boolean): string {
  return goal.textKey.replace(/\.text$/, met ? '.met' : '.missed');
}
