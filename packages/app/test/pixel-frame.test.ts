import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Classi con la cornice pixel di components.css: niente bordo CSS, il colore passa da --px-b.
const FRAMED = [
  'o-px',
  'o-card',
  'o-choice',
  'o-paper',
  'o-btn',
  'o-chip',
  'o-input',
  'o-icon-btn',
];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = ['src/app/pages', 'src/app/ui']
  .map((d) => join(root, d))
  .flatMap((dir) =>
    readdirSync(dir)
      .filter((f) => f.endsWith('.ts'))
      .map((f) => join(dir, f)),
  );

/** Classi messe accanto a una classe con cornice pixel nello stesso elemento. */
function framedCompanions(src: string): Set<string> {
  const out = new Set<string>();
  for (const m of src.matchAll(/<[a-z][^>]*>/g)) {
    const tag = m[0];
    const cls = /\bclass="([^"]*)"/.exec(tag)?.[1].split(/\s+/) ?? [];
    if (!cls.some((c) => FRAMED.includes(c))) continue;
    for (const c of cls) if (!FRAMED.includes(c)) out.add(c);
    for (const b of tag.matchAll(/\[class\.([\w-]+)\]/g)) out.add(b[1]!);
  }
  return out;
}

describe('cornici pixel', () => {
  it('nessuna pagina colora la cornice con border-color o border-style (che border: none annulla)', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      const companions = framedCompanions(src);
      for (const rule of src.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (!/border-(color|style)\s*:/.test(rule[2]!)) continue;
        for (const sel of rule[1]!.split(',')) {
          const last =
            sel
              .trim()
              .split(/[\s>+~]+/)
              .pop() ?? '';
          const classes = [...last.matchAll(/\.([\w-]+)/g)].map((c) => c[1]!);
          if (classes.some((c) => companions.has(c))) offenders.push(`${file}: ${sel.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
