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

/** Overall rating: skills weighted by role (weights in config/ratings.json), rounded. */
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
