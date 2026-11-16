/**
 * Editor del giocatore: nomi e colori di club, nomi di persone e di competizioni. Le modifiche
 * valgono solo per questa carriera; i valori generati in origine restano in `state.edits` e si
 * possono sempre ripristinare. I dati distribuiti con il gioco (contenuti e configurazione) non
 * cambiano mai.
 */
import type { GameContext } from '../context';
import type { ClubBase, ClubLook, GameState, PersonName, World, WorldEdits } from '../types';
import { KIT_PATTERNS } from './club';

/** Nessuna modifica. */
export const emptyEdits = (): WorldEdits => ({ clubs: {}, people: {}, competitions: {} });

/** Valori attuali dell'aspetto di un club. */
export function clubLook(club: ClubBase): ClubLook {
  return {
    name: club.name,
    shortName: club.shortName,
    initials: club.crest.initials,
    primary: club.crest.primary,
    secondary: club.crest.secondary,
    pattern: club.kit.pattern,
  };
}

const sameLook = (a: ClubLook, b: ClubLook) =>
  a.name === b.name &&
  a.shortName === b.shortName &&
  a.initials === b.initials &&
  a.primary === b.primary &&
  a.secondary === b.secondary &&
  a.pattern === b.pattern;

function withLook<T extends ClubBase>(club: T, look: ClubLook): T {
  return {
    ...club,
    name: look.name,
    shortName: look.shortName,
    crest: {
      ...club.crest,
      initials: look.initials,
      primary: look.primary,
      secondary: look.secondary,
    },
    kit: { ...club.kit, primary: look.primary, secondary: look.secondary, pattern: look.pattern },
  };
}

function findAnyClub(world: World, id: string): ClubBase | undefined {
  return world.clubs.find((c) => c.id === id) ?? world.foreignClubs.find((c) => c.id === id);
}

function mapClub(world: World, id: string, fn: <T extends ClubBase>(club: T) => T): World {
  return {
    ...world,
    clubs: world.clubs.map((c) => (c.id === id ? fn(c) : c)),
    foreignClubs: world.foreignClubs.map((c) => (c.id === id ? fn(c) : c)),
  };
}

/** Testo pulito: spazi ripetuti ridotti, lunghezza controllata. Lancia un errore se non valido. */
function cleanText(value: string, max: number, what: string): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text) throw new Error(`Empty ${what}`);
  if ([...text].length > max) throw new Error(`${what} longer than ${max} characters`);
  return text;
}

function checkLook(look: ClubLook, ctx: GameContext): ClubLook {
  const { limits } = ctx.config.editor;
  const palette = new Set(ctx.content.clubs.colors.map((c) => c.hex.toLowerCase()));
  const primary = look.primary.toLowerCase();
  const secondary = look.secondary.toLowerCase();
  if (!palette.has(primary) || !palette.has(secondary)) {
    throw new Error('Club colors must come from the game palette');
  }
  if (primary === secondary) throw new Error('Club colors must be different');
  if (!KIT_PATTERNS.includes(look.pattern))
    throw new Error(`Unknown kit pattern "${look.pattern}"`);
  return {
    name: cleanText(look.name, limits.clubName, 'club name'),
    shortName: cleanText(look.shortName, limits.shortName, 'short name'),
    initials: cleanText(look.initials, limits.initials, 'initials').toUpperCase(),
    // Si conserva la grafia della tavolozza, per confrontare i valori con quelli generati.
    primary: ctx.content.clubs.colors.find((c) => c.hex.toLowerCase() === primary)!.hex,
    secondary: ctx.content.clubs.colors.find((c) => c.hex.toLowerCase() === secondary)!.hex,
    pattern: look.pattern,
  };
}

/** Toglie l'oggetto `edits` se è vuoto, così le carriere senza modifiche restano identiche. */
function storeEdits(state: GameState, edits: WorldEdits): GameState {
  const empty =
    Object.keys(edits.clubs).length === 0 &&
    Object.keys(edits.people).length === 0 &&
    Object.keys(edits.competitions).length === 0;
  const { edits: _old, ...rest } = state;
  return empty ? rest : { ...rest, edits };
}

const editsOf = (state: GameState): WorldEdits => state.edits ?? emptyEdits();

/** Aspetto generato in origine di un club (uguale a quello attuale se non è mai stato modificato). */
export function originalClubLook(state: GameState, clubId: string): ClubLook {
  const base = state.edits?.clubs[clubId];
  if (base) return base;
  const club = findAnyClub(state.world, clubId);
  if (!club) throw new Error(`Unknown club "${clubId}"`);
  return clubLook(club);
}

/** Cambia nome, sigla, iniziali, colori o motivo della maglia di un club italiano o straniero. */
export function editClub(
  state: GameState,
  clubId: string,
  changes: Partial<ClubLook>,
  ctx: GameContext,
): GameState {
  const club = findAnyClub(state.world, clubId);
  if (!club) throw new Error(`Unknown club "${clubId}"`);
  const look = checkLook({ ...clubLook(club), ...changes }, ctx);
  const edits = editsOf(state);
  const base = edits.clubs[clubId] ?? clubLook(club);
  const clubs = { ...edits.clubs };
  if (sameLook(look, base)) delete clubs[clubId];
  else clubs[clubId] = base;
  return storeEdits(
    { ...state, world: mapClub(state.world, clubId, (c) => withLook(c, look)) },
    { ...edits, clubs },
  );
}

/** Riporta un club all'aspetto generato in origine. */
export function resetClub(state: GameState, clubId: string): GameState {
  const edits = editsOf(state);
  const base = edits.clubs[clubId];
  if (!base) return state;
  const { [clubId]: _removed, ...clubs } = edits.clubs;
  return storeEdits(
    { ...state, world: mapClub(state.world, clubId, (c) => withLook(c, base)) },
    { ...edits, clubs },
  );
}

export type PersonKind = 'player' | 'coach' | 'agent';

/** Persona del mondo modificabile: calciatore di una rosa, allenatore o procuratore. */
export interface PersonRef extends PersonName {
  id: string;
  kind: PersonKind;
  /** Club della persona, se ne ha uno. */
  clubId: string | null;
}

/** Tutte le persone del mondo che l'editor può rinominare (il giocatore escluso). */
export function worldPeople(world: World): PersonRef[] {
  const out: PersonRef[] = [];
  for (const club of [...world.clubs, ...world.foreignClubs]) {
    for (const p of club.roster) {
      out.push({
        id: p.id,
        kind: 'player',
        clubId: club.id,
        firstName: p.firstName,
        lastName: p.lastName,
      });
    }
  }
  for (const n of world.npcs) {
    out.push({
      id: n.id,
      kind: n.role,
      clubId: n.clubId ?? null,
      firstName: n.firstName,
      lastName: n.lastName,
    });
  }
  return out;
}

function findPerson(world: World, id: string): PersonName | undefined {
  const npc = world.npcs.find((n) => n.id === id);
  if (npc) return npc;
  for (const club of [...world.clubs, ...world.foreignClubs]) {
    const p = club.roster.find((r) => r.id === id);
    if (p) return p;
  }
  return undefined;
}

function renamePerson(world: World, id: string, name: PersonName): World {
  const rename = <T extends PersonName & { id: string }>(p: T): T =>
    p.id === id ? { ...p, firstName: name.firstName, lastName: name.lastName } : p;
  const inRoster = <T extends ClubBase>(c: T): T =>
    c.roster.some((p) => p.id === id) ? { ...c, roster: c.roster.map(rename) } : c;
  return {
    ...world,
    npcs: world.npcs.map(rename),
    clubs: world.clubs.map(inRoster),
    foreignClubs: world.foreignClubs.map(inRoster),
  };
}

/** Nome generato in origine di una persona del mondo. */
export function originalPersonName(state: GameState, personId: string): PersonName {
  const base = state.edits?.people[personId];
  if (base) return base;
  const person = findPerson(state.world, personId);
  if (!person) throw new Error(`Unknown person "${personId}"`);
  return { firstName: person.firstName, lastName: person.lastName };
}

/** Rinomina un calciatore delle rose, un allenatore o un procuratore. */
export function editPerson(
  state: GameState,
  personId: string,
  name: PersonName,
  ctx: GameContext,
): GameState {
  const person = findPerson(state.world, personId);
  if (!person) throw new Error(`Unknown person "${personId}"`);
  const max = ctx.config.editor.limits.personName;
  const clean = {
    firstName: cleanText(name.firstName, max, 'first name'),
    lastName: cleanText(name.lastName, max, 'last name'),
  };
  const edits = editsOf(state);
  const base = edits.people[personId] ?? {
    firstName: person.firstName,
    lastName: person.lastName,
  };
  const people = { ...edits.people };
  if (clean.firstName === base.firstName && clean.lastName === base.lastName) {
    delete people[personId];
  } else {
    people[personId] = base;
  }
  return storeEdits(
    { ...state, world: renamePerson(state.world, personId, clean) },
    { ...edits, people },
  );
}

/** Riporta una persona al nome generato in origine. */
export function resetPerson(state: GameState, personId: string): GameState {
  const edits = editsOf(state);
  const base = edits.people[personId];
  if (!base) return state;
  const { [personId]: _removed, ...people } = edits.people;
  return storeEdits(
    { ...state, world: renamePerson(state.world, personId, base) },
    { ...edits, people },
  );
}

/** Id delle competizioni rinominabili: i campionati (L1…) e le coppe. */
export function competitionIds(world: World): string[] {
  return [...world.leagues.map((l) => l.id), ...world.competitions.map((c) => c.id)];
}

/**
 * Nome scelto dal giocatore per un campionato o una coppa; `null` torna al nome originale.
 * I nomi originali stanno nelle traduzioni: qui si salva solo quello nuovo.
 */
export function setCompetitionName(
  state: GameState,
  competitionId: string,
  name: string | null,
  ctx: GameContext,
): GameState {
  if (!competitionIds(state.world).includes(competitionId)) {
    throw new Error(`Unknown competition "${competitionId}"`);
  }
  const edits = editsOf(state);
  const competitions = { ...edits.competitions };
  if (name === null || !name.trim()) delete competitions[competitionId];
  else {
    competitions[competitionId] = cleanText(
      name,
      ctx.config.editor.limits.competitionName,
      'competition name',
    );
  }
  return storeEdits(state, { ...edits, competitions });
}

/** Annulla tutte le modifiche dell'editor. */
export function resetAllEdits(state: GameState): GameState {
  let next = state;
  for (const id of Object.keys(state.edits?.clubs ?? {})) next = resetClub(next, id);
  for (const id of Object.keys(state.edits?.people ?? {})) next = resetPerson(next, id);
  return storeEdits(next, emptyEdits());
}

/** Numero di elementi modificati. */
export function editCount(state: GameState): number {
  const e = state.edits;
  if (!e) return 0;
  return (
    Object.keys(e.clubs).length + Object.keys(e.people).length + Object.keys(e.competitions).length
  );
}

/** Toglie le modifiche di persone che non esistono più (calciatori ritirati). */
export function pruneEdits(state: GameState): GameState {
  const e = state.edits;
  if (!e) return state;
  const alive = new Set(worldPeople(state.world).map((p) => p.id));
  const stale = Object.keys(e.people).filter((id) => !alive.has(id));
  if (stale.length === 0) return state;
  const people = { ...e.people };
  for (const id of stale) delete people[id];
  return storeEdits(state, { ...e, people });
}
