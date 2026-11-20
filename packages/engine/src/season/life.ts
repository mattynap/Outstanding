import type { GameContext } from '../context';
import { toward } from '../player/condition';
import { applyParty, type PartyReport } from '../private/private';
import type { Rng } from '../rng';
import type { GameState, LifeAction, Player } from '../types';
import { clamp } from '../util';

export type { LifeAction };

/** Tutte le azioni fuori dal campo, nell'ordine in cui le mostra l'interfaccia. */
export const LIFE_ACTIONS: readonly LifeAction[] = ['family', 'leisure', 'sponsor', 'party'];

/** Fattori attivi finché l'azione è nel piano; 1 = nessun effetto. */
export interface LifeModifiers {
  moraleLossFactor: number;
  moraleRecoveryFactor: number;
  affinityDriftFactor: number;
}

export function lifeModifiers(life: LifeAction | undefined, ctx: GameContext): LifeModifiers {
  const mods: LifeModifiers = {
    moraleLossFactor: 1,
    moraleRecoveryFactor: 1,
    affinityDriftFactor: 1,
  };
  const cfg = ctx.config.progression.life;
  if (life === 'family') {
    mods.moraleLossFactor = cfg.family.moraleLossFactor;
    mods.affinityDriftFactor = cfg.family.affinityDriftFactor;
  } else if (life === 'leisure') {
    mods.moraleRecoveryFactor = cfg.leisure.moraleRecoveryFactor;
  }
  return mods;
}

/** Ingaggio sponsor della settimana: lo stesso per la settimana vera e per l'anteprima. */
export function sponsorWeekIncome(player: Player, ctx: GameContext): number {
  return Math.round(
    player.sponsors.reduce((sum, d) => sum + d.weeklyIncome, 0) *
      ctx.config.progression.life.sponsor.sponsorWeeksPerWeek,
  );
}

/** Variazione di freschezza dell'azione (solo lo sponsor costa). */
export function lifeFreshness(life: LifeAction | undefined, ctx: GameContext): number {
  return life === 'sponsor' ? ctx.config.progression.life.sponsor.freshness : 0;
}

export interface LifeWeekResult {
  state: GameState;
  rng: Rng;
  freshnessDelta: number;
  party?: PartyReport;
  sponsorIncome?: number;
  /** Popolarità guadagnata dalla serata (già clampata). */
  popularity?: number;
}

/**
 * Effetti diretti dell'azione nella settimana. Famiglia e Svago agiscono solo come modificatori
 * (`lifeModifiers`) e qui non fanno nulla. La freschezza non si scrive: si restituisce il delta
 * per la chiusura di fine settimana. Il generatore è mutabile: lo si restituisce per comodità.
 */
export function applyLifeWeek(
  state: GameState,
  life: LifeAction | undefined,
  hasMatchThisWeek: boolean,
  rng: Rng,
  ctx: GameContext,
): LifeWeekResult {
  const cfg = ctx.config.progression.life;
  if (life === 'sponsor') {
    const income = sponsorWeekIncome(state.player, ctx);
    const player =
      income > 0
        ? {
            ...state.player,
            money: { ...state.player.money, cash: state.player.money.cash + income },
          }
        : state.player;
    return {
      state: player === state.player ? state : { ...state, player },
      rng,
      freshnessDelta: lifeFreshness(life, ctx),
      sponsorIncome: income,
    };
  }
  if (life === 'party') {
    const p = cfg.party;
    const out = applyParty(state, rng, ctx, {
      gossipChance: p.gossipChance,
      fineChance: p.fineChance,
      partnerAffinity: p.partnerAffinity,
      hasMatch: hasMatchThisWeek,
    });
    const player = out.state.player;
    return {
      state: {
        ...out.state,
        player: {
          ...player,
          image: {
            ...player.image,
            popularity: clamp(player.image.popularity + p.popularity, 0, 100),
          },
          persona: {
            ...player.persona,
            // La base resta ferma: la serata abbassa solo il valore corrente.
            discipline: clamp(player.persona.discipline + p.discipline, 0, 100),
          },
        },
      },
      rng,
      freshnessDelta: 0,
      party: out.report,
      popularity:
        clamp(player.image.popularity + p.popularity, 0, 100) - state.player.image.popularity,
    };
  }
  return { state, rng, freshnessDelta: 0 };
}

/** La disciplina torna verso la sua base. */
export function driftDiscipline(player: Player, ctx: GameContext): Player {
  const d = player.persona.discipline;
  const base = player.persona.disciplineBase;
  return {
    ...player,
    persona: {
      ...player.persona,
      discipline: clamp(toward(d, base, ctx.config.progression.discipline.driftPerWeek), 0, 100),
    },
  };
}
