/**
 * File delle modifiche dell'editor: esportazione e importazione in JSON validato con Zod.
 * Formato documentato in docs/editor-format.md. Funzioni pure, testate con Vitest.
 *
 * Ogni voce porta il nome generato in origine: all'importazione una modifica si applica solo se
 * l'id esiste e il nome originale coincide, così un file di un'altra carriera non rinomina club
 * a caso. Il gioco non distribuisce né collega file di modifiche.
 */
import type { EditorConfig } from '@outstanding/config';
import {
  competitionIds,
  editClub,
  editPerson,
  getAnyClub,
  KIT_PATTERNS,
  originalClubLook,
  originalPersonName,
  setCompetitionName,
  worldPeople,
  type GameContext,
  type GameState,
  type KitPattern,
} from '@outstanding/engine';
import { z } from 'zod';

export const EDITS_FORMAT = 'outstanding.edits';

const ID_MAX = 40;
const MAX_ENTRIES = 20000;
const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export function editsFileSchema(cfg: EditorConfig) {
  const { limits } = cfg;
  const text = (max: number) => z.string().min(1).max(max);
  const id = z.string().min(1).max(ID_MAX);
  return z.object({
    format: z.literal(EDITS_FORMAT),
    version: z.number().int().positive(),
    /** Seme della carriera da cui viene il file (solo informativo). */
    seed: z.number().int().optional(),
    clubs: z
      .array(
        z.object({
          id,
          original: text(limits.clubName * 2),
          name: text(limits.clubName),
          shortName: text(limits.shortName),
          initials: text(limits.initials),
          primary: hex,
          secondary: hex,
          pattern: z.enum(KIT_PATTERNS as [KitPattern, ...KitPattern[]]),
        }),
      )
      .max(MAX_ENTRIES)
      .default([]),
    people: z
      .array(
        z.object({
          id,
          original: text(limits.personName * 2 + 1),
          firstName: text(limits.personName),
          lastName: text(limits.personName),
        }),
      )
      .max(MAX_ENTRIES)
      .default([]),
    competitions: z
      .array(z.object({ id, name: text(limits.competitionName) }))
      .max(MAX_ENTRIES)
      .default([]),
  });
}

export type EditsFile = z.infer<ReturnType<typeof editsFileSchema>>;

const fullName = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`;

/** File con tutte le modifiche della carriera (solo club e persone che esistono ancora). */
export function exportEdits(state: GameState, ctx: GameContext): EditsFile {
  const e = state.edits;
  const people = new Map(worldPeople(state.world).map((p) => [p.id, p]));
  const clubs: EditsFile['clubs'] = [];
  for (const id of Object.keys(e?.clubs ?? {})) {
    let club;
    try {
      club = getAnyClub(state.world, id);
    } catch {
      continue;
    }
    clubs.push({
      id,
      original: originalClubLook(state, id).name,
      name: club.name,
      shortName: club.shortName,
      initials: club.crest.initials,
      primary: club.crest.primary,
      secondary: club.crest.secondary,
      pattern: club.kit.pattern,
    });
  }
  return {
    format: EDITS_FORMAT,
    version: ctx.config.editor.fileVersion,
    seed: state.seed,
    clubs,
    people: Object.keys(e?.people ?? {}).flatMap((id) => {
      const p = people.get(id);
      if (!p) return [];
      const original = fullName(originalPersonName(state, id));
      return [{ id, original, firstName: p.firstName, lastName: p.lastName }];
    }),
    competitions: Object.entries(e?.competitions ?? {}).map(([id, name]) => ({ id, name })),
  };
}

export type ImportErrorCode = 'tooLarge' | 'notJson' | 'invalid' | 'newerVersion';

export class EditsFileError extends Error {
  constructor(readonly code: ImportErrorCode) {
    super(`Edits file: ${code}`);
  }
}

export interface ImportResult {
  state: GameState;
  applied: number;
  /** Voci ignorate: id sconosciuto, nome originale diverso o valori non accettati dal motore. */
  skipped: number;
}

/** Legge e valida un file di modifiche. Lancia `EditsFileError` se il file non è utilizzabile. */
export function parseEditsFile(text: string, cfg: EditorConfig): EditsFile {
  if (new TextEncoder().encode(text).length > cfg.maxFileBytes) {
    throw new EditsFileError('tooLarge');
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new EditsFileError('notJson');
  }
  const parsed = editsFileSchema(cfg).safeParse(raw);
  if (!parsed.success) throw new EditsFileError('invalid');
  if (parsed.data.version > cfg.fileVersion) throw new EditsFileError('newerVersion');
  return parsed.data;
}

/** Applica un file sopra le modifiche attuali: le voci del file prevalgono. */
export function importEdits(state: GameState, text: string, ctx: GameContext): ImportResult {
  const file = parseEditsFile(text, ctx.config.editor);
  let next = state;
  let applied = 0;
  let skipped = 0;
  const attempt = (fn: () => GameState) => {
    try {
      next = fn();
      applied++;
    } catch {
      skipped++;
    }
  };

  for (const c of file.clubs) {
    attempt(() => {
      if (originalClubLook(next, c.id).name !== c.original) throw new Error('Different club');
      const { id, original: _o, ...look } = c;
      return editClub(next, id, look, ctx);
    });
  }
  for (const p of file.people) {
    attempt(() => {
      if (fullName(originalPersonName(next, p.id)) !== p.original) {
        throw new Error('Different person');
      }
      return editPerson(next, p.id, { firstName: p.firstName, lastName: p.lastName }, ctx);
    });
  }
  const ids = new Set(competitionIds(next.world));
  for (const c of file.competitions) {
    attempt(() => {
      if (!ids.has(c.id)) throw new Error('Unknown competition');
      return setCompetitionName(next, c.id, c.name, ctx);
    });
  }
  return { state: next, applied, skipped };
}
