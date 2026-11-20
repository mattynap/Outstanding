import { describe, expect, it } from 'vitest';
import {
  acceptOffer,
  acceptSponsor,
  advanceWeek,
  defaultContext,
  deserialize,
  drawWeekEvents,
  endSeason,
  fireAgent,
  getAgentCandidates,
  getOffers,
  getPendingEvents,
  getTransferWindow,
  getPlanOptions,
  hireAgent,
  isSeasonOver,
  negotiateOffer,
  newCareer,
  planWeek,
  playerFixture,
  playMatch,
  refreshMarket,
  rejectOffer,
  retire,
  serialize,
  setLifestyle,
  type ContractOffer,
  type GameState,
  type Player,
} from '../src/index';
import { baseOptions } from './fixtures';

const ctx = defaultContext;
const W = ctx.config.calendar.weeksPerSeason;
const start = (seed = 5) => newCareer(baseOptions, seed);

/** Porta tutte le abilità del giocatore al valore dato. */
function withSkills(state: GameState, value: number): GameState {
  const skills = Object.fromEntries(
    Object.keys(state.player.skills).map((k) => [k, value]),
  ) as Player['skills'];
  return { ...state, player: { ...state.player, skills, potential: Math.max(value, 60) } };
}

const patchPlayer = (s: GameState, p: Partial<Player>): GameState => ({
  ...s,
  player: { ...s.player, ...p },
});

/** Gioca la settimana (partita compresa) e passa alla successiva. */
function nextWeek(s: GameState): GameState {
  let x = s;
  while (playerFixture(x)) x = playMatch(x, () => 0).state;
  return advanceWeek(x).state;
}

function playToSeasonEnd(s: GameState): GameState {
  let x = s;
  while (!isSeasonOver(x)) x = nextWeek(x);
  return x;
}

/** Aggiunge un'offerta costruita a mano per i test di trattativa e firma. */
function withOffer(s: GameState, over: Partial<ContractOffer> = {}): GameState {
  const club = s.world.clubs.find((c) => c.id !== s.player.clubId)!;
  const offer: ContractOffer = {
    id: 'o_test',
    kind: 'transfer',
    clubId: club.id,
    salaryWeekly: 100,
    seasons: 2,
    signingBonus: 200,
    expiresWeek: s.week + 1,
    maxSalary: 130,
    roundsLeft: 1,
    ...over,
  };
  return { ...s, offers: [...s.offers, offer] };
}

describe('finanze settimanali', () => {
  it('lo stipendio entra, il tenore di vita costa', () => {
    const s = start();
    const salary = s.player.contract!.salaryWeekly;
    const cost = ctx.config.economy.lifestyles.find((l) => l.id === s.player.lifestyle)!.weeklyCost;
    const { state, report } = advanceWeek(s);
    expect(report.finance).toEqual({ salary, sponsors: 0, commission: 0, expenses: cost });
    expect(state.player.money.cash).toBe(s.player.money.cash + salary - cost);
  });

  it('il lusso costa caro e i debiti pesano sul morale', () => {
    const s = setLifestyle(
      patchPlayer(start(), { money: { cash: 0, salaryWeekly: 0, assets: 0 } }),
      'luxury',
    );
    const next = advanceWeek(s).state;
    expect(next.player.money.cash).toBeLessThan(0);
    expect(() => setLifestyle(s, 'castello')).toThrow();
  });
});

describe('procuratore', () => {
  it('i procuratori migliori seguono solo chi ha reputazione', () => {
    const s = start();
    const low = getAgentCandidates(s);
    const famous = getAgentCandidates(
      patchPlayer(s, { image: { ...s.player.image, reputation: 90 } }),
    );
    const best = (l: typeof low) => Math.max(...l.map((n) => n.quality ?? 0));
    expect(best(famous)).toBeGreaterThan(best(low));
  });

  it('si assume, prende la commissione e compare nei testi', () => {
    const s = start();
    const agent = getAgentCandidates(s)[0]!;
    const hired = hireAgent(s, agent.id);
    expect(hired.player.agentId).toBe(agent.id);
    const week = advanceWeek(hired).report.finance;
    expect(week.commission).toBe(Math.round(week.salary * agent.commission!));
    const withEvent = drawWeekEvents(hired);
    if (withEvent.events.length > 0) {
      expect(getPendingEvents(withEvent.state)[0]!.params['agent']).toContain(agent.lastName);
    }
    expect(fireAgent(hired).player.agentId).toBeUndefined();
    expect(() => hireAgent(s, 'nessuno')).toThrow();
  });
});

describe('offerte e trattative', () => {
  it('in finestra di mercato arrivano offerte per un giocatore forte', () => {
    // Le offerte dipendono dal flusso casuale: basta che arrivino con almeno uno dei semi.
    let received = 0;
    for (let seed = 5; seed < 15 && received === 0; seed++) {
      let s = withSkills(start(seed), 60);
      while (getTransferWindow(s) === 'summer') {
        s = nextWeek(s);
        received = Math.max(received, s.offers.length);
        for (const v of getOffers(s)) expect(v).not.toHaveProperty('maxSalary');
      }
    }
    expect(received).toBeGreaterThan(0);
  });

  it('fuori finestra, con un contratto, non arrivano trasferimenti', () => {
    let s = withSkills(start(), 60);
    while (getTransferWindow(s)) s = nextWeek(s);
    s = { ...s, offers: [] };
    for (let i = 0; i < 6 && !getTransferWindow(s); i++) {
      s = nextWeek(s);
      expect(s.offers.filter((o) => o.kind === 'transfer')).toEqual([]);
    }
  });

  it('il club accetta, rilancia o si ritira', () => {
    const s = withOffer(start());
    const ok = negotiateOffer(s, 'o_test', { salaryWeekly: 120, seasons: 3 });
    expect(ok.result).toBe('accepted');
    expect(ok.offer).toMatchObject({ salaryWeekly: 120, seasons: 3 });

    const counter = negotiateOffer(s, 'o_test', { salaryWeekly: 500, seasons: 2 });
    expect(counter.result).toBe('countered');
    expect(counter.offer!.salaryWeekly).toBeGreaterThan(100);
    expect(counter.offer!.salaryWeekly).toBeLessThanOrEqual(130);

    const gone = negotiateOffer(counter.state, 'o_test', { salaryWeekly: 500, seasons: 2 });
    expect(gone.result).toBe('withdrawn');
    expect(gone.state.offers).toEqual([]);
    expect(() => negotiateOffer(s, 'o_test', { salaryWeekly: 100, seasons: 9 })).toThrow();
  });

  it("firmare cambia club, contratto e soldi; rifiutare toglie l'offerta", () => {
    const s = withOffer(start());
    const signed = acceptOffer(s, 'o_test');
    expect(signed.player.clubId).toBe(s.offers[0]!.clubId);
    expect(signed.player.contract).toMatchObject({ salaryWeekly: 100, untilSeason: s.season + 1 });
    expect(signed.player.money.cash).toBe(s.player.money.cash + 200);
    expect(signed.offers).toEqual([]);
    expect(rejectOffer(s, 'o_test').offers).toEqual([]);
  });

  it('a mercato chiuso non si può cambiare squadra', () => {
    let s = start();
    while (getTransferWindow(s)) s = nextWeek(s);
    expect(() => acceptOffer(withOffer(s), 'o_test')).toThrow(/window/);
  });

  it('le richieste nate dagli eventi diventano offerte', () => {
    const s = withSkills({ ...start(), transferRequests: [{ to: 'higher_level', week: 0 }] }, 55);
    const next = refreshMarket({ ...s, week: 1 });
    expect(next.transferRequests).toEqual([]);
    const offer = getOffers(next).find((o) => o.kind === 'transfer');
    expect(offer).toBeDefined();
  });

  it('le offerte sono deterministiche e sopravvivono al salvataggio', () => {
    const s = withSkills(start(), 60);
    const a = refreshMarket({ ...s, week: 1 });
    const b = refreshMarket(deserialize(serialize({ ...s, week: 1 })));
    expect(b).toEqual(a);
  });
});

describe('contratti a fine stagione', () => {
  it('senza rinnovo il contratto scade e un giovane trova comunque squadra', () => {
    const s = endSeason(playToSeasonEnd(withSkills(start(), 30))).state;
    expect(s.player.contract).toBeUndefined();
    expect(s.player.clubId).toBeUndefined();
    expect(s.offers.length).toBeGreaterThan(0);
    const signed = acceptOffer(s, s.offers[0]!.id);
    expect(signed.player.clubId).toBeDefined();
  });

  it("nell'ultima stagione il club propone il rinnovo", () => {
    let s = withSkills(start(), 50);
    while (!s.offers.some((o) => o.kind === 'renewal') && !isSeasonOver(s)) s = nextWeek(s);
    const renewal = s.offers.find((o) => o.kind === 'renewal');
    expect(renewal).toBeDefined();
    const renewed = acceptOffer(s, renewal!.id);
    expect(renewed.player.contract!.untilSeason).toBe(s.season + renewal!.seasons);
    const after = endSeason(playToSeasonEnd(renewed)).state;
    expect(after.player.clubId).toBe(s.player.clubId);
  });

  it('il prestito finisce a fine stagione e si torna a casa', () => {
    const s0 = start();
    const home = s0.player.clubId!;
    const s = withOffer(patchPlayer(s0, { contract: { ...s0.player.contract!, untilSeason: 3 } }), {
      kind: 'loan',
      roundsLeft: 0,
      maxSalary: 100,
      signingBonus: 0,
    });
    const loaned = acceptOffer(s, 'o_test');
    expect(loaned.player.loan).toEqual({ parentClubId: home, untilSeason: s.season });
    expect(loaned.player.clubId).not.toBe(home);
    expect(() => negotiateOffer(s, 'o_test', { salaryWeekly: 500, seasons: 1 })).toThrow();
    const back = endSeason(playToSeasonEnd(loaned)).state;
    expect(back.player.clubId).toBe(home);
    expect(back.player.loan).toBeUndefined();
  });
});

describe('sponsor', () => {
  it('con tanta popolarità arrivano sponsor che pagano ogni settimana', () => {
    let s = patchPlayer(start(), { image: { ...start().player.image, popularity: 80 } });
    for (let i = 0; i < 40 && s.sponsorOffers.length === 0; i++) s = nextWeek(s);
    expect(s.sponsorOffers.length).toBeGreaterThan(0);
    const offer = s.sponsorOffers[0]!;
    s = acceptSponsor(s, offer.id);
    expect(s.player.sponsors).toHaveLength(1);
    const week = advanceWeek(playerFixture(s) ? playMatch(s, () => 0).state : s).report.finance;
    expect(week.sponsors).toBe(offer.weeklyIncome);

    const shoot = getPlanOptions(s).life.find((o) => o.id === 'sponsor')!;
    expect(shoot.available).toBe(true);
    const shot = planWeek(s, { load: 'balanced', life: 'sponsor' });
    expect(shot.state.player.money.cash).toBeGreaterThan(s.player.money.cash);
    expect(shot.report.sponsorIncome).toBe(shot.state.player.money.cash - s.player.money.cash);
  });

  it('senza sponsor niente servizio fotografico', () => {
    const shoot = getPlanOptions(start()).life.find((o) => o.id === 'sponsor')!;
    expect(shoot.available).toBe(false);
    expect(shoot.reasonKey).toBe('week.blocked.no_sponsor');
  });
});

describe('ritiro', () => {
  const aged = (s: GameState, years: number) =>
    patchPlayer(s, { birthWeek: s.week - years * W - 1 });

  it('si può scegliere dai 33 anni, non prima', () => {
    expect(() => retire(start())).toThrow(/33/);
    const r = retire(aged(start(), 34));
    expect(r.retired).toMatchObject({ reason: 'choice', age: 34 });
    expect(() => advanceWeek(r)).toThrow(/over/);
    expect(() => planWeek(r, { load: 'balanced' })).toThrow(/over/);
  });

  it('a 40 anni il ritiro è automatico', () => {
    const s = endSeason(playToSeasonEnd(aged(start(), 39))).state;
    expect(s.retired?.reason).toBe('age');
  });

  it('un trentatreenne senza squadra a fine mercato estivo si ritira', () => {
    let s = endSeason(playToSeasonEnd(withSkills(aged(start(), 34), 20))).state;
    expect(s.player.clubId).toBeUndefined();
    while (!s.retired) {
      s = { ...s, offers: [] };
      s = advanceWeek(s).state;
    }
    expect(s.retired.reason).toBe('no_offers');
  });
});
