import { EVENT_PLACEHOLDERS, eventTextKeys, flattenEffects } from './events';
import type { GameContent } from './index';

/**
 * Controlli incrociati tra file che uno schema da solo non può esprimere.
 * Restituisce un elenco di problemi leggibili (vuoto se è tutto a posto).
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

  dupes(
    'foreign',
    content.foreign.map((c) => c.id),
  );
  for (const country of content.foreign) {
    const label = `foreign.${country.id}`;
    if (!(`countries.${country.id}.name` in t)) {
      errors.push(`${label}: missing text key "countries.${country.id}.name"`);
    }
    dupes(
      `${label}.cities`,
      country.cities.map((c) => c.name),
    );
    dupes(
      `${label}.affixes`,
      country.affixes.map((a) => a.name),
    );
    dupes(`${label}.firstNames`, country.firstNames);
    dupes(`${label}.lastNames`, country.lastNames);
  }
  dupes(
    'foreign epithets',
    content.foreign.flatMap((c) => c.cities.flatMap((city) => city.epithets)),
  );

  dupes(
    'sponsors',
    content.sponsors.map((s) => s.id),
  );
  for (const cat of new Set(content.sponsors.map((s) => s.category))) {
    if (!(`sponsors.categories.${cat}` in t)) {
      errors.push(`sponsors: missing text key "sponsors.categories.${cat}"`);
    }
  }
  checkEvents(content, errors);
  return errors;
}

/** Controlli sugli eventi: id, chiavi di testo, segnaposto, catene e riferimenti ai tratti. */
function checkEvents(content: GameContent, errors: string[]): void {
  const t = content.i18n.it;
  const ids = new Set<string>();
  for (const e of content.events) {
    if (ids.has(e.id)) errors.push(`events: duplicate id "${e.id}"`);
    ids.add(e.id);
  }
  const traitIds = new Set(content.traits.map((tr) => tr.id));
  const allowed = new Set<string>(EVENT_PLACEHOLDERS);
  const scheduled = new Set<string>();

  for (const e of content.events) {
    const where = `events.${e.id}`;
    const keys = [e.titleKey, ...eventTextKeys(e), ...e.choices.map((c) => c.textKey)];
    for (const key of keys) {
      const text = t[key];
      if (text === undefined) {
        errors.push(`${where}: missing text key "${key}"`);
        continue;
      }
      for (const [, name] of text.matchAll(/\{(\w+)\}/g)) {
        if (!allowed.has(name!)) errors.push(`${where}: unknown placeholder {${name}} in "${key}"`);
      }
    }
    const traitRefs = [...(e.conditions?.traits ?? []), ...(e.conditions?.traitsNot ?? [])];
    for (const choice of e.choices) {
      for (const effect of flattenEffects(choice.effects)) {
        if (effect.type === 'schedule') {
          scheduled.add(effect.eventId);
          if (!ids.has(effect.eventId)) {
            errors.push(`${where}: schedules unknown event "${effect.eventId}"`);
          }
        }
        if (effect.type === 'trait') traitRefs.push(effect.traitId);
      }
    }
    for (const id of traitRefs) {
      if (!traitIds.has(id)) errors.push(`${where}: unknown trait "${id}"`);
    }
  }
  for (const e of content.events) {
    if (e.chainOnly && !scheduled.has(e.id)) {
      errors.push(`events.${e.id}: chainOnly event is never scheduled`);
    }
  }
}
