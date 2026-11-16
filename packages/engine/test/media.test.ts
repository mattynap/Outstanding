import { describe, expect, it } from 'vitest';
import {
  acceptOffer,
  answerInterview,
  answerPress,
  applyWeeklyMedia,
  bigMatchKind,
  defaultContext,
  deserialize,
  followersBonus,
  getInterview,
  getPostOptions,
  getPressConference,
  interviewContext,
  mediaOf,
  newCareer,
  pressBonus,
  publishPost,
  serialize,
  simulateMatch,
  skipToNextMatch,
  type GameState,
} from '../src/index';
import { Rng } from '../src/rng';
import { baseOptions } from './fixtures';

const ctx = defaultContext;
const cfg = ctx.config.media;

function start(seed = 4): GameState {
  return newCareer(baseOptions, seed);
}

/** Avanza fino alla prima settimana con partita e la simula. */
function afterFirstMatch(seed = 4): GameState {
  const s = skipToNextMatch(start(seed)).state;
  return simulateMatch(s).state;
}

describe('follower', () => {
  it('valgono soldi solo sopra il riferimento, fino a un massimo', () => {
    expect(followersBonus(100)).toBe(0);
    expect(followersBonus(cfg.followers.value.reference)).toBe(0);
    expect(followersBonus(cfg.followers.value.reference * 10)).toBeCloseTo(
      cfg.followers.value.perDecade,
    );
    expect(followersBonus(1e12)).toBe(cfg.followers.value.max);
  });

  it('si avvicinano ogni settimana al valore naturale per la popolarità', () => {
    const s = start();
    const famous = { ...s, player: { ...s.player, image: { ...s.player.image, popularity: 70 } } };
    const out = applyWeeklyMedia(famous, null, ctx);
    expect(out.state.player.image.followers).toBeGreaterThan(s.player.image.followers);
    expect(out.week.comments).toBeGreaterThan(0);
    expect(mediaOf(out.state).feed[0]!.kind).toBe('fan');
  });

  it('il feed non consuma il generatore della carriera', () => {
    const s = start();
    expect(applyWeeklyMedia(s, null, ctx).state.rngState).toEqual(s.rngState);
  });
});

describe('post', () => {
  it('uno a settimana; la beneficenza costa', () => {
    const s = start();
    const out = publishPost(s, 'training');
    expect(out.report.followers).toBeGreaterThanOrEqual(0);
    expect(mediaOf(out.state).feed[0]!.kind).toBe('post');
    expect(getPostOptions(out.state).every((o) => !o.available)).toBe(true);
    const charity = getPostOptions(s).find((o) => o.id === 'charity')!;
    expect(charity.cost).toBeGreaterThan(0);
  });

  it('la provocazione a volte scatena la polemica', () => {
    let backlash = 0;
    let gain = 0;
    for (let seed = 0; seed < 60; seed++) {
      const s = { ...start(), rngState: Rng.fromSeed(seed).getState() };
      const r = publishPost(s, 'provocation').report;
      if (r.backlash) {
        backlash++;
        expect(r.followers).toBeLessThan(0);
      } else gain++;
    }
    expect(backlash).toBeGreaterThan(0);
    expect(gain).toBeGreaterThan(backlash);
  });
});

describe('intervista', () => {
  it('il contesto dipende da risultato, minuti e voto', () => {
    expect(interviewContext('win', 90, 8)).toBe('win_hero');
    expect(interviewContext('win', 90, 6.5)).toBe('win');
    expect(interviewContext('loss', 90, 5)).toBe('loss_flop');
    expect(interviewContext('draw', 0, null)).toBe('bench');
  });

  it('dopo la partita c’è una domanda; si risponde una volta sola', () => {
    const s = afterFirstMatch();
    const view = getInterview(s);
    expect(view).not.toBeNull();
    expect(view!.answers.map((a) => a.tone)).toEqual(['humble', 'confident', 'polemic']);
    const answered = answerInterview(s, 'humble');
    expect(getInterview(answered)).toBeNull();
    expect(mediaOf(answered).feed[0]!.textKey).toBe('media.headline.humble');
    expect(() => answerInterview(answered, 'polemic')).toThrow();
    // "Nessun commento": nessun effetto sulle statistiche.
    const none = answerInterview(s, null);
    expect(none.player.image).toEqual(s.player.image);
  });
});

describe('conferenze stampa', () => {
  it('la presentazione arriva dopo un trasferimento', () => {
    let s = start();
    const other = s.world.clubs.find((c) => c.id !== s.player.clubId)!;
    s = {
      ...s,
      offers: [
        {
          id: 'o1',
          kind: 'transfer',
          clubId: other.id,
          salaryWeekly: 100,
          seasons: 2,
          signingBonus: 0,
          expiresWeek: s.week + 3,
          maxSalary: 100,
          roundsLeft: 1,
        },
      ],
    };
    const moved = acceptOffer(s, 'o1');
    const press = getPressConference(moved);
    expect(press?.kind).toBe('presentation');
    expect(press!.questions).toHaveLength(cfg.press.questions);
    const done = answerPress(moved, ['humble', 'confident']);
    expect(done.report.chance).toBe(0);
    expect(getPressConference(done.state)).toBeNull();
  });

  it('il derby è una grande partita e la conferenza cambia i momenti chiave', () => {
    let s = start();
    const club = s.world.clubs.find((c) => c.id === s.player.clubId)!;
    const rival = s.world.clubs.find((c) => c.groupId === club.groupId && c.id !== club.id)!;
    const f = s.calendar.find(
      (x) => !x.cup && (x.homeId === club.id || x.awayId === club.id) && x.week > s.week,
    )!;
    const opp = f.homeId === club.id ? f.awayId : f.homeId;
    s = {
      ...s,
      world: {
        ...s.world,
        clubs: s.world.clubs.map((c) => (c.id === opp ? { ...c, city: club.city } : c)),
      },
    };
    expect(bigMatchKind(s, f)).toBe('derby');
    expect(rival).toBeDefined();
    const atMatch = { ...s, week: f.week };
    const press = getPressConference(atMatch)!;
    expect(press.kind).toBe('derby');
    const out = answerPress(atMatch, ['confident', 'confident']);
    expect(out.report.chance).toBeCloseTo(
      Math.min(cfg.press.maxBoost, 2 * cfg.press.effects.confident.chance!),
    );
    expect(pressBonus(out.state, f.id)).toBe(out.report.chance);
    expect(pressBonus(out.state, 'other')).toBe(0);
  });
});

describe('salvataggi', () => {
  it('i salvataggi senza media si leggono', () => {
    const { media: _gone, ...old } = start();
    const back = deserialize(serialize(old as GameState));
    expect(mediaOf(back).feed).toEqual([]);
    expect(getPostOptions(back).some((o) => o.available)).toBe(true);
  });
});
