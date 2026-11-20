import { CHAPTER_GOAL_PLACEHOLDERS, chapterGoalOutcomeKey } from './chapterGoals';
import { EVENT_PLACEHOLDERS, EVENT_TRIGGERS, eventTextKeys, flattenEffects } from './events';
import type { GameContent } from './index';
import type { Translations } from './schemas';

/** Fasi delle righe di preavviso della partita (`match.buildup.<fase>.<n>`). */
export const BUILDUP_PHASES = ['attack', 'defense'] as const;
/** Righe minime per fase: la cronaca non deve ripetersi troppo presto. */
export const BUILDUP_MIN_LINES = 4;

/** Quante righe di preavviso consecutive (da 1) esistono per una fase. */
export function buildupLines(t: Translations, phase: (typeof BUILDUP_PHASES)[number]): number {
  let n = 0;
  while (`match.buildup.${phase}.${n + 1}` in t) n++;
  return n;
}

/** Righe di chiusura della pagella dal passo decisivo (`match.peak.<esito>.<n>`). */
export function checkPeakKeys(variants: number, t: Translations): string[] {
  const errors: string[] = [];
  for (const kind of ['success', 'failure']) {
    for (let i = 1; i <= variants; i++) {
      const key = `match.peak.${kind}.${i}`;
      if (!(key in t)) errors.push(`match: missing text "${key}"`);
    }
  }
  return errors;
}

/** Esiti di ogni titolo di prima pagina: le chiavi sono `headlines.<tipo>[.<esito>].<n>`. */
export const HEADLINE_SUBS: Record<string, readonly string[]> = {
  legend: ['success', 'failure'],
  peak: ['success', 'failure'],
  rating: [],
  table: ['promotion', 'relegation', 'safe', 'slip'],
  event: [],
  result: ['win', 'draw', 'loss'],
};

/** Testi dei titoli di prima pagina: ogni tipo ed esito ha tutte le varianti. */
export function checkHeadlineKeys(variants: number, t: Translations): string[] {
  const errors: string[] = [];
  for (const [kind, subs] of Object.entries(HEADLINE_SUBS)) {
    for (const sub of subs.length > 0 ? subs : [null]) {
      for (let i = 1; i <= variants; i++) {
        const key = `headlines.${kind}${sub ? `.${sub}` : ''}.${i}`;
        if (!(key in t)) errors.push(`headlines: missing text "${key}"`);
      }
    }
  }
  return errors;
}

/** Testi di ogni gesto da leggenda (`match.legends.<id>.<parte>`). */
export const LEGEND_KEYS = ['option', 'success', 'failure', 'headline'] as const;

/** Forma minima di un tipo di momento chiave (da `config/data/moments.json`) per i testi. */
export interface MomentTextSource {
  id: string;
  textVariants: number;
  options: readonly { id: string; legend?: { id: string } }[];
}

/**
 * Chiavi di testo dei momenti chiave: ogni variante e ogni opzione di ogni tipo, compresi i
 * passi di catena (`chainOnly`). I tipi arrivano dalla config: il pacchetto non ne dipende.
 */
export function checkMomentKeys(types: readonly MomentTextSource[], t: Translations): string[] {
  const errors: string[] = [];
  for (const type of types) {
    for (let i = 1; i <= type.textVariants; i++) {
      const key = `match.moments.${type.id}.text.${i}`;
      if (!(key in t)) errors.push(`moment ${type.id}: missing text "${key}"`);
    }
    for (const o of type.options) {
      if (o.legend) {
        for (const part of LEGEND_KEYS) {
          const key = `match.legends.${o.legend.id}.${part}`;
          if (!(key in t)) errors.push(`legend ${o.legend.id}: missing text "${key}"`);
        }
        continue;
      }
      const key = `match.moments.${type.id}.options.${o.id}`;
      if (!(key in t)) errors.push(`moment ${type.id}: missing text "${key}"`);
    }
  }
  return errors;
}

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

  const av = content.avatar;
  for (const [kind, ids] of [
    ['hairStyles', av.hairStyles],
    ['faceShapes', av.faceShapes],
    ['beards', av.beards],
    ['bodies', av.bodies],
    ['eyeShapes', av.eyeShapes],
    ['brows', av.brows],
    ['noses', av.noses],
    ['earrings', av.earrings],
    ['necklaces', av.necklaces],
    ['headbands', av.headbands],
    ['tattoos', av.tattoos.map((x) => x.id)],
  ] as const) {
    dupes(`avatar.${kind}`, [...ids]);
    for (const part of ids) {
      if (!(`avatar.${kind}.${part}` in t)) {
        errors.push(`avatar: missing text key "avatar.${kind}.${part}"`);
      }
    }
  }

  if (av.ageing.fullGreyAge <= av.ageing.greyFromAge) {
    errors.push('avatar: ageing.fullGreyAge must be after greyFromAge');
  }
  if (!av.tattoos.some((x) => !x.unlock)) errors.push('avatar: no tattoo available at creation');

  dupes(
    'sponsors',
    content.sponsors.map((s) => s.id),
  );
  for (const cat of new Set(content.sponsors.map((s) => s.category))) {
    if (!(`sponsors.categories.${cat}` in t)) {
      errors.push(`sponsors: missing text key "sponsors.categories.${cat}"`);
    }
  }
  const pc = content.private;
  dupes('private.femaleFirstNames', pc.femaleFirstNames);
  dupes('private.jobs', pc.jobs);
  for (const job of pc.jobs) {
    for (const g of ['f', 'm']) {
      if (!(`private.jobs.${job}.${g}` in t)) {
        errors.push(`private: missing text key "private.jobs.${job}.${g}"`);
      }
    }
  }
  for (const phase of BUILDUP_PHASES) {
    const n = buildupLines(t, phase);
    if (n < BUILDUP_MIN_LINES) {
      errors.push(`match: ${n} buildup lines for "${phase}", need ${BUILDUP_MIN_LINES}`);
    }
  }
  checkMedia(content, errors);
  checkChapterGoals(content, errors);
  checkEvents(content, errors);
  return errors;
}

/** Il rischio infortuni non esiste più: la freschezza (`condition.energy`) lo ha assorbito. */
const REMOVED_STAT_PATH = 'condition.injuryRisk';
const REMOVED_STAT_MESSAGE = `"${REMOVED_STAT_PATH}" is removed, use "condition.energy" (freshness, opposite sign)`;

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
        if (name === 'business' && e.conditions?.business !== true) {
          errors.push(`${where}: {business} needs the condition "business": true`);
        }
        const rel = e.conditions?.relationship;
        if (name === 'partner' && (!rel || rel === 'single')) {
          errors.push(`${where}: {partner} needs a relationship condition`);
        }
        if (name === 'child' && e.conditions?.children !== true) {
          errors.push(`${where}: {child} needs the condition "children": true`);
        }
      }
    }
    for (const c of e.conditions?.stats ?? []) {
      if (c.path === REMOVED_STAT_PATH) errors.push(`${where}: ${REMOVED_STAT_MESSAGE}`);
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
        if (effect.type === 'stat' && effect.path === REMOVED_STAT_PATH) {
          errors.push(`${where}: ${REMOVED_STAT_MESSAGE}`);
        }
        if (effect.type === 'trait') traitRefs.push(effect.traitId);
      }
    }
    for (const id of traitRefs) {
      if (!traitIds.has(id)) errors.push(`${where}: unknown trait "${id}"`);
    }
  }
  for (const trigger of EVENT_TRIGGERS) {
    if (!content.events.some((e) => e.trigger === trigger)) {
      errors.push(`events: no event for the trigger "${trigger}"`);
    }
  }
  for (const e of content.events) {
    if (e.chainOnly && !e.trigger && !scheduled.has(e.id)) {
      errors.push(`events.${e.id}: chainOnly event is never scheduled`);
    }
  }
}

/** Ogni variante dichiarata in content/media.json deve avere il suo testo. */
function checkMedia(content: GameContent, errors: string[]): void {
  const t = content.i18n.it;
  const m = content.media;
  const need = (key: string) => {
    if (!(key in t)) errors.push(`media: missing text key "${key}"`);
  };
  dupesOf('media.handles', m.handles, errors);
  for (const [ctx, n] of Object.entries(m.fanComments)) {
    for (let i = 1; i <= n; i++) need(`media.fans.${ctx}.${i}`);
  }
  for (const c of ['win_hero', 'win', 'draw', 'loss', 'loss_flop', 'bench']) {
    for (let i = 1; i <= m.interviewQuestions; i++) need(`media.interview.${c}.q.${i}`);
    for (const tone of ['humble', 'confident', 'polemic']) need(`media.interview.${c}.${tone}`);
  }
  for (const kind of ['cup', 'derby', 'top', 'presentation']) {
    for (let i = 1; i <= m.pressQuestions; i++) {
      need(`media.press.${kind}.q${i}`);
      for (const tone of ['humble', 'confident', 'polemic'])
        need(`media.press.${kind}.q${i}.${tone}`);
    }
  }
  for (const id of ['training', 'private', 'charity', 'provocation']) {
    need(`media.posts.${id}.name`);
    for (let i = 1; i <= m.postCaptions; i++) need(`media.posts.${id}.caption.${i}`);
  }
}

function dupesOf(label: string, values: readonly string[], errors: string[]): void {
  const seen = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) errors.push(`${label}: duplicate "${v}"`);
    seen.add(v);
  }
}

/** Obiettivi dei capitoli: id unici, testi di richiesta ed esito, segnaposto noti. */
function checkChapterGoals(content: GameContent, errors: string[]): void {
  const t = content.i18n.it;
  const allowed = new Set<string>(CHAPTER_GOAL_PLACEHOLDERS);
  dupesOf(
    'chapterGoals',
    content.chapterGoals.map((g) => g.id),
    errors,
  );
  for (const g of content.chapterGoals) {
    const roles = g.conditions?.roles;
    const scorers = ['goals', 'assists', 'pickGoal'].includes(g.metric);
    if (scorers && (!roles || roles.includes('GK'))) {
      errors.push(`chapterGoals.${g.id}: "${g.metric}" needs roles that exclude GK`);
    }
    if (g.metric === 'cleanSheets' && (!roles || roles.some((r) => r !== 'GK' && r !== 'DEF'))) {
      errors.push(`chapterGoals.${g.id}: "cleanSheets" needs roles limited to GK and DEF`);
    }
    const keys = [g.textKey, chapterGoalOutcomeKey(g, true), chapterGoalOutcomeKey(g, false)];
    if (new Set(keys).size !== 3) errors.push(`chapterGoals.${g.id}: textKey must end in ".text"`);
    for (const key of keys) {
      const text = t[key];
      if (text === undefined) {
        errors.push(`chapterGoals.${g.id}: missing text key "${key}"`);
        continue;
      }
      for (const [, name] of text.matchAll(/\{(\w+)\}/g)) {
        if (!allowed.has(name!)) errors.push(`chapterGoals.${g.id}: unknown placeholder {${name}}`);
      }
    }
  }
}
