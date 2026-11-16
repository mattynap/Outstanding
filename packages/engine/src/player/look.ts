import type { Tattoo, TattooZone } from '@outstanding/content';
import { TATTOO_ZONES } from '@outstanding/content';
import { careerTotals } from '../career/score';
import { defaultContext, type GameContext } from '../context';
import { ageAt } from '../time';
import type { Appearance, AppearanceIndices, GameState } from '../types';

/** Per ogni parte scelta per indice, la lista di content/avatar.json da cui prende il valore. */
export const APPEARANCE_LISTS = {
  skin: 'skinTones',
  hairColor: 'hairColors',
  hairStyle: 'hairStyles',
  face: 'faceShapes',
  beard: 'beards',
  body: 'bodies',
  eyes: 'eyeShapes',
  eyeColor: 'eyeColors',
  brows: 'brows',
  nose: 'noses',
  earring: 'earrings',
  necklace: 'necklaces',
  headband: 'headbands',
} as const satisfies Record<keyof AppearanceIndices, string>;

export type AppearancePart = keyof AppearanceIndices;
export const APPEARANCE_PARTS = Object.keys(APPEARANCE_LISTS) as AppearancePart[];

/** Parti che si scelgono solo alla creazione: in carriera non cambiano. */
export const FIXED_PARTS: readonly AppearancePart[] = [
  'skin',
  'face',
  'body',
  'eyes',
  'eyeColor',
  'nose',
];

/** Parti che il barbiere e gli accessori possono cambiare in carriera (a pagamento). */
export const STYLE_PARTS: readonly AppearancePart[] = APPEARANCE_PARTS.filter(
  (p) => !FIXED_PARTS.includes(p),
);

/** Valori delle parti aggiunte dopo i primi salvataggi (e mai estratte a caso alla creazione). */
const LATER_DEFAULTS: Omit<Appearance, 'skin' | 'hairColor' | 'hairStyle' | 'face' | 'beard'> = {
  body: 1,
  eyes: 0,
  eyeColor: 0,
  brows: 0,
  nose: 1,
  earring: 0,
  necklace: 0,
  headband: 0,
  tattoos: {},
  ageing: true,
};

/** Numero di varianti di ogni parte scelta per indice. */
export function appearanceSizes(ctx: GameContext): Record<AppearancePart, number> {
  const out = {} as Record<AppearancePart, number>;
  for (const part of APPEARANCE_PARTS)
    out[part] = ctx.content.avatar[APPEARANCE_LISTS[part]].length;
  return out;
}

/** Completa un aspetto salvato prima che esistessero le parti nuove. */
export function completeAppearance(raw: Partial<Appearance>): Appearance {
  const base = { skin: 0, hairColor: 0, hairStyle: 0, face: 0, beard: 0, ...LATER_DEFAULTS };
  return { ...base, ...raw, tattoos: { ...(raw.tattoos ?? {}) } } as Appearance;
}

export function getTattoo(id: string, ctx: GameContext): Tattoo {
  const t = ctx.content.avatar.tattoos.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown tattoo "${id}"`);
  return t;
}

/**
 * Vero se il tatuaggio si può fare. Alla creazione (`state` assente) valgono solo quelli senza
 * condizione; in carriera quelli la cui condizione è raggiunta.
 */
export function tattooUnlocked(
  tattoo: Tattoo,
  state: GameState | null,
  ctx: GameContext = defaultContext,
): boolean {
  const u = tattoo.unlock;
  if (!u) return true;
  if (!state) return false;
  const p = state.player;
  const totals = careerTotals(p.history);
  switch (u.type) {
    case 'age':
      return ageAt(p.birthWeek, state.week, ctx.config.calendar) >= u.min;
    case 'appearances':
      return totals.appearances + p.seasonStats.appearances >= u.min;
    case 'trophies':
      return totals.trophies.length >= u.min;
    case 'topLevel':
      return totals.topLevelSeasons > 0;
  }
}

/** Lancia un errore se l'aspetto ha indici fuori lista o tatuaggi sconosciuti o fuori zona. */
export function validateAppearance(a: Partial<Appearance>, ctx: GameContext): void {
  const sizes = appearanceSizes(ctx);
  for (const [part, value] of Object.entries(a)) {
    if (part === 'tattoos' || part === 'ageing') continue;
    const size = sizes[part as AppearancePart];
    if (size === undefined) throw new Error(`Unknown appearance part "${part}"`);
    if (!Number.isInteger(value) || (value as number) < 0 || (value as number) >= size) {
      throw new Error(`Invalid appearance ${part}: ${String(value)}`);
    }
  }
  if (a.ageing !== undefined && typeof a.ageing !== 'boolean') throw new Error('Invalid ageing');
  for (const [zone, id] of Object.entries(a.tattoos ?? {})) {
    if (!TATTOO_ZONES.includes(zone as TattooZone)) throw new Error(`Unknown zone "${zone}"`);
    if (id === undefined) continue;
    if (!getTattoo(id, ctx).zones.includes(zone as TattooZone)) {
      throw new Error(`Tattoo "${id}" does not fit zone "${zone}"`);
    }
  }
}

/** Costo di un cambio di aspetto in carriera: un taglio per le parti di stile, poi ogni tatuaggio. */
export function lookChangeCost(from: Appearance, to: Appearance, ctx: GameContext): number {
  const c = ctx.config.look;
  let cost = STYLE_PARTS.some((p) => from[p] !== to[p]) ? c.styleChangeCost : 0;
  for (const zone of TATTOO_ZONES) {
    const before = from.tattoos[zone];
    const after = to.tattoos[zone];
    if (after && after !== before) cost += c.tattooCost;
    else if (before && !after) cost += c.tattooRemovalCost;
  }
  return cost;
}

/**
 * Cambia l'aspetto in carriera (barbiere, accessori, tatuatore) e paga il conto. Le parti fisse
 * non cambiano; i tatuaggi nuovi devono essere sbloccati.
 */
export function changeLook(
  state: GameState,
  next: Appearance,
  ctx: GameContext = defaultContext,
): { state: GameState; cost: number } {
  if (state.retired) throw new Error('Career is over');
  validateAppearance(next, ctx);
  const cur = state.player.appearance;
  for (const part of FIXED_PARTS) {
    if (next[part] !== cur[part]) throw new Error(`Appearance part "${part}" cannot change`);
  }
  for (const zone of TATTOO_ZONES) {
    const id = next.tattoos[zone];
    if (id && id !== cur.tattoos[zone] && !tattooUnlocked(getTattoo(id, ctx), state, ctx)) {
      throw new Error(`Tattoo "${id}" is locked`);
    }
  }
  const cost = lookChangeCost(cur, next, ctx);
  if (cost > state.player.money.cash) throw new Error('Not enough money');
  const tattoos: Appearance['tattoos'] = {};
  for (const zone of TATTOO_ZONES) {
    const id = next.tattoos[zone];
    if (id) tattoos[zone] = id;
  }
  const player = {
    ...state.player,
    appearance: { ...next, tattoos },
    money: { ...state.player.money, cash: state.player.money.cash - cost },
  };
  return { state: { ...state, player }, cost };
}
