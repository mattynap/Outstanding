import type { CalendarConfig } from '@outstanding/config';

/** Età in anni compiuti a una settimana assoluta. */
export function ageAt(birthWeek: number, week: number, cal: CalendarConfig): number {
  return Math.floor((week - birthWeek) / cal.weeksPerSeason);
}

/** Prima settimana assoluta di una stagione (le stagioni partono da 1). */
export function seasonStartWeek(season: number, cal: CalendarConfig): number {
  return (season - 1) * cal.weeksPerSeason;
}

/** Numero della settimana all'interno della stagione (da 0). */
export function weekOfSeason(week: number, cal: CalendarConfig): number {
  return ((week % cal.weeksPerSeason) + cal.weeksPerSeason) % cal.weeksPerSeason;
}
