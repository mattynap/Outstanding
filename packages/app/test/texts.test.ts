import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from '@outstanding/config';
import { defaultContent, STAT_PATHS, EVENT_CATEGORIES } from '@outstanding/content';
import {
  APPEARANCE_PARTS,
  DIFFICULTIES,
  KIT_PATTERNS,
  ROLES,
  TATTOO_ZONES,
} from '@outstanding/engine';
import { PLAY_MODES } from '../src/app/core/play-mode';
import { TIP_IDS } from '../src/app/core/tutorial';
import {
  chanceTone,
  formatDelta,
  formatMoney,
  formatRating,
  translate,
} from '../src/app/core/text';

const t = defaultContent.i18n.it;
const root = join(import.meta.dirname, '../src');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : path.endsWith('.ts') ? [path] : [];
  });
}

describe("testi dell'interfaccia", () => {
  it('ogni chiave ui.* scritta nel codice esiste nelle traduzioni', () => {
    const missing = new Set<string>();
    for (const file of sources(root)) {
      for (const [, key] of readFileSync(file, 'utf8').matchAll(
        /'(ui\.[a-zA-Z0-9_.]+[a-zA-Z0-9_])'/g,
      )) {
        if (!(key! in t)) missing.add(key!);
      }
    }
    expect([...missing]).toEqual([]);
  });

  it('le chiavi composte a runtime esistono per ogni valore possibile', () => {
    const need = [
      ...ROLES.map((r) => `ui.create.roleHint.${r}`),
      ...defaultConfig.world.startLevels.map((l) => `ui.create.levelHint.${l}`),
      ...EVENT_CATEGORIES.map((c) => `ui.event.category.${c}`),
      ...STAT_PATHS.map((p) => `ui.statPath.${p}`),
      ...['summer', 'winter', 'closed'].map((w) => `ui.market.window.${w}`),
      ...['dark', 'light'].map((th) => `ui.settings.themes.${th}`),
      ...['purchased', 'cancelled', 'failed'].map((r) => `ui.settings.full.result.${r}`),
      ...['clubs', 'people', 'competitions', 'file'].map((x) => `ui.editor.tabs.${x}`),
      ...['team', 'coach', 'agent'].map((x) => `ui.editor.scopes.${x}`),
      ...['player', 'coach', 'agent'].map((x) => `ui.editor.kinds.${x}`),
      ...['primary', 'secondary'].map((x) => `ui.editor.club.${x}`),
      ...KIT_PATTERNS.map((x) => `ui.editor.patterns.${x}`),
      ...defaultContent.clubs.colors.map((c) => `ui.editor.colors.${c.id}`),
      ...APPEARANCE_PARTS.map((p) => `ui.look.parts.${p}`),
      ...['body', 'face', 'hair', 'extras', 'tattoos'].map((g) => `ui.look.groups.${g}`),
      ...TATTOO_ZONES.map((z) => `avatar.zones.${z}`),
      ...defaultContent.avatar.tattoos.flatMap((tt) => [
        `avatar.tattoos.${tt.id}`,
        ...(tt.unlock ? [`avatar.unlock.${tt.unlock.type}`] : []),
      ]),
      ...['summary', 'markets', 'assets', 'business', 'bank'].map((x) => `ui.wealth.tabs.${x}`),
      ...['cash', 'deposit', 'investments', 'properties', 'businesses', 'debts'].map(
        (x) => `ui.wealth.parts.${x}`,
      ),
      ...['noContract', 'tooMuch', 'badTerm'].map((x) => `ui.wealth.refusal.${x}`),
      ...['mortgage', 'personal'].map((x) => `ui.wealth.loanKinds.${x}`),
      ...defaultConfig.finance.market.instruments.flatMap((i) => [
        `finance.instruments.${i.id}.name`,
        `finance.instruments.${i.id}.desc`,
      ]),
      ...defaultConfig.finance.properties.catalog.map((p) => `finance.properties.${p.id}`),
      ...defaultConfig.finance.businesses.catalog.flatMap((b) =>
        ['name', 'desc', 'default'].map((x) => `finance.businesses.${b.id}.${x}`),
      ),
      ...DIFFICULTIES.flatMap((d) => [`difficulty.${d}.name`, `difficulty.${d}.hint`]),
      ...PLAY_MODES.flatMap((m) => [`ui.settings.modes.${m}`, `ui.settings.modes.${m}Hint`]),
      ...TIP_IDS.flatMap((id) => [`ui.tutorial.tips.${id}.title`, `ui.tutorial.tips.${id}.text`]),
      ...['tooLarge', 'notJson', 'invalid', 'newerVersion'].map(
        (x) => `ui.editor.file.errors.${x}`,
      ),
    ];
    expect(need.filter((k) => !(k in t))).toEqual([]);
  });
});

describe('formattazione', () => {
  it('scrive numeri, soldi e voti all’italiana', () => {
    expect(formatMoney(12000)).toBe('€ 12.000');
    expect(formatMoney(-50)).toBe('−€ 50');
    expect(formatRating(7.5)).toBe('7,5');
    expect(formatRating(6)).toBe('6');
    expect(formatRating(null)).toBe('s.v.');
    expect(formatDelta(3)).toBe('+3');
    expect(formatDelta(-2)).toBe('−2');
  });

  it('sostituisce i segnaposto e lascia visibili le chiavi mancanti', () => {
    expect(translate({ a: 'Ciao {name}' }, 'a', { name: 'Tommaso' })).toBe('Ciao Tommaso');
    expect(translate({}, 'x.y')).toBe('x.y');
    const t = { o: '{n} {n|offerta|offerte}', r: '{n|Un altro|Altri {n}} risultati' };
    expect(translate(t, 'o', { n: 1 })).toBe('1 offerta');
    expect(translate(t, 'o', { n: 3 })).toBe('3 offerte');
    expect(translate(t, 'r', { n: 1 })).toBe('Un altro risultati');
    expect(translate(t, 'r', { n: 4 })).toBe('Altri 4 risultati');
    expect(chanceTone(0.7)).toBe('pos');
    expect(chanceTone(0.2)).toBe('neg');
  });
});
