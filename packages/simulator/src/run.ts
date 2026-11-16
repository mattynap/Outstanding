import {
  acceptOffer,
  acceptSponsor,
  advanceWeek,
  careerScore,
  careerTotals,
  defaultContext,
  drawWeekEvents,
  endSeason,
  getAgentCandidates,
  getOffers,
  hireAgent,
  isLegend,
  isSeasonOver,
  newCareer,
  planWeek,
  playerFixture,
  playMatch,
  resolveEvent,
  ROLES,
  Rng,
  simulateMatch,
  type CareerScore,
  type CareerTotals,
  type GameContext,
  type GameState,
  type NewCareerOptions,
  type Retirement,
  type Role,
} from '@outstanding/engine';
import { getStrategy, type StrategyId } from './strategies';

/**
 * Stima del tempo di gioco: secondi medi per ogni tipo di decisione presa davanti allo schermo.
 * Sono ipotesi del simulatore (non parametri del gioco): servono solo a confrontare con l'obiettivo
 * di 2–4 ore per una carriera completa.
 */
export const SECONDS_PER = {
  week: 4,
  event: 15,
  moment: 6,
  match: 10,
  simulatedMatch: 3,
  offer: 10,
} as const;

/** Limite di sicurezza: nessuna carriera dura più di così (il ritiro arriva al più tardi a 40 anni). */
const MAX_SEASONS = 40;

export interface Decisions {
  weeks: number;
  events: number;
  moments: number;
  /** Partite giocate di persona e partite simulate. */
  matches: number;
  simulatedMatches: number;
  offers: number;
}

export interface CareerResult {
  seed: number;
  strategy: StrategyId;
  role: Role;
  potential: number;
  retirement: Retirement;
  totals: CareerTotals;
  score: CareerScore;
  legend: boolean;
  /** Massimo OVR raggiunto a fine stagione. */
  peakOvr: number;
  /** Livello più alto (numero più basso) in cui ha giocato almeno una partita. */
  bestLevel: number | null;
  decisions: Decisions;
  /** Minuti di gioco stimati. */
  playMinutes: number;
}

/** Opzioni di creazione casuali ma riproducibili dal seme della carriera. */
export function randomCareerOptions(rng: Rng, ctx: GameContext): NewCareerOptions {
  const traits = ctx.content.traits.filter((t) => t.selectableAtCreation);
  const role = rng.pick(ROLES);
  const allowed = traits.filter((t) => !t.roles || t.roles.includes(role));
  const count = rng.int(0, Math.min(ctx.config.player.maxTraitsAtCreation, allowed.length));
  return {
    firstName: rng.pick(ctx.content.names.firstNames),
    lastName: rng.pick(ctx.content.names.lastNames),
    hometown: rng.pick(ctx.content.cities).name,
    role,
    traits: rng
      .shuffle(allowed)
      .slice(0, count)
      .map((t) => t.id),
  };
}

/** Firma sponsor e procuratore migliore disponibili: tutte le strategie lo fanno. */
function manageLife(state: GameState, ctx: GameContext): GameState {
  let s = state;
  for (const offer of s.sponsorOffers) {
    if (s.player.sponsors.length >= ctx.config.economy.sponsors.max) break;
    s = acceptSponsor(s, offer.id, ctx);
  }
  const best = getAgentCandidates(s, ctx)[0];
  const current = s.world.npcs.find((n) => n.id === s.player.agentId);
  if (best && (best.quality ?? 0) > (current?.quality ?? 0)) s = hireAgent(s, best.id, ctx);
  return s;
}

/** Gioca una carriera completa senza interfaccia, dalla creazione al ritiro. */
export function runCareer(
  seed: number,
  strategyId: StrategyId,
  ctx: GameContext = defaultContext,
): CareerResult {
  const strategy = getStrategy(strategyId);
  // Le scelte della strategia usano un generatore separato: lo stato del gioco resta deterministico.
  const rng = Rng.fromSeed(seed ^ 0x5bd1e995);
  let s = newCareer(randomCareerOptions(rng, ctx), seed, ctx);
  const d: Decisions = {
    weeks: 0,
    events: 0,
    moments: 0,
    matches: 0,
    simulatedMatches: 0,
    offers: 0,
  };
  const potential = s.player.potential;
  let peakOvr = 0;
  let seasons = 0;

  while (!s.retired) {
    if (isSeasonOver(s, ctx)) {
      if (++seasons > MAX_SEASONS) throw new Error(`Career ${seed} did not end`);
      s = endSeason(s, ctx).state;
      peakOvr = Math.max(peakOvr, s.player.history.at(-1)!.ovr);
      continue;
    }
    s = manageLife(s, ctx);
    const offers = getOffers(s);
    if (offers.length > 0) {
      const pick = strategy.pickOffer(s, offers, rng, ctx);
      if (pick) {
        try {
          s = acceptOffer(s, pick.id, ctx);
          d.offers++;
        } catch {
          // Offerta non firmabile adesso (es. finestra chiusa): si riprova la settimana dopo.
        }
      }
    }
    if (s.plannedWeek !== s.week) {
      s = planWeek(s, strategy.planWeek(s, rng, ctx), ctx).state;
      d.weeks++;
    }
    const drawn = drawWeekEvents(s, ctx);
    s = drawn.state;
    for (const e of drawn.events) {
      s = resolveEvent(s, e.eventId, strategy.chooseEvent(e.choices.length, rng), ctx).state;
      d.events++;
    }
    for (let f = playerFixture(s); f; f = playerFixture(s)) {
      if (!strategy.playsManually(s, f, rng)) {
        s = simulateMatch(s, ctx).state;
        d.simulatedMatches++;
        continue;
      }
      s = playMatch(
        s,
        (moment) => {
          d.moments++;
          return strategy.decideMoment(moment, rng);
        },
        ctx,
      ).state;
      d.matches++;
    }
    s = advanceWeek(s, ctx).state;
  }

  const history = s.player.history;
  const totals = careerTotals(history);
  const score = careerScore(history, s.player.role, ctx);
  const levels = history.filter((h) => h.stats.appearances > 0 && h.leagueLevel !== null);
  const seconds =
    d.weeks * SECONDS_PER.week +
    d.events * SECONDS_PER.event +
    d.moments * SECONDS_PER.moment +
    d.matches * SECONDS_PER.match +
    d.simulatedMatches * SECONDS_PER.simulatedMatch +
    d.offers * SECONDS_PER.offer;
  return {
    seed,
    strategy: strategyId,
    role: s.player.role,
    potential,
    retirement: s.retired!,
    totals,
    score,
    legend: isLegend(score, ctx),
    peakOvr,
    bestLevel: levels.length ? Math.min(...levels.map((h) => h.leagueLevel!)) : null,
    decisions: d,
    playMinutes: Math.round(seconds / 60),
  };
}
