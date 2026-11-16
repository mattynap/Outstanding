import type { GameContext } from '../context';
import type { Rng } from '../rng';
import type { ForeignClub } from '../types';
import { clubRatingFromRoster, clubVisuals, generateRoster } from './club';
import type { IdGen } from './generate';

/**
 * Genera i club stranieri delle coppe europee: uno per città straniera dei contenuti, con nome
 * inventato (affisso del paese + epiteto della città), rosa con nomi del paese e forza per fascia.
 * Le città più grandi finiscono nelle fasce più forti.
 */
export function generateForeignClubs(
  rng: Rng,
  ids: IdGen,
  week: number,
  ctx: GameContext,
): ForeignClub[] {
  const { world: worldCfg, calendar, cups } = ctx.config;
  const { foreign, clubs: clubsData } = ctx.content;
  const needed = cups.foreign.tiers.reduce((sum, t) => sum + t.count, 0);
  // A parità di dimensione l'ordine è casuale (sort è stabile).
  const cities = rng
    .shuffle(foreign.flatMap((country) => country.cities.map((city) => ({ country, city }))))
    .sort((a, b) => b.city.size - a.city.size);
  if (cities.length < needed) {
    throw new Error(`${needed} foreign clubs needed, only ${cities.length} foreign cities`);
  }

  const clubs: ForeignClub[] = [];
  let index = 0;
  cups.foreign.tiers.forEach((tierCfg, tier) => {
    for (let i = 0; i < tierCfg.count; i++) {
      const { country, city } = cities[index++]!;
      const epithet = rng.pick(city.epithets);
      const affix = rng.pick(country.affixes);
      const prefix = country.nameFormat === 'prefix';
      const name = prefix ? `${affix.name} ${epithet}` : `${epithet} ${affix.name}`;
      const initials = (
        prefix ? affix.name.charAt(0) + epithet.charAt(0) : epithet.charAt(0) + affix.name.charAt(0)
      ).toUpperCase();
      const seed = rng.nextUint32();
      const { crest, kit } = clubVisuals(seed, initials, clubsData, worldCfg.kitPatternWeights);
      const target = rng.float(tierCfg.ratingRange[0], tierCfg.ratingRange[1]);
      const roster = generateRoster(
        target,
        worldCfg,
        country.firstNames,
        country.lastNames,
        calendar.weeksPerSeason,
        week,
        rng,
        () => ids.make('r'),
      );
      clubs.push({
        id: ids.make('c'),
        name,
        shortName: epithet,
        city: city.name,
        country: country.id,
        tier,
        seed,
        crest,
        kit,
        rating: clubRatingFromRoster(roster, worldCfg.formation),
        roster,
      });
    }
  });
  return clubs;
}
