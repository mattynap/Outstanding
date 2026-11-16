import { defaultContext, type GameContext } from '../context';
import type { GameState, Npc, Player } from '../types';
import { ageAt } from '../time';
import { clamp } from '../util';
import { getClub, getGroup } from '../world/queries';
import { refreshMarket, retirePlayer } from './offers';

/** Movimenti di denaro di una settimana. */
export interface WeekFinance {
  salary: number;
  sponsors: number;
  commission: number;
  expenses: number;
}

/**
 * Entrate e uscite della settimana: stipendio e sponsor, meno commissione del procuratore e costo
 * del tenore di vita. Con la cassa in rosso calano felicità e morale.
 */
export function applyWeeklyFinances(
  player: Player,
  npcs: readonly Npc[],
  ctx: GameContext,
): { player: Player; finance: WeekFinance } {
  const e = ctx.config.economy;
  const salary = player.contract ? player.contract.salaryWeekly : 0;
  const sponsors = player.sponsors.reduce((sum, d) => sum + d.weeklyIncome, 0);
  const agent = player.agentId ? npcs.find((n) => n.id === player.agentId) : undefined;
  const commission = Math.round((salary + sponsors) * (agent?.commission ?? 0));
  const style = e.lifestyles.find((l) => l.id === player.lifestyle) ?? e.lifestyles[0]!;
  const cash = player.money.cash + salary + sponsors - commission - style.weeklyCost;
  const debt = cash < 0;
  return {
    player: {
      ...player,
      money: { ...player.money, cash },
      persona: {
        ...player.persona,
        happiness: clamp(
          player.persona.happiness + style.happinessPerWeek + (debt ? e.debt.happinessPerWeek : 0),
          0,
          100,
        ),
      },
      condition: {
        ...player.condition,
        morale: clamp(player.condition.morale + (debt ? e.debt.moralePerWeek : 0), 0, 100),
      },
    },
    finance: { salary, sponsors, commission, expenses: style.weeklyCost },
  };
}

/** Sceglie il tenore di vita (ha effetto dalla settimana successiva). */
export function setLifestyle(
  state: GameState,
  lifestyleId: string,
  ctx: GameContext = defaultContext,
): GameState {
  if (!ctx.config.economy.lifestyles.some((l) => l.id === lifestyleId)) {
    throw new Error(`Unknown lifestyle "${lifestyleId}"`);
  }
  return { ...state, player: { ...state.player, lifestyle: lifestyleId } };
}

/**
 * Procuratori disposti a seguire il giocatore: quelli bravi vogliono clienti con reputazione.
 * Ordinati dal migliore, al massimo `agents.candidates`.
 */
export function getAgentCandidates(state: GameState, ctx: GameContext = defaultContext): Npc[] {
  const a = ctx.config.economy.agents;
  const maxQuality = 1 + Math.floor(state.player.image.reputation / a.reputationPerQuality);
  return state.world.npcs
    .filter((n) => n.role === 'agent' && n.id !== state.player.agentId)
    .filter((n) => (n.quality ?? 0) <= maxQuality)
    .sort((x, y) => (y.quality ?? 0) - (x.quality ?? 0) || x.id.localeCompare(y.id))
    .slice(0, a.candidates);
}

export function hireAgent(
  state: GameState,
  agentId: string,
  ctx: GameContext = defaultContext,
): GameState {
  if (!getAgentCandidates(state, ctx).some((n) => n.id === agentId)) {
    throw new Error(`Agent "${agentId}" is not available`);
  }
  const p = state.player;
  return {
    ...state,
    player: {
      ...p,
      agentId,
      relationships: {
        ...p.relationships,
        [agentId]: p.relationships[agentId] ?? ctx.config.economy.agents.initialRelationship,
      },
    },
  };
}

export function fireAgent(state: GameState): GameState {
  const { agentId: _gone, ...player } = state.player;
  return { ...state, player };
}

/** Sponsor proposti, con nome e categoria del marchio. */
export function getSponsorOffers(state: GameState, ctx: GameContext = defaultContext) {
  return state.sponsorOffers.map((o) => {
    const sponsor = ctx.content.sponsors.find((s) => s.id === o.sponsorId)!;
    return { ...o, name: sponsor.name, category: sponsor.category };
  });
}

export function acceptSponsor(
  state: GameState,
  offerId: string,
  ctx: GameContext = defaultContext,
): GameState {
  const offer = state.sponsorOffers.find((o) => o.id === offerId);
  if (!offer) throw new Error(`Unknown sponsor offer "${offerId}"`);
  if (state.player.sponsors.length >= ctx.config.economy.sponsors.max) {
    throw new Error('Too many sponsors');
  }
  const { id: _id, expiresWeek: _exp, ...deal } = offer;
  return {
    ...state,
    player: { ...state.player, sponsors: [...state.player.sponsors, deal] },
    sponsorOffers: state.sponsorOffers.filter((o) => o.id !== offerId),
  };
}

export function rejectSponsor(state: GameState, offerId: string): GameState {
  if (!state.sponsorOffers.some((o) => o.id === offerId)) {
    throw new Error(`Unknown sponsor offer "${offerId}"`);
  }
  return { ...state, sponsorOffers: state.sponsorOffers.filter((o) => o.id !== offerId) };
}

/** Ritiro per scelta del giocatore, possibile dall'età minima di ritiro. */
export function retire(state: GameState, ctx: GameContext = defaultContext): GameState {
  if (state.retired) throw new Error('The career is already over');
  if (state.currentMatch) throw new Error('A match is in progress');
  const age = ageAt(state.player.birthWeek, state.week, ctx.config.calendar);
  if (age < ctx.config.economy.retirement.minAge) {
    throw new Error(`Retirement is possible from age ${ctx.config.economy.retirement.minAge}`);
  }
  return retirePlayer(state, 'choice', ctx);
}

/**
 * Passaggio di stagione per contratti e vita privata: fine dei prestiti, contratti scaduti
 * (svincolo), sponsor scaduti, ritiro per età; poi il mercato della nuova stagione.
 * `state.season` è già la stagione nuova.
 */
export function seasonMarketTransition(
  state: GameState,
  ctx: GameContext = defaultContext,
): GameState {
  const ended = state.season - 1;
  let p = state.player;

  if (p.loan && p.loan.untilSeason <= ended) {
    const { loan, ...rest } = p;
    p = { ...rest, clubId: loan.parentClubId };
  }
  if (p.contract && p.contract.untilSeason <= ended) {
    const { contract: _c, clubId: _club, loan: _loan, ...rest } = p;
    p = { ...rest, money: { ...rest.money, salaryWeekly: 0 } };
  } else if (p.contract) {
    // Il club può aver cambiato categoria: aggiorna il tipo di contratto.
    const level = getGroup(state.world, getClub(state.world, p.contract.clubId).groupId).league;
    p = { ...p, contract: { ...p.contract, amateur: !level.professional } };
  }
  p = { ...p, sponsors: p.sponsors.filter((d) => d.untilSeason > ended) };

  let s: GameState = { ...state, player: p, offers: [], marketWeek: -1 };
  const age = ageAt(p.birthWeek, state.week, ctx.config.calendar);
  if (age >= ctx.config.economy.retirement.maxAge) return retirePlayer(s, 'age', ctx);
  s = refreshMarket(s, ctx);
  return s;
}
