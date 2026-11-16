import type { GameContent } from './index';

/**
 * Cross-file content checks that a schema alone cannot express.
 * Returns a list of human-readable problems (empty when everything is fine).
 */
export function checkContent(content: GameContent): string[] {
  const errors: string[] = [];
  const t = content.i18n.it;

  const dupes = (label: string, values: string[]) => {
    const seen = new Set<string>();
    for (const v of values) {
      if (seen.has(v)) errors.push(`${label}: duplicate "${v}"`);
      seen.add(v);
    }
  };

  dupes('names.firstNames', content.names.firstNames);
  dupes('names.lastNames', content.names.lastNames);
  dupes(
    'traits',
    content.traits.map((tr) => tr.id),
  );

  dupes(
    'cities',
    content.cities.map((c) => c.name),
  );
  for (const city of content.cities) dupes(`cities.${city.name}.epithets`, city.epithets);
  dupes(
    'clubs.prefixes',
    content.clubs.prefixes.map((p) => p.name),
  );
  dupes(
    'clubs.colors',
    content.clubs.colors.map((c) => c.id),
  );
  dupes('clubs.symbols', content.clubs.symbols);

  for (const trait of content.traits) {
    for (const key of [`traits.${trait.id}.name`, `traits.${trait.id}.desc`]) {
      if (!(key in t)) errors.push(`traits: missing text key "${key}"`);
    }
  }

  return errors;
}
