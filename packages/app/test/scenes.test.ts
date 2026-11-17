import { describe, expect, it } from 'vitest';
import type { KeyMoment, MatchEvent } from '@outstanding/engine';
import { sceneForMoment, resolvedStage } from '../src/app/scenes/stage-model';

const moment: KeyMoment = {
  momentId: 'att_box_chance',
  minute: 80,
  textKey: '',
  params: {},
  score: { home: 0, away: 0 },
  options: [],
};
const success: MatchEvent = {
  kind: 'moment',
  minute: 80,
  momentId: moment.momentId,
  optionId: 'tiro',
  success: true,
};

describe('presentazione degli esiti autorevoli', () => {
  it('non trasforma una buona azione in un gol che il motore non ha assegnato', () => {
    expect(resolvedStage(moment, 'home', [success]).result).toBe('pass');
  });
  it('riconosce gol e assist soltanto al minuto del momento e del giocatore', () => {
    const goal: MatchEvent = {
      kind: 'goal',
      minute: 80,
      side: 'home',
      scorerName: 'Neri',
      byPlayer: true,
      assistByPlayer: false,
    };
    expect(resolvedStage(moment, 'home', [success, goal]).result).toBe('goal');
    expect(
      resolvedStage(moment, 'home', [success, { ...goal, byPlayer: false, assistByPlayer: true }])
        .result,
    ).toBe('assist');
    expect(resolvedStage(moment, 'home', [success, { ...goal, minute: 81 }]).result).toBe('pass');
    expect(resolvedStage(moment, 'home', [success, { ...goal, byPlayer: false }]).result).toBe(
      'pass',
    );
  });
  it('distingue una parata, un recupero e un errore senza gol subito', () => {
    const keeper = { ...moment, momentId: 'gk_close_shot' };
    const defence = { ...moment, momentId: 'def_duel' };
    expect(resolvedStage(keeper, 'home', [{ ...success, momentId: keeper.momentId }]).result).toBe(
      'save',
    );
    expect(
      resolvedStage(defence, 'home', [{ ...success, momentId: defence.momentId }]).result,
    ).toBe('winBall');
    expect(resolvedStage(moment, 'home', [{ ...success, success: false }]).result).toBe('miss');
  });
  it('non usa esiti precedenti o di un altro momento', () => {
    expect(resolvedStage(moment, 'home', [{ ...success, minute: 79 }]).phase).toBe('ready');
    expect(resolvedStage(moment, 'home', [{ ...success, momentId: 'att_counter' }]).phase).toBe(
      'ready',
    );
  });
  it('prepara una scena per tutti i ruoli senza importare il renderer', () => {
    expect(sceneForMoment('gk_cross')).toBe('keeper');
    expect(sceneForMoment('def_duel')).toBe('defence');
    expect(sceneForMoment('mid_through_ball')).toBe('attack');
    expect(sceneForMoment('att_box_chance')).toBe('attack');
  });
});

describe('campo prova isolato', () => {
  it('offre momenti ripetibili per ogni ruolo e lascia intatta la carriera esterna', async () => {
    const { createPractice } = await import('../src/app/scenes/practice');
    for (const role of ['GK', 'DEF', 'MID', 'ATT'] as const) {
      const a = createPractice(role),
        b = createPractice(role);
      expect(a.step.kind).toBe('moment');
      expect(a).toEqual(b);
    }
  });
});

describe('chiusura partita e azioni specifiche', () => {
  it('ritrova il momento nuovo anche quando il report riordina eventi già esistenti', () => {
    const future: MatchEvent = { kind: 'subOut', minute: 89 };
    expect(resolvedStage(moment, 'home', [success, future], [future]).result).toBe('pass');
  });
  it('non chiama parata una distribuzione e recupero un piazzato offensivo', () => {
    for (const momentId of ['gk_distribution', 'def_set_piece']) {
      expect(
        resolvedStage({ ...moment, momentId }, 'home', [{ ...success, momentId }]).result,
      ).toBe('pass');
      expect(sceneForMoment(momentId)).toBe('attack');
    }
  });
});
