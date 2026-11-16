import type { RatingsConfig } from '@outstanding/config';
import type { Role, Skill, Skills } from '../types';

export const SKILLS: readonly Skill[] = [
  'pace',
  'shooting',
  'passing',
  'dribbling',
  'defending',
  'physical',
  'vision',
  'goalkeeping',
];

export const ROLES: readonly Role[] = ['GK', 'DEF', 'MID', 'ATT'];

/** Valutazione complessiva (OVR): abilità pesate per ruolo (pesi in config/ratings.json), arrotondata. */
export function computeOvr(skills: Skills, role: Role, ratings: RatingsConfig): number {
  const weights = ratings.roleWeights[role];
  let total = 0;
  let weightSum = 0;
  for (const s of SKILLS) {
    total += skills[s] * weights[s];
    weightSum += weights[s];
  }
  return Math.round(total / weightSum);
}
