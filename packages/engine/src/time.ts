import type { CalendarConfig } from '@outstanding/config';

/** Age in whole years at an absolute week. */
export function ageAt(birthWeek: number, week: number, cal: CalendarConfig): number {
  return Math.floor((week - birthWeek) / cal.weeksPerSeason);
}

/** First absolute week of a season (seasons start at 1). */
export function seasonStartWeek(season: number, cal: CalendarConfig): number {
  return (season - 1) * cal.weeksPerSeason;
}

/** Week number inside the current season (0-based). */
export function weekOfSeason(week: number, cal: CalendarConfig): number {
  return ((week % cal.weeksPerSeason) + cal.weeksPerSeason) % cal.weeksPerSeason;
}
