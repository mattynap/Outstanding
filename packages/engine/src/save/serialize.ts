import type { GameState } from '../types';

/** Current save format version. Bump it and add a migration whenever GameState changes shape. */
export const CURRENT_SAVE_VERSION = 1;

/** A migration upgrades a raw save object from version N to version N + 1. */
export type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/**
 * migrations[n] upgrades a save from version n to n + 1.
 * Example for a future version 2:  `1: (raw) => ({ ...raw, newField: default, saveVersion: 2 })`.
 */
export const migrations: Record<number, Migration> = {};

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

/** Applies all migrations needed to bring `raw` to `target` version. */
export function migrate(
  raw: Record<string, unknown>,
  target = CURRENT_SAVE_VERSION,
  table: Record<number, Migration> = migrations,
): Record<string, unknown> {
  let current = raw;
  let version = current['saveVersion'];
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new Error('Invalid save: missing saveVersion');
  }
  if (version > target) {
    throw new Error(`Save version ${version} is newer than supported version ${target}`);
  }
  while (version < target) {
    const step = table[version];
    if (!step) throw new Error(`No migration from save version ${version}`);
    current = step(current);
    if (current['saveVersion'] !== version + 1) {
      throw new Error(`Migration from version ${version} did not set saveVersion ${version + 1}`);
    }
    version += 1;
  }
  return current;
}

function assertShape(
  raw: Record<string, unknown>,
): asserts raw is Record<string, unknown> & GameState {
  const fail = (what: string) => {
    throw new Error(`Invalid save: ${what}`);
  };
  if (typeof raw['seed'] !== 'number') fail('seed');
  const rng = raw['rngState'];
  if (!Array.isArray(rng) || rng.length !== 4 || !rng.every((w) => typeof w === 'number')) {
    fail('rngState');
  }
  if (typeof raw['week'] !== 'number' || typeof raw['season'] !== 'number') fail('week/season');
  const player = raw['player'];
  if (typeof player !== 'object' || player === null) fail('player');
  const world = raw['world'];
  if (typeof world !== 'object' || world === null) fail('world');
  if (!Array.isArray(raw['calendar'])) fail('calendar');
}

export function deserialize(json: string): GameState {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('Invalid save: not valid JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Invalid save: not an object');
  }
  const migrated = migrate(raw as Record<string, unknown>);
  assertShape(migrated);
  return migrated;
}
