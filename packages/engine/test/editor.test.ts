import { describe, expect, it } from 'vitest';
import {
  clubLook,
  defaultContext,
  editClub,
  editCount,
  editPerson,
  endSeason,
  getAnyClub,
  newCareer,
  originalClubLook,
  originalPersonName,
  pruneEdits,
  resetAllEdits,
  resetClub,
  resetPerson,
  serialize,
  deserialize,
  setCompetitionName,
  worldPeople,
} from '../src/index';
import { baseOptions } from './fixtures';

const ctx = defaultContext;
const state = newCareer(baseOptions, 7);
const club = state.world.clubs[3]!;
const foreign = state.world.foreignClubs[0]!;
const colors = ctx.content.clubs.colors.map((c) => c.hex);
const otherColors = colors.filter((c) => c !== club.crest.primary && c !== club.crest.secondary);

describe('editor: club', () => {
  it('renames and recolors a club, keeping the original look aside', () => {
    const next = editClub(
      state,
      club.id,
      {
        name: '  Unione   Prova ',
        shortName: 'Prova',
        initials: 'up',
        primary: otherColors[0]!,
        secondary: otherColors[1]!,
        pattern: 'sash',
      },
      ctx,
    );
    const edited = getAnyClub(next.world, club.id);
    expect(edited.name).toBe('Unione Prova');
    expect(edited.crest.initials).toBe('UP');
    expect(edited.crest.primary).toBe(otherColors[0]);
    expect(edited.kit.secondary).toBe(otherColors[1]);
    expect(edited.kit.pattern).toBe('sash');
    expect(next.edits?.clubs[club.id]).toEqual(clubLook(club));
    expect(originalClubLook(next, club.id).name).toBe(club.name);
    // Lo stato di partenza non cambia.
    expect(getAnyClub(state.world, club.id).name).toBe(club.name);
  });

  it('keeps the first original look across several edits and restores it', () => {
    const once = editClub(state, club.id, { name: 'Primo Nome' }, ctx);
    const twice = editClub(once, club.id, { name: 'Secondo Nome' }, ctx);
    expect(twice.edits?.clubs[club.id]?.name).toBe(club.name);
    const back = resetClub(twice, club.id);
    expect(getAnyClub(back.world, club.id)).toEqual(club);
    expect(back.edits).toBeUndefined();
  });

  it('drops the edit when the club goes back to its original look by hand', () => {
    const once = editClub(state, club.id, { name: 'Altro Nome' }, ctx);
    const back = editClub(once, club.id, { name: club.name }, ctx);
    expect(back.edits).toBeUndefined();
  });

  it('edits foreign clubs too', () => {
    const next = editClub(state, foreign.id, { shortName: 'Ospiti' }, ctx);
    expect(getAnyClub(next.world, foreign.id).shortName).toBe('Ospiti');
  });

  it('rejects colors outside the palette, equal colors, empty or long names', () => {
    expect(() => editClub(state, club.id, { primary: '#123456' }, ctx)).toThrow();
    expect(() =>
      editClub(state, club.id, { primary: colors[0]!, secondary: colors[0]! }, ctx),
    ).toThrow();
    expect(() => editClub(state, club.id, { name: '   ' }, ctx)).toThrow();
    const long = 'x'.repeat(ctx.config.editor.limits.clubName + 1);
    expect(() => editClub(state, club.id, { name: long }, ctx)).toThrow();
    expect(() => editClub(state, 'nope', { name: 'A' }, ctx)).toThrow();
  });
});

describe('editor: people and competitions', () => {
  const people = worldPeople(state.world);
  const rosterPlayer = people.find((p) => p.kind === 'player')!;
  const coach = people.find((p) => p.kind === 'coach')!;

  it('lists roster players, coaches and agents', () => {
    expect(people.some((p) => p.kind === 'agent')).toBe(true);
    expect(new Set(people.map((p) => p.id)).size).toBe(people.length);
  });

  it('renames a roster player and a coach and restores them', () => {
    let next = editPerson(state, rosterPlayer.id, { firstName: 'Ugo', lastName: 'Bassi' }, ctx);
    next = editPerson(next, coach.id, { firstName: 'Ivo', lastName: 'Neri' }, ctx);
    const renamed = worldPeople(next.world);
    expect(renamed.find((p) => p.id === rosterPlayer.id)?.lastName).toBe('Bassi');
    expect(renamed.find((p) => p.id === coach.id)?.firstName).toBe('Ivo');
    expect(originalPersonName(next, coach.id).lastName).toBe(coach.lastName);
    expect(editCount(next)).toBe(2);
    next = resetPerson(next, rosterPlayer.id);
    expect(worldPeople(next.world).find((p) => p.id === rosterPlayer.id)?.lastName).toBe(
      rosterPlayer.lastName,
    );
    expect(editCount(next)).toBe(1);
  });

  it('names competitions and clears the name with null', () => {
    let next = setCompetitionName(state, 'L1', 'Lega delle Stelle', ctx);
    next = setCompetitionName(next, 'national_cup', 'Coppa Prova', ctx);
    expect(next.edits?.competitions).toEqual({
      L1: 'Lega delle Stelle',
      national_cup: 'Coppa Prova',
    });
    next = setCompetitionName(next, 'L1', null, ctx);
    expect(next.edits?.competitions).toEqual({ national_cup: 'Coppa Prova' });
    expect(() => setCompetitionName(state, 'L99', 'X', ctx)).toThrow();
  });

  it('resets everything and survives a save round trip', () => {
    let next = editClub(state, club.id, { name: 'Club Salvato' }, ctx);
    next = editPerson(next, coach.id, { firstName: 'A', lastName: 'B' }, ctx);
    next = setCompetitionName(next, 'L2', 'Seconda Prova', ctx);
    const loaded = deserialize(serialize(next));
    expect(loaded.edits).toEqual(next.edits);
    const clean = resetAllEdits(loaded);
    expect(clean.edits).toBeUndefined();
    expect(clean.world).toEqual(state.world);
  });

  it('keeps edits through the end of a season and prunes retired people', () => {
    let next = editClub(state, club.id, { name: 'Club Estivo' }, ctx);
    next = editPerson(next, rosterPlayer.id, { firstName: 'Ugo', lastName: 'Bassi' }, ctx);
    const after = pruneEdits(endSeason({ ...next, week: next.week + 60 }, ctx).state);
    expect(getAnyClub(after.world, club.id).name).toBe('Club Estivo');
    const stillThere = worldPeople(after.world).some((p) => p.id === rosterPlayer.id);
    expect(rosterPlayer.id in (after.edits?.people ?? {})).toBe(stillThere);
  });
});
