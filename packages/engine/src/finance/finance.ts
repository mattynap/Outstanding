import type { FinanceConfig } from '@outstanding/config';
import { defaultContext, type GameContext } from '../context';
import { Rng } from '../rng';
import type { Business, Finance, GameState, Loan, OwnedProperty, Player } from '../types';
import { clamp } from '../util';
import { IdGen } from '../world/generate';
import { followersBonus } from '../media/media';

type PropertyItem = FinanceConfig['properties']['catalog'][number];
type BusinessItem = FinanceConfig['businesses']['catalog'][number];
export type LoanKind = Loan['kind'];

const money = (v: number) => Math.round(v);

/** Patrimonio iniziale: niente di niente, prezzi di partenza del mercato. */
export function createFinance(ctx: GameContext = defaultContext): Finance {
  const prices: Record<string, number> = {};
  const history: Record<string, number[]> = {};
  for (const i of ctx.config.finance.market.instruments) {
    prices[i.id] = i.startPrice;
    history[i.id] = [i.startPrice];
  }
  return { deposit: 0, prices, history, holdings: {}, properties: [], businesses: [], loans: [] };
}

/** Patrimonio della carriera (i salvataggi senza patrimonio partono da zero). */
export function financeOf(state: GameState, ctx: GameContext = defaultContext): Finance {
  return state.finance ?? createFinance(ctx);
}

const withFinance = (state: GameState, finance: Finance, player: Player = state.player) => ({
  ...state,
  player,
  finance,
});
const withCash = (p: Player, delta: number): Player => ({
  ...p,
  money: { ...p.money, cash: money(p.money.cash + delta) },
});

function weeklyRate(annual: number, ctx: GameContext): number {
  return annual / ctx.config.calendar.weeksPerSeason;
}

function propertyItem(id: string, ctx: GameContext): PropertyItem {
  const item = ctx.config.finance.properties.catalog.find((p) => p.id === id);
  if (!item) throw new Error(`Unknown property "${id}"`);
  return item;
}

function businessItem(id: string, ctx: GameContext): BusinessItem {
  const item = ctx.config.finance.businesses.catalog.find((b) => b.id === id);
  if (!item) throw new Error(`Unknown business "${id}"`);
  return item;
}

function requireAmount(amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be positive');
}

// --- Mercato ----------------------------------------------------------------------------------

/**
 * Prezzi della settimana. Il mercato usa un generatore ricavato da seme e settimana: è
 * deterministico ma non consuma il generatore della carriera, così il resto del gioco non cambia.
 */
export function updateMarket(
  finance: Finance,
  seed: number,
  week: number,
  ctx: GameContext = defaultContext,
): Finance {
  const m = ctx.config.finance.market;
  const rng = Rng.fromSeed((seed ^ Math.imul(week + 1, 0x9e3779b1)) >>> 0);
  const weeks = ctx.config.calendar.weeksPerSeason;
  const prices = { ...finance.prices };
  const history = { ...finance.history };
  for (const i of m.instruments) {
    const before = prices[i.id] ?? i.startPrice;
    let ret = Math.log(1 + i.driftPerSeason) / weeks + rng.normal(0, i.volatilityWeekly);
    if (rng.chance(i.crashChance)) ret += Math.log(1 - rng.float(i.crashDrop[0], i.crashDrop[1]));
    if (rng.chance(i.boomChance)) ret += Math.log(1 + rng.float(i.boomRise[0], i.boomRise[1]));
    const after = Math.max(m.minPrice, Math.round(before * Math.exp(ret) * 100) / 100);
    prices[i.id] = after;
    history[i.id] = [...(history[i.id] ?? []), after].slice(-m.historyWeeks);
  }
  return { ...finance, prices, history };
}

/** Compra quote di un titolo spendendo `amount` euro (commissione compresa). */
export function buyInstrument(
  state: GameState,
  instrumentId: string,
  amount: number,
  ctx: GameContext = defaultContext,
): GameState {
  requireAmount(amount);
  if (amount > state.player.money.cash) throw new Error('Not enough money');
  const f = financeOf(state, ctx);
  const price = f.prices[instrumentId];
  if (price === undefined) throw new Error(`Unknown instrument "${instrumentId}"`);
  const units = (amount * (1 - ctx.config.finance.market.tradeFee)) / price;
  const cur = f.holdings[instrumentId] ?? { units: 0, invested: 0 };
  const holdings = {
    ...f.holdings,
    [instrumentId]: { units: cur.units + units, invested: cur.invested + amount },
  };
  return withFinance(state, { ...f, holdings }, withCash(state.player, -amount));
}

/** Vende quote di un titolo (tutte se `units` manca). Restituisce l'incasso netto. */
export function sellInstrument(
  state: GameState,
  instrumentId: string,
  units?: number,
  ctx: GameContext = defaultContext,
): { state: GameState; proceeds: number } {
  const f = financeOf(state, ctx);
  const cur = f.holdings[instrumentId];
  if (!cur || cur.units <= 0) throw new Error(`No holding in "${instrumentId}"`);
  const sold = Math.min(cur.units, units ?? cur.units);
  if (!(sold > 0)) throw new Error('Units must be positive');
  const price = f.prices[instrumentId]!;
  const proceeds = money(sold * price * (1 - ctx.config.finance.market.tradeFee));
  const left = cur.units - sold;
  const holdings = { ...f.holdings };
  if (left <= 1e-9) delete holdings[instrumentId];
  else holdings[instrumentId] = { units: left, invested: (cur.invested * left) / cur.units };
  return {
    state: withFinance(state, { ...f, holdings }, withCash(state.player, proceeds)),
    proceeds,
  };
}

// --- Conto deposito ---------------------------------------------------------------------------

export function depositCash(state: GameState, amount: number, ctx = defaultContext): GameState {
  requireAmount(amount);
  if (amount > state.player.money.cash) throw new Error('Not enough money');
  const f = financeOf(state, ctx);
  return withFinance(
    state,
    { ...f, deposit: money(f.deposit + amount) },
    withCash(state.player, -amount),
  );
}

export function withdrawCash(state: GameState, amount: number, ctx = defaultContext): GameState {
  requireAmount(amount);
  const f = financeOf(state, ctx);
  if (amount > f.deposit) throw new Error('Not enough on deposit');
  return withFinance(
    state,
    { ...f, deposit: money(f.deposit - amount) },
    withCash(state.player, amount),
  );
}

// --- Prestiti ---------------------------------------------------------------------------------

/** Rata settimanale costante (ammortamento alla francese). */
export function annuityPayment(principal: number, weeklyRate: number, weeks: number): number {
  if (weeklyRate === 0) return principal / weeks;
  return (principal * weeklyRate) / (1 - (1 + weeklyRate) ** -weeks);
}

export interface LoanQuote {
  principal: number;
  weeklyPayment: number;
  weeks: number;
  weeklyRate: number;
  /** Totale che si restituisce alla banca. */
  totalRepaid: number;
  /** Motivo del rifiuto, se la banca dice di no. */
  refusal: 'noContract' | 'tooMuch' | 'badTerm' | null;
}

/**
 * Preventivo della banca. Concede solo a chi ha un contratto e se tutte le rate, nuove e vecchie,
 * restano entro una quota dello stipendio.
 */
export function loanQuote(
  state: GameState,
  kind: LoanKind,
  principal: number,
  seasons: number,
  ctx: GameContext = defaultContext,
): LoanQuote {
  const l = ctx.config.finance.loans;
  const terms = kind === 'mortgage' ? l.mortgage : l.personal;
  const weeks = seasons * ctx.config.calendar.weeksPerSeason;
  const rate = weeklyRate(terms.annualRate, ctx);
  const payment = annuityPayment(principal, rate, weeks);
  const quote: LoanQuote = {
    principal,
    weeklyPayment: money(payment),
    weeks,
    weeklyRate: rate,
    totalRepaid: money(payment * weeks),
    refusal: null,
  };
  const salary = state.player.contract?.salaryWeekly ?? 0;
  if (!terms.seasons.includes(seasons)) return { ...quote, refusal: 'badTerm' };
  if (!state.player.contract || salary <= 0) return { ...quote, refusal: 'noContract' };
  const current = financeOf(state, ctx).loans.reduce((s, x) => s + x.weeklyPayment, 0);
  const tooMuch =
    current + payment > salary * l.maxPaymentShareOfSalary ||
    (kind === 'personal' && principal > salary * l.personal.maxWeeksOfSalary);
  return tooMuch ? { ...quote, refusal: 'tooMuch' } : quote;
}

function newLoan(id: string, q: LoanQuote, kind: LoanKind, propertyId?: string): Loan {
  return {
    id,
    kind,
    ...(propertyId ? { propertyId } : {}),
    principal: q.principal,
    remaining: q.principal,
    weeklyPayment: q.weeklyPayment,
    weeklyRate: q.weeklyRate,
    weeksLeft: q.weeks,
    missed: 0,
  };
}

/** Prestito personale: i soldi arrivano subito in cassa. */
export function takePersonalLoan(
  state: GameState,
  amount: number,
  seasons: number,
  ctx: GameContext = defaultContext,
): GameState {
  requireAmount(amount);
  const q = loanQuote(state, 'personal', money(amount), seasons, ctx);
  if (q.refusal) throw new Error(`Loan refused: ${q.refusal}`);
  const ids = new IdGen(state.nextId);
  const f = financeOf(state, ctx);
  const loan = newLoan(ids.make('l'), q, 'personal');
  return {
    ...withFinance(state, { ...f, loans: [...f.loans, loan] }, withCash(state.player, q.principal)),
    nextId: ids.next,
  };
}

/** Estingue un prestito pagando tutto il debito residuo. */
export function repayLoan(state: GameState, loanId: string, ctx = defaultContext): GameState {
  const f = financeOf(state, ctx);
  const loan = f.loans.find((l) => l.id === loanId);
  if (!loan) throw new Error(`Unknown loan "${loanId}"`);
  const due = money(loan.remaining);
  if (due > state.player.money.cash) throw new Error('Not enough money');
  return withFinance(
    state,
    { ...f, loans: f.loans.filter((l) => l.id !== loanId) },
    withCash(state.player, -due),
  );
}

// --- Beni -------------------------------------------------------------------------------------

/**
 * Compra un bene. Con `mortgageSeasons` (solo immobili) si paga l'anticipo e il resto con un mutuo.
 */
export function buyProperty(
  state: GameState,
  catalogId: string,
  mortgageSeasons: number | null = null,
  ctx: GameContext = defaultContext,
): GameState {
  const item = propertyItem(catalogId, ctx);
  const f = financeOf(state, ctx);
  const ids = new IdGen(state.nextId);
  const property: OwnedProperty = {
    id: ids.make('b'),
    catalogId,
    boughtWeek: state.week,
    price: item.price,
    value: item.price,
  };
  let loans = f.loans;
  let pay = item.price;
  if (mortgageSeasons !== null) {
    if (!item.mortgage) throw new Error(`"${catalogId}" cannot be bought with a mortgage`);
    pay = money(item.price * ctx.config.finance.loans.mortgage.downPayment);
    const q = loanQuote(state, 'mortgage', item.price - pay, mortgageSeasons, ctx);
    if (q.refusal) throw new Error(`Mortgage refused: ${q.refusal}`);
    loans = [...loans, newLoan(ids.make('l'), q, 'mortgage', property.id)];
  }
  if (pay > state.player.money.cash) throw new Error('Not enough money');
  let player = withCash(state.player, -pay);
  player = {
    ...player,
    image: {
      ...player.image,
      popularity: clamp(player.image.popularity + item.popularityOnBuy, 0, 100),
    },
  };
  return {
    ...withFinance(state, { ...f, properties: [...f.properties, property], loans }, player),
    nextId: ids.next,
  };
}

/** Vende un bene al valore attuale meno la commissione; il mutuo residuo si estingue col ricavato. */
export function sellProperty(
  state: GameState,
  propertyId: string,
  ctx: GameContext = defaultContext,
): { state: GameState; proceeds: number } {
  const f = financeOf(state, ctx);
  const property = f.properties.find((p) => p.id === propertyId);
  if (!property) throw new Error(`Unknown property "${propertyId}"`);
  const loan = f.loans.find((l) => l.propertyId === propertyId);
  const gross = property.value * (1 - ctx.config.finance.properties.sellFee);
  const proceeds = money(gross - (loan?.remaining ?? 0));
  const finance = {
    ...f,
    properties: f.properties.filter((p) => p.id !== propertyId),
    loans: f.loans.filter((l) => l !== loan),
  };
  return { state: withFinance(state, finance, withCash(state.player, proceeds)), proceeds };
}

// --- Attività ---------------------------------------------------------------------------------

export function openBusiness(
  state: GameState,
  catalogId: string,
  name: string,
  ctx: GameContext = defaultContext,
): GameState {
  const item = businessItem(catalogId, ctx);
  const b = ctx.config.finance.businesses;
  const f = financeOf(state, ctx);
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!clean || clean.length > ctx.config.editor.limits.clubName) throw new Error('Invalid name');
  if (f.businesses.length >= b.maxOpen) throw new Error('Too many businesses');
  if (item.cost > state.player.money.cash) throw new Error('Not enough money');
  const ids = new IdGen(state.nextId);
  const business: Business = {
    id: ids.make('a'),
    catalogId,
    name: clean,
    openedWeek: state.week,
    cost: item.cost,
    health: b.healthStart,
    lastResult: 0,
    totalResult: 0,
  };
  return {
    ...withFinance(
      state,
      { ...f, businesses: [...f.businesses, business] },
      withCash(state.player, -item.cost),
    ),
    nextId: ids.next,
  };
}

/** Valore di vendita di un'attività: quota del costo secondo l'andamento. */
export function businessValue(business: Business, ctx: GameContext = defaultContext): number {
  return money((business.cost * ctx.config.finance.businesses.saleShare * business.health) / 100);
}

export function sellBusiness(
  state: GameState,
  businessId: string,
  ctx: GameContext = defaultContext,
): { state: GameState; proceeds: number } {
  const f = financeOf(state, ctx);
  const business = f.businesses.find((x) => x.id === businessId);
  if (!business) throw new Error(`Unknown business "${businessId}"`);
  const proceeds = businessValue(business, ctx);
  const finance = { ...f, businesses: f.businesses.filter((x) => x !== business) };
  return { state: withFinance(state, finance, withCash(state.player, proceeds)), proceeds };
}

/** L'attività principale (la più vecchia ancora aperta): è quella di cui parlano le notizie. */
export function mainBusiness(state: GameState): Business | undefined {
  return state.finance?.businesses[0];
}

/** Cambia l'andamento dell'attività principale (effetto delle notizie). */
export function shiftMainBusiness(state: GameState, delta: number): GameState {
  const main = mainBusiness(state);
  if (!main || !state.finance) return state;
  const health = clamp(main.health + delta, 0, 100);
  const businesses = state.finance.businesses.map((b) => (b === main ? { ...b, health } : b));
  return { ...state, finance: { ...state.finance, businesses } };
}

// --- Settimana --------------------------------------------------------------------------------

/** Movimenti della settimana dovuti al patrimonio. */
export interface WealthWeek {
  interest: number;
  upkeep: number;
  loanPayments: number;
  businessIncome: number;
  /** Rate non pagate questa settimana. */
  missedPayments: number;
  /** Beni o attività pignorati dalla banca. */
  seized: string[];
  /** Attività fallite. */
  closed: string[];
}

/** Il bene o l'attività più preziosi da pignorare per un prestito personale. */
function seizeFor(
  f: Finance,
  ctx: GameContext,
): { finance: Finance; value: number; name: string } | null {
  const free = f.properties.filter((p) => !f.loans.some((l) => l.propertyId === p.id));
  const prop = [...free].sort((a, b) => b.value - a.value)[0];
  const biz = [...f.businesses].sort((a, b) => businessValue(b, ctx) - businessValue(a, ctx))[0];
  const propValue = prop ? prop.value * (1 - ctx.config.finance.properties.sellFee) : -1;
  const bizValue = biz ? businessValue(biz, ctx) : -1;
  if (propValue < 0 && bizValue < 0) return null;
  if (propValue >= bizValue && prop) {
    return {
      finance: { ...f, properties: f.properties.filter((p) => p !== prop) },
      value: propValue,
      name: prop.catalogId,
    };
  }
  return {
    finance: { ...f, businesses: f.businesses.filter((b) => b !== biz) },
    value: bizValue,
    name: biz!.catalogId,
  };
}

/**
 * Patrimonio a fine settimana: mercato, interessi del deposito, rivalutazione e mantenimento dei
 * beni, felicità che danno, rate dei prestiti (con pignoramento dopo troppe rate saltate) e
 * rendita delle attività.
 */
export function applyWeeklyWealth(
  state: GameState,
  rng: Rng,
  ctx: GameContext = defaultContext,
): { state: GameState; wealth: WealthWeek } {
  const cfg = ctx.config.finance;
  const weeks = ctx.config.calendar.weeksPerSeason;
  let f = updateMarket(financeOf(state, ctx), state.seed, state.week, ctx);
  let p = state.player;
  const w: WealthWeek = {
    interest: 0,
    upkeep: 0,
    loanPayments: 0,
    businessIncome: 0,
    missedPayments: 0,
    seized: [],
    closed: [],
  };

  // Deposito: gli interessi restano sul conto.
  w.interest = money(f.deposit * weeklyRate(cfg.deposit.annualRate, ctx));
  f = { ...f, deposit: f.deposit + w.interest };

  // Beni: valore, mantenimento, felicità.
  let happiness = 0;
  f = {
    ...f,
    properties: f.properties.map((prop) => {
      const item = propertyItem(prop.catalogId, ctx);
      w.upkeep += item.upkeepWeekly;
      happiness += item.happinessPerWeek;
      return { ...prop, value: money(prop.value * (1 + item.valuePerSeason) ** (1 / weeks)) };
    }),
  };
  happiness = Math.min(happiness, cfg.properties.maxHappinessPerWeek);
  p = withCash(p, -w.upkeep);

  // Attività: andamento e rendita (il caso entra solo se ce ne sono).
  const b = cfg.businesses;
  const businesses: Business[] = [];
  for (const biz of f.businesses) {
    const item = businessItem(biz.catalogId, ctx);
    const health = clamp(
      biz.health + (b.healthTarget - biz.health) * b.healthDrift + rng.normal(0, b.healthNoise),
      0,
      100,
    );
    if (health < b.closeBelowHealth) {
      w.closed.push(biz.name);
      continue;
    }
    const result = money(
      ((item.baseWeekly * (health - b.breakEvenHealth)) / b.healthScale) *
        (1 + p.image.popularity * item.popularityBonus) *
        (1 +
          followersBonus(p.image.followers, ctx) * ctx.config.media.followers.value.businessShare) *
        (1 + rng.normal(0, b.incomeNoise)),
    );
    w.businessIncome += result;
    businesses.push({
      ...biz,
      health: Math.round(health * 10) / 10,
      lastResult: result,
      totalResult: biz.totalResult + result,
    });
  }
  f = { ...f, businesses };
  p = withCash(p, w.businessIncome);

  // Prestiti: rata se c'è la cassa, altrimenti rata saltata e, alla lunga, pignoramento.
  const l = cfg.loans;
  const loans: Loan[] = [];
  for (const loan of f.loans) {
    const grown = loan.remaining * (1 + loan.weeklyRate);
    if (p.money.cash >= loan.weeklyPayment) {
      p = withCash(p, -loan.weeklyPayment);
      w.loanPayments += loan.weeklyPayment;
      const remaining = grown - loan.weeklyPayment;
      if (loan.weeksLeft > 1 && remaining > 1) {
        loans.push({ ...loan, remaining, weeksLeft: loan.weeksLeft - 1, missed: 0 });
      }
      continue;
    }
    w.missedPayments++;
    const missed = loan.missed + 1;
    p = {
      ...p,
      persona: { ...p.persona, happiness: clamp(p.persona.happiness + l.missedHappiness, 0, 100) },
      condition: { ...p.condition, morale: clamp(p.condition.morale + l.missedMorale, 0, 100) },
    };
    if (missed < l.missedToDefault) {
      loans.push({ ...loan, remaining: grown, missed });
      continue;
    }
    // Pignoramento: la banca vende e restituisce l'eventuale eccedenza.
    if (loan.kind === 'mortgage') {
      const prop = f.properties.find((x) => x.id === loan.propertyId);
      if (prop) {
        const surplus = prop.value * (1 - cfg.properties.sellFee) - grown;
        f = { ...f, properties: f.properties.filter((x) => x !== prop) };
        p = withCash(p, Math.max(0, surplus));
        w.seized.push(prop.catalogId);
        continue;
      }
    } else {
      const seized = seizeFor(f, ctx);
      if (seized) {
        f = seized.finance;
        p = withCash(p, Math.max(0, seized.value - grown));
        w.seized.push(seized.name);
        if (seized.value >= grown) continue;
        loans.push({ ...loan, remaining: grown - seized.value, missed: 0 });
        continue;
      }
    }
    loans.push({ ...loan, remaining: grown, missed: 0 });
  }
  f = { ...f, loans };

  p = {
    ...p,
    persona: { ...p.persona, happiness: clamp(p.persona.happiness + happiness, 0, 100) },
  };
  return { state: { ...state, player: p, finance: f }, wealth: w };
}

/** Patrimonio netto, voce per voce. */
export function netWorth(state: GameState, ctx: GameContext = defaultContext) {
  const f = financeOf(state, ctx);
  const investments = Object.entries(f.holdings).reduce(
    (s, [id, h]) => s + h.units * (f.prices[id] ?? 0),
    0,
  );
  const properties = f.properties.reduce((s, p) => s + p.value, 0);
  const businesses = f.businesses.reduce((s, b) => s + businessValue(b, ctx), 0);
  const debts = f.loans.reduce((s, l) => s + l.remaining, 0);
  const cash = state.player.money.cash;
  return {
    cash,
    deposit: f.deposit,
    investments: money(investments),
    properties: money(properties),
    businesses: money(businesses),
    debts: money(debts),
    total: money(cash + f.deposit + investments + properties + businesses - debts),
  };
}
