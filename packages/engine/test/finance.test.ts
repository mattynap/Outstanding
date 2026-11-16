import { describe, expect, it } from 'vitest';
import {
  advanceWeek,
  annuityPayment,
  applyWeeklyWealth,
  buyInstrument,
  buyProperty,
  createFinance,
  defaultContext,
  depositCash,
  deserialize,
  financeOf,
  loanQuote,
  netWorth,
  newCareer,
  openBusiness,
  repayLoan,
  resolveEvent,
  sellBusiness,
  sellInstrument,
  sellProperty,
  serialize,
  takePersonalLoan,
  updateMarket,
  withdrawCash,
  type GameState,
} from '../src/index';
import { Rng } from '../src/rng';
import { baseOptions } from './fixtures';

const ctx = defaultContext;
const cfg = ctx.config.finance;

/** Giocatore ricco con un buon contratto, per provare acquisti e prestiti. */
function rich(cash = 2_000_000, salary = 20_000): GameState {
  const s = newCareer(baseOptions, 9);
  return {
    ...s,
    player: {
      ...s.player,
      money: { ...s.player.money, cash, salaryWeekly: salary },
      contract: { ...s.player.contract!, salaryWeekly: salary },
    },
  };
}
const week = (s: GameState) => applyWeeklyWealth(s, Rng.fromSeed(1), ctx);

describe('mercato', () => {
  it('è deterministico e non tocca il generatore della carriera', () => {
    const f = createFinance(ctx);
    expect(updateMarket(f, 5, 10, ctx)).toEqual(updateMarket(f, 5, 10, ctx));
    expect(updateMarket(f, 5, 10, ctx).prices).not.toEqual(updateMarket(f, 5, 11, ctx).prices);
    const s = newCareer(baseOptions, 9);
    const next = week(s).state;
    expect(next.rngState).toEqual(s.rngState);
  });

  it('le cripto oscillano più del fondo prudente', () => {
    let f = createFinance(ctx);
    const swings: Record<string, number> = {};
    for (let w = 0; w < 200; w++) {
      const before = f.prices;
      f = updateMarket(f, 77, w, ctx);
      for (const id of Object.keys(f.prices)) {
        swings[id] = (swings[id] ?? 0) + Math.abs(Math.log(f.prices[id]! / before[id]!));
      }
    }
    expect(swings['lirabit']!).toBeGreaterThan(swings['fondo_quieto']! * 4);
    expect(f.history['lirabit']!.length).toBe(cfg.market.historyWeeks);
  });

  it('compra e vende quote con la commissione', () => {
    const s = buyInstrument(rich(), 'azioni_penisola', 10_000, ctx);
    expect(s.player.money.cash).toBe(2_000_000 - 10_000);
    const h = financeOf(s, ctx).holdings['azioni_penisola']!;
    expect(h.units).toBeCloseTo((10_000 * (1 - cfg.market.tradeFee)) / 100);
    const { state, proceeds } = sellInstrument(s, 'azioni_penisola', undefined, ctx);
    expect(proceeds).toBe(Math.round(h.units * 100 * (1 - cfg.market.tradeFee)));
    expect(financeOf(state, ctx).holdings).toEqual({});
    expect(() => buyInstrument(rich(10), 'lirabit', 500, ctx)).toThrow();
  });
});

describe('deposito e beni', () => {
  it('il deposito matura interessi', () => {
    const s = depositCash(rich(), 100_000, ctx);
    const after = week(s).state;
    const rate = cfg.deposit.annualRate / ctx.config.calendar.weeksPerSeason;
    expect(financeOf(after, ctx).deposit).toBe(100_000 + Math.round(100_000 * rate));
    expect(() => withdrawCash(after, 1_000_000, ctx)).toThrow();
    expect(withdrawCash(after, 50_000, ctx).player.money.cash).toBe(
      after.player.money.cash + 50_000,
    );
  });

  it('un bene costa mantenimento, dà felicità e popolarità e cambia valore', () => {
    const s = rich();
    const bought = buyProperty(s, 'motoscafo', null, ctx);
    const item = cfg.properties.catalog.find((p) => p.id === 'motoscafo')!;
    expect(bought.player.money.cash).toBe(s.player.money.cash - item.price);
    expect(bought.player.image.popularity).toBe(s.player.image.popularity + item.popularityOnBuy);
    const after = week(bought).state;
    expect(after.player.money.cash).toBe(bought.player.money.cash - item.upkeepWeekly);
    expect(financeOf(after, ctx).properties[0]!.value).toBeLessThan(item.price);
    const sold = sellProperty(after, financeOf(after, ctx).properties[0]!.id, ctx);
    expect(sold.proceeds).toBeLessThan(item.price);
    expect(financeOf(sold.state, ctx).properties).toEqual([]);
  });
});

describe('prestiti', () => {
  it('calcola la rata e rifiuta chi non ha contratto o chiede troppo', () => {
    expect(annuityPayment(1200, 0, 12)).toBe(100);
    const s = rich();
    const ok = loanQuote(s, 'personal', 100_000, 2, ctx);
    expect(ok.refusal).toBeNull();
    expect(ok.totalRepaid).toBeGreaterThan(100_000);
    expect(loanQuote(s, 'personal', 10_000_000, 1, ctx).refusal).toBe('tooMuch');
    expect(loanQuote(s, 'personal', 1000, 7, ctx).refusal).toBe('badTerm');
    const { contract: _c, ...noClub } = s.player;
    expect(loanQuote({ ...s, player: noClub }, 'personal', 1000, 1, ctx).refusal).toBe(
      'noContract',
    );
  });

  it('il mutuo paga l’anticipo, le rate scendono e si estingue', () => {
    const s = rich(300_000);
    const bought = buyProperty(s, 'appartamento', 10, ctx);
    const item = cfg.properties.catalog.find((p) => p.id === 'appartamento')!;
    const down = Math.round(item.price * cfg.loans.mortgage.downPayment);
    expect(bought.player.money.cash).toBe(300_000 - down);
    const loan = financeOf(bought, ctx).loans[0]!;
    expect(loan.kind).toBe('mortgage');
    const after = week(bought).state;
    const l2 = financeOf(after, ctx).loans[0]!;
    expect(l2.remaining).toBeLessThan(loan.remaining);
    expect(l2.weeksLeft).toBe(loan.weeksLeft - 1);
    const repaid = repayLoan(after, l2.id, ctx);
    expect(financeOf(repaid, ctx).loans).toEqual([]);
    expect(() => buyProperty(s, 'yacht', 10, ctx)).toThrow();
  });

  it('dopo troppe rate saltate la banca pignora il bene', () => {
    let s = buyProperty(rich(300_000), 'appartamento', 15, ctx);
    s = { ...s, player: { ...s.player, money: { ...s.player.money, cash: 0 } } };
    for (let i = 0; i < cfg.loans.missedToDefault; i++) s = week(s).state;
    expect(financeOf(s, ctx).properties).toEqual([]);
    expect(financeOf(s, ctx).loans).toEqual([]);
  });

  it('il prestito personale arriva in cassa', () => {
    const s = takePersonalLoan(rich(0), 50_000, 1, ctx);
    expect(s.player.money.cash).toBe(50_000);
    expect(financeOf(s, ctx).loans[0]!.kind).toBe('personal');
  });
});

describe('attività', () => {
  it('si apre, rende o perde secondo l’andamento e si vende', () => {
    let s = openBusiness(rich(), 'ristorante', '  Da Tommaso ', ctx);
    const biz = financeOf(s, ctx).businesses[0]!;
    expect(biz.name).toBe('Da Tommaso');
    let total = 0;
    for (let i = 0; i < 20; i++) {
      const r = week(s);
      total += r.wealth.businessIncome;
      s = r.state;
    }
    expect(financeOf(s, ctx).businesses[0]!.totalResult).toBe(total);
    const sold = sellBusiness(s, biz.id, ctx);
    expect(sold.proceeds).toBeGreaterThan(0);
    expect(() => openBusiness(rich(10), 'marchio', 'X', ctx)).toThrow();
  });

  it('le notizie di affari parlano dell’attività principale e ne cambiano l’andamento', () => {
    let s = openBusiness(rich(), 'bar', 'Bar Centrale', ctx);
    s = { ...s, pendingEvents: [{ eventId: 'attivita_recensione_01', textVariant: 1 }] };
    const before = financeOf(s, ctx).businesses[0]!.health;
    const { state, report } = resolveEvent(s, 'attivita_recensione_01', 2, ctx);
    expect(financeOf(state, ctx).businesses[0]!.health).toBe(before - 9);
    expect(report.changes).toContainEqual({
      kind: 'business',
      name: 'Bar Centrale',
      before,
      after: before - 9,
    });
  });
});

describe('patrimonio e salvataggi', () => {
  it('somma tutto meno i debiti, e sopravvive al salvataggio', () => {
    let s = depositCash(rich(500_000), 100_000, ctx);
    s = buyProperty(s, 'appartamento', 10, ctx);
    const nw = netWorth(s, ctx);
    expect(nw.total).toBe(
      nw.cash + nw.deposit + nw.investments + nw.properties + nw.businesses - nw.debts,
    );
    expect(deserialize(serialize(s)).finance).toEqual(s.finance);
  });

  it('una settimana normale aggiorna il mercato e i salvataggi vecchi ripartono da zero', () => {
    const s = newCareer(baseOptions, 9);
    const { finance: _f, ...old } = s;
    expect(financeOf(old as GameState, ctx)).toEqual(createFinance(ctx));
    const next = advanceWeek(s, ctx);
    expect(next.report.wealth.loanPayments).toBe(0);
    expect(next.state.finance!.history['lirabit']!.length).toBe(2);
  });
});
