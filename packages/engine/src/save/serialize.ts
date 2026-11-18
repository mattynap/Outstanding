import { defaultContext, type GameContext } from '../context';
import { completeAppearance } from '../player/look';
import type { GameState } from '../types';

/** Versione corrente del formato di salvataggio. Va incrementata, con una migrazione, a ogni cambio di forma di GameState. */
export const CURRENT_SAVE_VERSION = 2;

/** Una migrazione aggiorna un salvataggio grezzo dalla versione N alla versione N + 1. */
export type Migration = (raw: Record<string, unknown>, ctx: GameContext) => Record<string, unknown>;

// Il salvataggio grezzo è per definizione non tipizzato.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

/** Minuti per blocco del formato v1: valore congelato, non letto dalla config. */
const V1_MINUTES_PER_BLOCK = 15;
const V1_TOTAL_MINUTES = 90;

/**
 * Parte A: la partita passa da blocchi a minuti, con regista, pressione e dinamiche.
 * I gol di un blocco in v1 sono estratti prima dei suoi momenti: con un momento aperto quelli dopo
 * il suo minuto non sono ancora avvenuti, quindi si tolgono (verranno risimulati). `rngState` resta com'è.
 */
function migrateMatchV1(m: Json, ctx: GameContext): Json {
  const { blocksDone, momentMinutes, ...rest } = m;
  const pending = m['pending'] as Json | null;
  const planned = (momentMinutes as number[]) ?? [];
  const oldEvents = (m['events'] as Json[]) ?? [];

  let events = oldEvents;
  let score = m['score'];
  if (pending) {
    events = oldEvents.filter((e) => e['kind'] !== 'goal' || e['minute'] <= pending['minute']);
    for (const e of oldEvents) {
      if (
        e['kind'] === 'goal' &&
        e['minute'] > pending['minute'] &&
        (e['byPlayer'] || e['assistByPlayer'])
      ) {
        throw new Error('Invalid save: goal of the player after the pending moment');
      }
    }
    const next = { home: 0, away: 0 };
    for (const e of events) if (e['kind'] === 'goal') next[e['side'] as 'home' | 'away'] += 1;
    score = next;
  }
  events = events.map((e) => (e['kind'] === 'moment' ? { quality: 0.5, ...e } : e));

  const minute = pending
    ? (pending['minute'] as number)
    : Math.min((blocksDone as number) * V1_MINUTES_PER_BLOCK, V1_TOTAL_MINUTES);

  const played = events.filter((e) => e['kind'] === 'moment');
  const interventions = played.length + (pending ? 1 : 0);
  const lastTypes = [
    ...played.map((e) => e['momentId'] as string),
    ...(pending ? [pending['momentId'] as string] : []),
  ].slice(-3);
  const lastAt = pending
    ? (pending['minute'] as number)
    : played.length > 0
      ? (played[played.length - 1]!['minute'] as number)
      : null;

  let nextPending: Json | null = null;
  if (pending) {
    const type = ctx.config.match.moments.types.find((t) => t.id === pending['momentId']);
    if (!type) throw new Error(`Invalid save: unknown key moment "${pending['momentId']}"`);
    nextPending = { ...pending, options: type.options.map((_, i) => i) };
  }

  return {
    ...rest,
    minute,
    mode: 'full',
    pressure: 0,
    trace: Array<number>(minute).fill(0),
    director: {
      budgetStart: planned.length + interventions,
      budgetLeft: planned.length,
      hotLeft: null,
      lastAt,
      interventions,
      armed: null,
      relaxUntil: null,
      lastTypes,
      legendsUsed: 0,
      peak: null,
    },
    dyn: { coachTrust: 0, nerves: 0, fatigue: 0, marking: 0 },
    stakes: 0,
    legend: null,
    score,
    events,
    pending: nextPending,
  };
}

/**
 * migrations[n] aggiorna un salvataggio dalla versione n alla n + 1.
 * Dentro una parte del piano non si incrementa la versione: si estende la migrazione della parte.
 */
export const migrations: Record<number, Migration> = {
  1: (raw, ctx) => {
    const m = raw['currentMatch'];
    const next: Json = { ...raw, saveVersion: 2 };
    if (m !== undefined && m !== null) next['currentMatch'] = migrateMatchV1(m as Json, ctx);
    return next;
  },
};

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

/** Applica tutte le migrazioni necessarie per portare `raw` alla versione `target`. */
export function migrate(
  raw: Record<string, unknown>,
  target = CURRENT_SAVE_VERSION,
  table: Record<number, Migration> = migrations,
  ctx: GameContext = defaultContext,
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
    current = step(current, ctx);
    if (current['saveVersion'] !== version + 1) {
      throw new Error(`Migration from version ${version} did not set saveVersion ${version + 1}`);
    }
    version += 1;
  }
  return current;
}

const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const isNumOrNull = (v: unknown) => v === null || isNum(v);
const isObjOrNull = (v: unknown) => v === null || (typeof v === 'object' && !Array.isArray(v));

function armedOk(a: unknown): boolean {
  if (a === null) return true;
  if (typeof a !== 'object' || a === undefined || Array.isArray(a)) return false;
  const x = a as Json;
  return (
    isNum(x['at']) &&
    typeof x['momentId'] === 'string' &&
    (x['forced'] === undefined || typeof x['forced'] === 'boolean')
  );
}

function directorOk(d: Json): boolean {
  return (
    isNum(d['budgetStart']) &&
    isNum(d['budgetLeft']) &&
    isNumOrNull(d['hotLeft']) &&
    isNumOrNull(d['lastAt']) &&
    isNum(d['interventions']) &&
    armedOk(d['armed']) &&
    isNumOrNull(d['relaxUntil']) &&
    Array.isArray(d['lastTypes']) &&
    d['lastTypes'].every((t: unknown) => typeof t === 'string') &&
    isNum(d['legendsUsed']) &&
    isObjOrNull(d['peak']) &&
    d['peak'] !== undefined
  );
}

function pendingOk(p: Json | null | undefined): boolean {
  if (p === null || p === undefined) return true;
  return Array.isArray(p['options']) && p['options'].every(isNum);
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
  if (!Array.isArray(raw['cups'])) fail('cups');
  if (!Array.isArray((world as Record<string, unknown>)['foreignClubs']))
    fail('world.foreignClubs');
  const match = raw['currentMatch'];
  if (match !== undefined && match !== null) {
    const m = match as Json;
    const num = (v: unknown) => typeof v === 'number';
    const ok =
      typeof match === 'object' &&
      num(m['minute']) &&
      ['full', 'quick', 'sim'].includes(m['mode']) &&
      num(m['pressure']) &&
      Array.isArray(m['trace']) &&
      typeof m['director'] === 'object' &&
      m['director'] !== null &&
      directorOk(m['director']) &&
      pendingOk(m['pending']) &&
      typeof m['dyn'] === 'object' &&
      m['dyn'] !== null &&
      num(m['stakes']) &&
      Array.isArray(m['events']) &&
      typeof m['score'] === 'object' &&
      m['score'] !== null;
    if (!ok) fail('currentMatch');
  }
}

export function deserialize(json: string, ctx: GameContext = defaultContext): GameState {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('Invalid save: not valid JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Invalid save: not an object');
  }
  const migrated = migrate(raw as Record<string, unknown>, CURRENT_SAVE_VERSION, migrations, ctx);
  assertShape(migrated);
  // Salvataggi precedenti alle parti nuove dell'avatar: si completano con i valori predefiniti.
  const player = migrated.player;
  return { ...migrated, player: { ...player, appearance: completeAppearance(player.appearance) } };
}
