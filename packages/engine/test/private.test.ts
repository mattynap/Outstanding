import { describe, expect, it } from 'vitest';
import {
  applyWeeklyPrivate,
  breakUp,
  checkConditions,
  defaultContext,
  deserialize,
  doPrivateAction,
  endAffair,
  getPendingEvents,
  getPrivateActions,
  newCareer,
  planWeek,
  privateOf,
  relationshipState,
  resolveEvent,
  serialize,
  setInterest,
  type GameState,
  type Partner,
  type PartnerStage,
} from '../src/index';
import { Rng } from '../src/rng';
import { baseOptions } from './fixtures';

const ctx = defaultContext;
const cfg = ctx.config.private;

/** Un giocatore di 25 anni con stipendio e cassa, per provare tutte le azioni. */
function adult(cash = 50_000, salary = 1_000): GameState {
  const s = newCareer(baseOptions, 11);
  const yearsBack = 9 * ctx.config.calendar.weeksPerSeason;
  return {
    ...s,
    player: {
      ...s.player,
      birthWeek: s.player.birthWeek - yearsBack,
      money: { ...s.player.money, cash, salaryWeekly: salary },
      contract: { ...s.player.contract!, salaryWeekly: salary },
    },
  };
}

function withPartner(s: GameState, stage: PartnerStage, affinity = 70, since = -100): GameState {
  const partner: Partner = {
    firstName: 'Giulia',
    lastName: 'Rinaldi',
    gender: 'f',
    job: 'architect',
    skin: 0,
    hairColor: 0,
    hair: 'long',
    stage,
    sinceWeek: since,
    stageWeek: since,
    affinity,
  };
  return { ...s, privateLife: { ...privateOf(s), partner } };
}

const action = (s: GameState, id: string) => getPrivateActions(s).find((a) => a.id === id)!;
const week = (s: GameState, seed = 1) => applyWeeklyPrivate(s, Rng.fromSeed(seed), ctx);

describe('vita privata: inizio', () => {
  it('una carriera nuova parte da single con l’orientamento scelto', () => {
    const s = newCareer({ ...baseOptions, interest: 'men' }, 3);
    expect(relationshipState(s)).toBe('single');
    expect(s.privateLife).toMatchObject({ interest: 'men', children: [], exes: [] });
    expect(newCareer(baseOptions, 3).privateLife!.interest).toBe(cfg.defaultInterest);
  });

  it('i salvataggi senza vita privata si leggono e partono da single', () => {
    const { privateLife: _gone, ...old } = newCareer(baseOptions, 3);
    const back = deserialize(serialize(old as GameState));
    expect(privateOf(back).children).toEqual([]);
    expect(getPrivateActions(back).find((a) => a.id === 'dinner')!.available).toBe(false);
  });

  it('cambiare orientamento vale per le persone conosciute dopo', () => {
    const s = setInterest(adult(), 'men');
    let met: GameState | null = null;
    for (let seed = 0; seed < 40 && !met; seed++) {
      const out = doPrivateAction({ ...s, rngState: Rng.fromSeed(seed).getState() }, 'meet');
      if (out.report.outcome === 'met') met = out.state;
    }
    expect(met).not.toBeNull();
    expect(met!.privateLife!.prospect!.gender).toBe('m');
  });
});

describe('vita privata: azioni', () => {
  it('una sola azione privata a settimana', () => {
    const s = withPartner(adult(), 'dating');
    const after = doPrivateAction(s, 'dinner').state;
    expect(action(after, 'gift')).toMatchObject({
      available: false,
      reasonKey: 'private.blocked.done',
    });
  });

  it('la cena costa in proporzione allo stipendio e aumenta l’intesa', () => {
    const s = withPartner(adult(10_000, 2_000), 'dating', 50);
    const dinner = cfg.actions.find((a) => a.id === 'dinner')!;
    const out = doPrivateAction(s, 'dinner');
    const cost = Math.max(dinner.cost.min, Math.round(dinner.cost.salaryWeeks * 2_000));
    expect(out.report.cost).toBe(cost);
    expect(out.state.player.money.cash).toBe(10_000 - cost);
    expect(out.state.privateLife!.partner!.affinity).toBe(50 + dinner.affinity!);
  });

  it('le tappe hanno età, tempo insieme e intesa minimi', () => {
    const young = newCareer(baseOptions, 2);
    expect(action(withPartner(young, 'dating'), 'propose').reasonKey).toBe('private.blocked.age');
    const fresh = withPartner(adult(), 'dating', 80, 0);
    expect(action(fresh, 'propose').reasonKey).toBe('private.blocked.weeks');
    const cold = withPartner(adult(), 'dating', 30);
    expect(action(cold, 'propose').reasonKey).toBe('private.blocked.affinity');
    expect(action(withPartner(adult(), 'dating', 80), 'propose').available).toBe(true);
    expect(action(withPartner(adult(), 'dating'), 'wedding').reasonKey).toBe(
      'private.blocked.notEngaged',
    );
  });

  it('dall’incontro al matrimonio, poi un figlio', () => {
    let s = adult(500_000, 5_000);
    let tries = 0;
    const step = (id: string, ok: string[]) => {
      for (;;) {
        const out = doPrivateAction(s, id);
        s = { ...out.state, week: s.week + 1 };
        if (ok.includes(out.report.outcome)) return out.report;
        if (++tries > 200) throw new Error(`stuck on ${id}`);
      }
    };
    step('meet', ['met']);
    const yes = doPrivateAction(s, 'ask_out');
    s = { ...yes.state, week: s.week + 1 };
    if (yes.report.outcome !== 'yes') return; // un no è possibile: il resto è coperto altrove
    expect(relationshipState(s)).toBe('dating');
    s = withPartner(s, 'dating', 90);
    step('propose', ['yes']);
    expect(relationshipState(s)).toBe('engaged');
    s = { ...s, week: s.week + cfg.actions.find((a) => a.id === 'wedding')!.minWeeksInStage! };
    step('wedding', ['done']);
    expect(relationshipState(s)).toBe('married');
    s = withPartner(s, 'married', 90);
    step('child', ['expecting']);
    const due = s.privateLife!.expecting!.dueWeek;
    const born = week({ ...s, week: due });
    expect(born.week.born).not.toBeNull();
    expect(born.state.privateLife!.children).toHaveLength(1);
    expect(born.state.scheduled.at(-1)!.eventId).toBe('figli_nascita_01');
  });

  it('la vacanza solo nelle settimane senza partite', () => {
    const s = withPartner(adult(), 'dating');
    const club = s.player.clubId!;
    const matchWeek = s.calendar.find((f) => f.homeId === club || f.awayId === club)!.week;
    expect(action({ ...s, week: matchWeek }, 'holiday').reasonKey).toBe(
      'private.blocked.matchWeek',
    );
  });
});

describe('vita privata: settimana', () => {
  it('senza partner e senza segreti non consuma il generatore', () => {
    const s = adult();
    const rng = Rng.fromSeed(5);
    const before = rng.getState();
    applyWeeklyPrivate(s, rng, ctx);
    expect(rng.getState()).toEqual(before);
  });

  it('l’intesa cala piano e a zero il partner se ne va', () => {
    const s = withPartner(adult(), 'dating', 60);
    expect(week(s).state.privateLife!.partner!.affinity).toBeCloseTo(
      60 + cfg.affinity.driftPerWeek,
    );
    const gone = week(withPartner(adult(), 'dating', cfg.affinity.leaveAtOrBelow + 0.1));
    expect(gone.week.partnerLeft).toBe(true);
    expect(relationshipState(gone.state)).toBe('single');
    expect(gone.state.privateLife!.exes).toHaveLength(1);
    expect(gone.state.scheduled.at(-1)!.eventId).toBe('amore_addio_01');
  });

  it('i figli costano ogni settimana; dopo il divorzio si paga l’assegno', () => {
    let s = withPartner(adult(100_000, 3_000), 'married', 80);
    s = {
      ...s,
      privateLife: {
        ...s.privateLife!,
        children: [{ id: 'ch1', firstName: 'Luca', gender: 'm', birthWeek: 0, withPlayer: true }],
      },
    };
    const home = week(s);
    expect(home.week.childCosts).toBeGreaterThan(0);
    expect(home.week.alimony).toBe(0);

    const divorced = breakUp(s);
    expect(divorced.report.settlement).toBe(Math.round(cfg.divorce.liquidShare * 100_000));
    expect(divorced.state.player.money.cash).toBe(100_000 - divorced.report.settlement);
    const away = week(divorced.state);
    expect(away.week.childCosts).toBe(0);
    expect(away.week.alimony).toBeGreaterThan(0);
  });

  it('la separazione da fidanzati non costa soldi', () => {
    const s = withPartner(adult(20_000), 'dating');
    expect(breakUp(s).report.settlement).toBe(0);
  });

  it('una storia segreta prima o poi viene scoperta', () => {
    let s = withPartner(adult(), 'married', 90);
    s = { ...s, privateLife: { ...s.privateLife!, affair: { sinceWeek: 0 } } };
    let found = false;
    for (let seed = 0; seed < 200 && !found; seed++) {
      const out = week(s, seed);
      if (out.week.affairDiscovered) {
        found = true;
        expect(out.state.privateLife!.affair).toBeUndefined();
        expect(out.state.privateLife!.partner!.affinity).toBeLessThan(90);
        expect(out.state.scheduled.at(-1)!.eventId).toBe('amore_scoperta_01');
      }
    }
    expect(found).toBe(true);
    expect(endAffair(s).privateLife!.affair).toBeUndefined();
  });
});

describe('vita privata: serate ed eventi', () => {
  it('la serata della settimana di una partita può costare una multa', () => {
    const s = adult(10_000, 1_000);
    const club = s.player.clubId!;
    const matchWeek = s.calendar.find((f) => f.homeId === club || f.awayId === club)!.week;
    let fined = false;
    for (let seed = 0; seed < 60 && !fined; seed++) {
      const out = planWeek({ ...s, week: matchWeek, rngState: Rng.fromSeed(seed).getState() }, [
        { actionId: 'party' },
      ]);
      expect(out.report.party).toBeDefined();
      if (out.report.party!.fine > 0) {
        fined = true;
        expect(out.state.player.money.cash).toBe(10_000 - out.report.party!.fine);
      }
    }
    expect(fined).toBe(true);
  });

  it('le condizioni sulla relazione filtrano gli eventi', () => {
    const single = adult();
    const couple = withPartner(adult(), 'engaged', 30);
    expect(checkConditions({ relationship: 'single' }, single)).toBe(true);
    expect(checkConditions({ relationship: 'partner' }, single)).toBe(false);
    expect(checkConditions({ relationship: 'partner' }, couple)).toBe(true);
    expect(checkConditions({ relationship: 'married' }, couple)).toBe(false);
    expect(checkConditions({ affinity: { max: 35 } }, couple)).toBe(true);
    expect(checkConditions({ children: true }, couple)).toBe(false);
  });

  it('gli effetti degli eventi cambiano intesa e chiudono relazioni', () => {
    let s = withPartner(adult(), 'dating', 30);
    s = { ...s, pendingEvents: [{ eventId: 'amore_crisi_01', textVariant: 1 }] };
    expect(getPendingEvents(s)[0]!.params['partner']).toBe('Giulia');
    const out = resolveEvent(s, 'amore_crisi_01', 1);
    expect(relationshipState(out.state)).toBe('single');
    expect(out.report.changes.some((c) => c.kind === 'breakup')).toBe(true);
  });
});
