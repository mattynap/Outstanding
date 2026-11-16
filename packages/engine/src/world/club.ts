import type { WorldConfig } from '@outstanding/config';
import type { City, ClubsData } from '@outstanding/content';
import { Rng } from '../rng';
import type { Crest, CrestShape, Kit, KitPattern, Role, RosterPlayer } from '../types';
import { ROLES } from '../player/ratings';

const CREST_SHAPES: readonly CrestShape[] = ['shield', 'circle', 'oval'];
const KIT_PATTERNS: readonly KitPattern[] = ['solid', 'vstripes', 'hstripes', 'sash'];

/**
 * Procedural crest and kit, fully determined by the club seed and the content palette.
 * The app turns this data into SVG.
 */
export function clubVisuals(
  seed: number,
  initials: string,
  clubs: ClubsData,
  patternWeights: WorldConfig['kitPatternWeights'],
): { crest: Crest; kit: Kit } {
  const rng = Rng.fromSeed(seed);
  const primary = rng.pick(clubs.colors);
  const secondary = rng.pick(clubs.colors.filter((c) => c.id !== primary.id));
  const shape = rng.pick(CREST_SHAPES);
  const symbol = rng.pick(clubs.symbols);
  const pattern = rng.weighted(KIT_PATTERNS, (p) => patternWeights[p]);
  return {
    crest: { shape, primary: primary.hex, secondary: secondary.hex, symbol, initials },
    kit: { primary: primary.hex, secondary: secondary.hex, pattern },
  };
}

/** Builds a unique invented club name from a prefix and one of the city's epithets. */
export function pickClubName(
  city: City,
  clubs: ClubsData,
  usedNames: Set<string>,
  usedShortNames: Set<string>,
  rng: Rng,
): { name: string; shortName: string; initials: string } {
  const combos = rng.shuffle(
    city.epithets.flatMap((epithet) => clubs.prefixes.map((prefix) => ({ prefix, epithet }))),
  );
  const free = combos.find((c) => !usedNames.has(`${c.prefix.name} ${c.epithet}`));
  if (!free) throw new Error(`No free club name left for ${city.name}`);
  const name = `${free.prefix.name} ${free.epithet}`;
  let shortName = free.epithet;
  if (usedShortNames.has(shortName)) shortName = `${free.prefix.short} ${free.epithet}`;
  usedNames.add(name);
  usedShortNames.add(shortName);
  const initials = (free.prefix.name.charAt(0) + free.epithet.charAt(0)).toUpperCase();
  return { name, shortName, initials };
}

/** Generates a compact roster around a target strength. */
export function generateRoster(
  target: number,
  cfg: WorldConfig,
  firstNames: readonly string[],
  lastNames: readonly string[],
  weeksPerYear: number,
  week: number,
  rng: Rng,
  nextId: () => string,
): RosterPlayer[] {
  const roster: RosterPlayer[] = [];
  const [minAge, maxAge] = cfg.roster.ageRange;
  for (const role of ROLES) {
    for (let i = 0; i < cfg.roster.composition[role]; i++) {
      const age = rng.int(minAge, maxAge);
      roster.push({
        id: nextId(),
        firstName: rng.pick(firstNames),
        lastName: rng.pick(lastNames),
        role,
        birthWeek: week - age * weeksPerYear - rng.int(0, weeksPerYear - 1),
        ovr: Math.round(Math.min(99, Math.max(1, rng.normal(target, cfg.roster.ovrSpread)))),
      });
    }
  }
  return roster;
}

/** Club strength: average OVR of the best eleven according to the formation. */
export function clubRatingFromRoster(
  roster: readonly RosterPlayer[],
  formation: Record<Role, number>,
): number {
  let total = 0;
  let count = 0;
  for (const role of ROLES) {
    const best = roster
      .filter((p) => p.role === role)
      .map((p) => p.ovr)
      .sort((a, b) => b - a)
      .slice(0, formation[role]);
    for (const ovr of best) total += ovr;
    count += best.length;
  }
  return count === 0 ? 0 : Math.round(total / count);
}
