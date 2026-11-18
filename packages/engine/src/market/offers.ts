import { followersBonus, welcomeToClub } from '../media/media';
import { defaultContext, type GameContext } from '../context';
import { difficultyMods } from '../difficulty';
import { computeOvr } from '../player/ratings';
import { Rng } from '../rng';
import { getTransferWindow } from '../season/week';
import { ageAt, seasonStartWeek, weekOfSeason } from '../time';
import type { Club, ContractOffer, GameState, Player, Retirement } from '../types';
import { clamp } from '../util';
import { moveScout } from '../match/stakes';
import { IdGen } from '../world/generate';
import { getClub, getGroup } from '../world/queries';

/** Offerta come la vede il giocatore (senza il tetto nascosto del club). */
export interface OfferView {
  id: string;
  kind: ContractOffer['kind'];
  clubId: string;
  clubName: string;
  level: number;
  salaryWeekly: number;
  seasons: number;
  signingBonus: number;
  expiresWeek: number;
}

export type NegotiationResult = 'accepted' | 'countered' | 'withdrawn';

type Relation = 'higher' | 'same' | 'lower';

export function clubLevel(state: GameState, clubId: string): number {
  return getGroup(state.world, getClub(state.world, clubId).groupId).league.level;
}

const age = (state: GameState, ctx: GameContext) =>
  ageAt(state.player.birthWeek, state.week, ctx.config.calendar);

/** OVR come lo vedono gli osservatori: ai giovani si concede un margine per la crescita. */
export function perceivedOvr(state: GameState, ctx: GameContext): number {
  const o = ctx.config.economy.offers;
  const ovr = computeOvr(state.player.skills, state.player.role, ctx.config.ratings);
  const a = age(state, ctx);
  return (
    ovr +
    Math.max(0, o.youthBonusUntilAge - a) * o.youthBonusPerYear -
    Math.max(0, a - o.agePenaltyFromAge) * o.agePenaltyPerYear
  );
}

/** Stipendio di mercato per un livello, in base a dove si colloca il giocatore nella fascia del livello. */
export function marketSalary(level: number, ovr: number, ctx: GameContext): number {
  const band = ctx.config.economy.salaryByLevel.find((b) => b.level === level);
  const levelCfg = ctx.config.world.levels.find((l) => l.level === level);
  if (!band || !levelCfg) throw new Error(`No salary band for level ${level}`);
  const [lo, hi] = levelCfg.ratingRange;
  const t = clamp((ovr - lo) / Math.max(1, hi - lo), 0, 1);
  return band.min + t * (band.max - band.min);
}

/** Stipendio che un club offre davvero: quello di mercato corretto per la difficoltà della carriera. */
function offeredSalary(state: GameState, level: number, ovr: number, ctx: GameContext): number {
  return marketSalary(level, ovr, ctx) * difficultyMods(state, ctx).salary;
}

const roundSalary = (v: number, ctx: GameContext) => {
  const step = ctx.config.economy.salaryRound;
  return Math.max(step, Math.round(v / step) * step);
};

function agentQuality(state: GameState): number {
  const id = state.player.agentId;
  return (id && state.world.npcs.find((n) => n.id === id)?.quality) || 0;
}

/** Livello di riferimento: quello del club attuale, o dell'ultima stagione giocata. */
function currentLevel(state: GameState, ctx: GameContext): number {
  if (state.player.clubId) return clubLevel(state, state.player.clubId);
  const last = [...state.player.history].reverse().find((h) => h.leagueLevel !== null);
  return last?.leagueLevel ?? ctx.config.world.defaultStartLevel;
}

function seasonsFor(state: GameState, rng: Rng, ctx: GameContext): number {
  const bands = ctx.config.economy.offers.seasonsByAge;
  const a = age(state, ctx);
  const band = bands.find((b) => a <= b.maxAge) ?? bands[bands.length - 1]!;
  return rng.int(band.min, band.max);
}

/** Ultima settimana assoluta in cui l'offerta resta valida. */
function expiry(state: GameState, ctx: GameContext, kind: ContractOffer['kind']): number {
  const cal = ctx.config.calendar;
  const start = seasonStartWeek(state.season, cal);
  if (kind === 'renewal') return start + cal.weeksPerSeason - 1;
  let until = state.week + ctx.config.economy.offers.lifetimeWeeks - 1;
  const window = getTransferWindow(state, ctx);
  if (state.player.clubId && window) {
    until = Math.min(until, start + cal.transferWindows[window].toWeek);
  }
  return until;
}

function buildOffer(
  state: GameState,
  club: Club,
  kind: ContractOffer['kind'],
  salary: number,
  seasons: number,
  rng: Rng,
  ids: IdGen,
  ctx: GameContext,
): ContractOffer {
  const e = ctx.config.economy;
  const salaryWeekly = roundSalary(salary, ctx);
  const room =
    kind === 'loan'
      ? 0
      : rng.float(e.negotiation.roomMin, e.negotiation.roomMax) +
        agentQuality(state) * e.agents.negotiationRoomPerQuality;
  return {
    id: ids.make('o'),
    kind,
    clubId: club.id,
    salaryWeekly,
    seasons,
    signingBonus:
      kind === 'transfer'
        ? salaryWeekly * rng.int(e.offers.signingBonusWeeks[0], e.offers.signingBonusWeeks[1])
        : 0,
    expiresWeek: expiry(state, ctx, kind),
    maxSalary: roundSalary(salaryWeekly * (1 + room), ctx),
    roundsLeft: kind === 'loan' ? 0 : e.negotiation.rounds,
  };
}

/**
 * Cerca un club interessato al giocatore: livello vicino a quello attuale (preferendo quelli più
 * alti), rating compatibile con l'OVR percepito. `fallback` = squadre più deboli, per non lasciare
 * senza contratto un giovane.
 */
function transferOffer(
  state: GameState,
  rng: Rng,
  ids: IdGen,
  ctx: GameContext,
  opts: { relation?: Relation; fallback?: boolean } = {},
): ContractOffer | null {
  const o = ctx.config.economy.offers;
  const perceived = perceivedOvr(state, ctx);
  const cur = currentLevel(state, ctx);
  const exclude = new Set([
    state.player.clubId,
    state.player.loan?.parentClubId,
    ...state.offers.map((x) => x.clubId),
  ]);
  const relationOf = (level: number): Relation =>
    level < cur ? 'higher' : level === cur ? 'same' : 'lower';

  const candidates = state.world.clubs.flatMap((club) => {
    if (exclude.has(club.id)) return [];
    const level = clubLevel(state, club.id);
    const relation = relationOf(level);
    const fit = perceived - club.rating;
    if (opts.fallback) return fit >= 0 && relation !== 'higher' ? [{ club, level, relation }] : [];
    if (cur - level > o.maxLevelsUp || level - cur > o.maxLevelsDown) return [];
    if (opts.relation && relation !== opts.relation) return [];
    if (fit < o.minFit || fit > o.maxFit) return [];
    return [{ club, level, relation }];
  });
  if (candidates.length === 0) return null;
  // Nella ricerca di ripiego si preferisce il livello più alto disponibile.
  const pool = opts.fallback
    ? candidates.filter((c) => c.level === Math.min(...candidates.map((x) => x.level)))
    : candidates;
  const pick = rng.weighted(pool, (c) => o.levelWeights[c.relation]);
  const ovr = computeOvr(state.player.skills, state.player.role, ctx.config.ratings);
  const salary =
    offeredSalary(state, pick.level, ovr, ctx) * (1 + rng.float(-o.salaryNoise, o.salaryNoise));
  return buildOffer(
    state,
    pick.club,
    'transfer',
    salary,
    seasonsFor(state, rng, ctx),
    rng,
    ids,
    ctx,
  );
}

function retirePlayer(state: GameState, reason: Retirement['reason'], ctx: GameContext): GameState {
  const { clubId: _club, loan: _loan, contract: _contract, ...player } = state.player;
  return {
    ...state,
    player: { ...player, money: { ...player.money, salaryWeekly: 0 } },
    offers: [],
    sponsorOffers: [],
    retired: { season: state.season, week: state.week, age: age(state, ctx), reason },
  };
}

/**
 * Aggiornamento settimanale del mercato: scadenza delle offerte, nuove offerte (in finestra di
 * mercato o da svincolato), richieste nate dagli eventi, rinnovo, prestiti, sponsor e ritiro per
 * mancanza di offerte. Una sola volta per settimana.
 */
export function refreshMarket(state: GameState, ctx: GameContext = defaultContext): GameState {
  if (state.retired || state.marketWeek === state.week) return state;
  const e = ctx.config.economy;
  const cal = ctx.config.calendar;
  const rng = Rng.fromState(state.rngState);
  const ids = new IdGen(state.nextId);
  const p = state.player;
  const window = getTransferWindow(state, ctx);
  const seasonWeek = weekOfSeason(state.week, cal);
  const freeAgent = !p.clubId;
  const a = age(state, ctx);

  let s: GameState = {
    ...state,
    offers: state.offers.filter(
      (o) => o.expiresWeek >= state.week && (o.kind === 'renewal' || freeAgent || window),
    ),
    sponsorOffers: state.sponsorOffers.filter((o) => o.expiresWeek >= state.week),
  };

  if (freeAgent && a >= e.retirement.minAge && seasonWeek > cal.transferWindows.summer.toWeek) {
    const retired = retirePlayer(s, 'no_offers', ctx);
    return { ...retired, marketWeek: state.week, rngState: rng.getState(), nextId: ids.next };
  }

  const add = (offer: ContractOffer | null) => {
    if (offer) s = { ...s, offers: [...s.offers, offer] };
  };
  const transfers = () => s.offers.filter((o) => o.kind !== 'renewal').length;

  if (window || freeAgent) {
    for (const req of s.transferRequests) {
      const relation: Relation =
        req.to === 'higher_level' ? 'higher' : req.to === 'same_level' ? 'same' : 'lower';
      add(transferOffer(s, rng, ids, ctx, { relation }));
    }
    s = { ...s, transferRequests: [] };

    const base = freeAgent ? e.offers.freeAgentWeeklyChance : e.offers.weeklyChance;
    const chance = clamp(
      base *
        (1 + p.image.popularity * e.offers.popularityFactor) *
        (1 + (p.condition.form - 50) * e.offers.formFactor) *
        (1 + agentQuality(s) * e.agents.offerChanceBonusPerQuality) *
        difficultyMods(s, ctx).offerChance,
      0,
      1,
    );
    if (transfers() < e.offers.maxOpen && rng.chance(chance)) add(transferOffer(s, rng, ids, ctx));
    if (freeAgent && a < e.retirement.minAge && transfers() === 0) {
      add(transferOffer(s, rng, ids, ctx, { fallback: true }));
    }
  }

  const flag = `renewal_${state.season}`;
  if (
    p.clubId &&
    p.contract &&
    !p.loan &&
    p.contract.untilSeason === state.season &&
    seasonWeek >= e.renewal.fromSeasonWeek &&
    !p.flags[flag]
  ) {
    const club = getClub(s.world, p.clubId);
    const fit = perceivedOvr(s, ctx) - club.rating;
    const trust = p.relationships[club.coachId] ?? 0;
    if (fit + trust * e.renewal.trustBonusPerPoint >= e.renewal.minFit) {
      const ovr = computeOvr(p.skills, p.role, ctx.config.ratings);
      const salary = Math.max(
        p.contract.salaryWeekly * (1 + e.renewal.raise),
        offeredSalary(s, clubLevel(s, club.id), ovr, ctx),
      );
      add(buildOffer(s, club, 'renewal', salary, seasonsFor(s, rng, ctx), rng, ids, ctx));
    }
    s = { ...s, player: { ...s.player, flags: { ...s.player.flags, [flag]: true } } };
  }

  if (p.clubId && p.contract && !p.loan && window === 'summer' && a <= e.loans.maxAge) {
    const club = getClub(s.world, p.clubId);
    const ovr = computeOvr(p.skills, p.role, ctx.config.ratings);
    const hasLoan = s.offers.some((o) => o.kind === 'loan');
    if (!hasLoan && ovr < club.rating - e.loans.gapBelowClub && rng.chance(e.loans.weeklyChance)) {
      const level = clubLevel(s, club.id);
      const options = s.world.clubs.filter((c) => {
        const fit = ovr - c.rating;
        const l = clubLevel(s, c.id);
        return (
          c.id !== club.id &&
          l >= level &&
          l <= level + 1 &&
          fit >= e.loans.minFit &&
          fit <= e.loans.maxFit
        );
      });
      if (options.length > 0) {
        const dest = rng.pick(options);
        add(buildOffer(s, dest, 'loan', p.contract.salaryWeekly, 1, rng, ids, ctx));
      }
    }
  }

  const sp = e.sponsors;
  const used = new Set([...p.sponsors, ...s.sponsorOffers].map((x) => x.sponsorId));
  const free = ctx.content.sponsors.filter((x) => !used.has(x.id));
  // I follower valgono soldi: sponsor più frequenti e meglio pagati.
  const fans = followersBonus(p.image.followers, ctx);
  const fv = ctx.config.media.followers.value;
  if (
    p.image.popularity >= sp.minPopularity &&
    p.sponsors.length + s.sponsorOffers.length < sp.max &&
    free.length > 0 &&
    rng.chance(Math.min(1, sp.weeklyChance * (1 + fans * fv.sponsorChanceShare)))
  ) {
    const sponsor = rng.pick(free);
    s = {
      ...s,
      sponsorOffers: [
        ...s.sponsorOffers,
        {
          id: ids.make('s'),
          sponsorId: sponsor.id,
          weeklyIncome: Math.round(
            (sp.baseWeekly + (p.image.popularity - sp.minPopularity) * sp.perPopularityPoint) *
              (1 + fans * fv.sponsorIncomeShare),
          ),
          untilSeason: state.season + rng.int(sp.seasons[0], sp.seasons[1]) - 1,
          expiresWeek: state.week + sp.lifetimeWeeks - 1,
        },
      ],
    };
  }

  return { ...s, marketWeek: state.week, rngState: rng.getState(), nextId: ids.next };
}

/** Offerte di contratto aperte, con il nome e il livello del club. */
export function getOffers(state: GameState): OfferView[] {
  return state.offers.map((o) => {
    const club = getClub(state.world, o.clubId);
    return {
      id: o.id,
      kind: o.kind,
      clubId: club.id,
      clubName: club.name,
      level: getGroup(state.world, club.groupId).league.level,
      salaryWeekly: o.salaryWeekly,
      seasons: o.seasons,
      signingBonus: o.signingBonus,
      expiresWeek: o.expiresWeek,
    };
  });
}

function findOffer(state: GameState, offerId: string): ContractOffer {
  const offer = state.offers.find((o) => o.id === offerId);
  if (!offer) throw new Error(`Unknown offer "${offerId}"`);
  return offer;
}

function assertActive(state: GameState) {
  if (state.retired) throw new Error('The career is over');
  if (state.currentMatch) throw new Error('A match is in progress');
}

/**
 * Chiede al club nuove condizioni. Se rientrano nel suo tetto le accetta (l'offerta resta da
 * firmare con `acceptOffer`); altrimenti rilancia a metà strada finché ha rilanci, poi si ritira.
 */
export function negotiateOffer(
  state: GameState,
  offerId: string,
  ask: { salaryWeekly: number; seasons: number },
  ctx: GameContext = defaultContext,
): { state: GameState; result: NegotiationResult; offer?: OfferView } {
  assertActive(state);
  const offer = findOffer(state, offerId);
  if (offer.kind === 'loan') throw new Error('Loans cannot be negotiated');
  const max = ctx.config.economy.negotiation.maxSeasons;
  if (!Number.isInteger(ask.seasons) || ask.seasons < 1 || ask.seasons > max) {
    throw new Error(`Seasons must be between 1 and ${max}`);
  }
  if (!(ask.salaryWeekly > 0)) throw new Error('Salary must be positive');

  let updated: ContractOffer | null;
  let result: NegotiationResult;
  if (ask.salaryWeekly <= offer.maxSalary) {
    updated = { ...offer, salaryWeekly: Math.round(ask.salaryWeekly), seasons: ask.seasons };
    result = 'accepted';
  } else if (offer.roundsLeft > 0) {
    const salaryWeekly = roundSalary(
      offer.salaryWeekly + (offer.maxSalary - offer.salaryWeekly) / 2,
      ctx,
    );
    updated = { ...offer, salaryWeekly, seasons: ask.seasons, roundsLeft: offer.roundsLeft - 1 };
    result = 'countered';
  } else {
    updated = null;
    result = 'withdrawn';
  }
  const offers = updated
    ? state.offers.map((o) => (o.id === offerId ? updated! : o))
    : state.offers.filter((o) => o.id !== offerId);
  const next = { ...state, offers };
  const view = updated ? getOffers(next).find((o) => o.id === offerId) : undefined;
  return { state: next, result, ...(view ? { offer: view } : {}) };
}

/** Rifiuta un'offerta. */
export function rejectOffer(state: GameState, offerId: string): GameState {
  findOffer(state, offerId);
  return { ...state, offers: state.offers.filter((o) => o.id !== offerId) };
}

/** Firma un'offerta: trasferimento, prestito o rinnovo. */
export function acceptOffer(
  state: GameState,
  offerId: string,
  ctx: GameContext = defaultContext,
): GameState {
  assertActive(state);
  const offer = findOffer(state, offerId);
  const club = getClub(state.world, offer.clubId);
  const level = clubLevel(state, club.id);
  const professional = ctx.config.world.levels.find((l) => l.level === level)!.professional;
  const p = state.player;
  const coachTrust = {
    ...p.relationships,
    [club.coachId]: p.relationships[club.coachId] ?? ctx.config.economy.initialCoachRelationship,
  };
  let player: Player;

  if (offer.kind === 'renewal') {
    if (!p.contract) throw new Error('No contract to renew');
    player = {
      ...p,
      contract: {
        ...p.contract,
        salaryWeekly: offer.salaryWeekly,
        untilSeason: p.contract.untilSeason + offer.seasons,
      },
      money: { ...p.money, salaryWeekly: offer.salaryWeekly },
    };
    return { ...state, player, offers: state.offers.filter((o) => o.id !== offerId) };
  }

  if (offer.kind === 'loan') {
    if (!p.clubId || !p.contract) throw new Error('Only a player under contract can go on loan');
    player = {
      ...p,
      clubId: club.id,
      loan: { parentClubId: p.contract.clubId, untilSeason: state.season },
      relationships: coachTrust,
    };
  } else {
    if (p.clubId && !getTransferWindow(state, ctx))
      throw new Error('The transfer window is closed');
    const { loan: _loan, ...rest } = p;
    player = {
      ...rest,
      clubId: club.id,
      contract: {
        clubId: club.id,
        salaryWeekly: offer.salaryWeekly,
        untilSeason: state.season + offer.seasons - 1,
        amateur: !professional,
      },
      money: {
        ...p.money,
        salaryWeekly: offer.salaryWeekly,
        cash: p.money.cash + offer.signingBonus,
      },
      relationships: coachTrust,
    };
  }
  // Nuovo club: benvenuto dei tifosi e conferenza stampa di presentazione.
  const calendar = moveScout(state.calendar, state.week, p.clubId, club.id);
  return welcomeToClub({ ...state, player, offers: [], calendar }, club.id, ctx);
}

export { retirePlayer };
