export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const clampPct = (value: number) => clamp(value, 0, 100);

export const round1 = (value: number) => Math.round(value * 10) / 10;

/** Rounds to the nearest multiple of `step` (e.g. 0.5 for match ratings). */
export const roundTo = (value: number, step: number) => Math.round(value / step) * step;

export const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);
