import { describe, expect, it } from 'vitest';
import { getTransferWindow, newCareer, type GameState } from '@outstanding/engine';
import { newTabs, parseSeen, visibleTabs } from '../src/app/core/unlocks';

const rookie: GameState = newCareer(
  { firstName: 'Tommaso', lastName: 'Ferraro', hometown: 'Bergamo', role: 'ATT' },
  7,
);
// Dieci settimane dopo l'inizio: fuori dalla finestra estiva.
const midSeasonRookie: GameState = { ...rookie, week: rookie.week + 10 };
const afterOneSeason: GameState = {
  ...midSeasonRookie,
  player: {
    ...midSeasonRookie.player,
    history: [{} as GameState['player']['history'][number]],
  },
};

describe('barra a gradini', () => {
  it('lo stato di prova è davvero fuori dalle finestre', () =>
    expect(getTransferWindow(midSeasonRookie)).toBeNull());
  it("all'inizio solo Settimana, Profilo e Classifica", () =>
    expect(visibleTabs(midSeasonRookie, 0)).toEqual(['week', 'profile', 'standings']));
  it('lo svincolato vede subito il Mercato', () =>
    expect(
      visibleTabs(
        { ...midSeasonRookie, player: { ...midSeasonRookie.player, clubId: undefined } },
        0,
      ),
    ).toContain('market'));
  it("la finestra estiva d'apertura non apre il Mercato", () =>
    expect(visibleTabs(rookie, 0)).toEqual(['week', 'profile', 'standings']));
  it("la prima finestra invernale o un'offerta mostrano il Mercato", () => {
    const winter: GameState = { ...rookie, week: rookie.week + 26 };
    expect(getTransferWindow(winter)).toBe('winter');
    expect(visibleTabs(winter, 0)).toContain('market');
    expect(visibleTabs(midSeasonRookie, 1)).toContain('market');
  });
  it('un elenco salvato rovinato vale come assente', () => {
    expect(parseSeen('{rotto')).toBeNull();
    expect(parseSeen('["market","zzz"]')).toEqual(['market']);
  });
  it('Carriera dopo la prima stagione', () =>
    expect(visibleTabs(afterOneSeason, 0)).toEqual([
      'week',
      'profile',
      'market',
      'standings',
      'career',
    ]));
  it('il Mercato già visto non sparisce più', () =>
    expect(visibleTabs(midSeasonRookie, 0, ['market'])).toContain('market'));
  it('salvataggio vecchio: niente raffica di novità', () =>
    expect(newTabs(['week', 'profile', 'market', 'standings', 'career'], null).tabs).toEqual([]));
  it('annuncia una sola volta', () => {
    const first = newTabs(
      ['week', 'profile', 'market', 'standings'],
      ['week', 'profile', 'standings'],
    );
    expect(first.tabs).toEqual(['market']);
    expect(newTabs(['week', 'profile', 'market', 'standings'], first.seen).tabs).toEqual([]);
  });
});
