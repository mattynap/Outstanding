import { describe, expect, it } from 'vitest';
import {
  defaultContext,
  editClub,
  editPerson,
  getAnyClub,
  newCareer,
  setCompetitionName,
  worldPeople,
} from '@outstanding/engine';
import {
  EDITS_FORMAT,
  EditsFileError,
  exportEdits,
  importEdits,
  parseEditsFile,
} from '../src/app/core/editor/edits-file';

const ctx = defaultContext;
const options = {
  firstName: 'Nico',
  lastName: 'Prova',
  hometown: 'Bergamo',
  role: 'MID' as const,
  traits: [],
};
const fresh = newCareer(options, 11);
const club = fresh.world.clubs[5]!;
const coach = worldPeople(fresh.world).find((p) => p.kind === 'coach')!;
const colors = ctx.content.clubs.colors.map((c) => c.hex);
const [c1, c2] = colors.filter((c) => c !== club.crest.primary && c !== club.crest.secondary);

function edited() {
  let s = editClub(
    fresh,
    club.id,
    { name: 'Polisportiva Prova', primary: c1!, secondary: c2!, pattern: 'hstripes' },
    ctx,
  );
  s = editPerson(s, coach.id, { firstName: 'Ettore', lastName: 'Fittizio' }, ctx);
  return setCompetitionName(s, 'L1', 'Lega Inventata', ctx);
}

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (err) {
    return err instanceof EditsFileError ? err.code : 'other';
  }
  return null;
};

describe('file delle correzioni', () => {
  it('esporta le correzioni con i nomi originali', () => {
    const file = exportEdits(edited(), ctx);
    expect(file.format).toBe(EDITS_FORMAT);
    expect(file.version).toBe(ctx.config.editor.fileVersion);
    expect(file.clubs).toEqual([
      expect.objectContaining({
        id: club.id,
        original: club.name,
        name: 'Polisportiva Prova',
        pattern: 'hstripes',
      }),
    ]);
    expect(file.people[0]).toMatchObject({
      original: `${coach.firstName} ${coach.lastName}`,
      lastName: 'Fittizio',
    });
    expect(file.competitions).toEqual([{ id: 'L1', name: 'Lega Inventata' }]);
  });

  it('reimporta il file nella stessa carriera ripartendo da zero', () => {
    const text = JSON.stringify(exportEdits(edited(), ctx));
    const { state, applied, skipped } = importEdits(fresh, text, ctx);
    expect(applied).toBe(3);
    expect(skipped).toBe(0);
    expect(state.edits).toEqual(edited().edits);
    expect(getAnyClub(state.world, club.id).kit.pattern).toBe('hstripes');
  });

  it('ignora le voci di un altro mondo (nome originale diverso)', () => {
    const other = newCareer(options, 999);
    const text = JSON.stringify(exportEdits(edited(), ctx));
    const { state, skipped } = importEdits(other, text, ctx);
    // I nomi generati cambiano con il seme: club e allenatore non combaciano.
    expect(skipped).toBe(2);
    expect(state.edits?.competitions).toEqual({ L1: 'Lega Inventata' });
    expect(state.edits?.clubs ?? {}).toEqual({});
  });

  it('ignora colori fuori tavolozza senza bloccare il resto', () => {
    const file = exportEdits(edited(), ctx);
    file.clubs[0]!.primary = '#010203';
    const { applied, skipped } = importEdits(fresh, JSON.stringify(file), ctx);
    expect(applied).toBe(2);
    expect(skipped).toBe(1);
  });

  it('rifiuta file non validi', () => {
    const cfg = ctx.config.editor;
    expect(codeOf(() => parseEditsFile('non json', cfg))).toBe('notJson');
    expect(codeOf(() => parseEditsFile('{"format":"altro","version":1}', cfg))).toBe('invalid');
    const newer = JSON.stringify({ format: EDITS_FORMAT, version: cfg.fileVersion + 1 });
    expect(codeOf(() => parseEditsFile(newer, cfg))).toBe('newerVersion');
    const long = {
      format: EDITS_FORMAT,
      version: 1,
      competitions: [{ id: 'L1', name: 'x'.repeat(cfg.limits.competitionName + 1) }],
    };
    expect(codeOf(() => parseEditsFile(JSON.stringify(long), cfg))).toBe('invalid');
    expect(codeOf(() => parseEditsFile(' '.repeat(cfg.maxFileBytes + 1), cfg))).toBe('tooLarge');
  });

  it('accetta un file minimo con le sole competizioni', () => {
    const text = JSON.stringify({
      format: EDITS_FORMAT,
      version: 1,
      competitions: [{ id: 'national_cup', name: 'Coppa di Prova' }],
    });
    const { state, applied } = importEdits(fresh, text, ctx);
    expect(applied).toBe(1);
    expect(state.edits?.competitions['national_cup']).toBe('Coppa di Prova');
  });
});
