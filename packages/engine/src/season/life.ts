import type { GameContext } from '../context';
import { toward } from '../player/condition';
import { applyParty, type PartyReport } from '../private/private';
import type { Rng } from '../rng';
import type { GameState, Player } from '../types';
import { clamp } from '../util';

/** Azione facoltativa fuori dal campo del piano settimanale. */
export type LifeAction = 'family' | 'leisure' | 'sponsor' | 'party';

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

export interface LifeWeekResult {
  state: GameState;
  rng: Rng;
  freshnessDelta: number;
  party?: PartyReport;
  sponsorIncome?: number;
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
    const income = Math.round(
      state.player.sponsors.reduce((sum, d) => sum + d.weeklyIncome, 0) *
        cfg.sponsor.sponsorWeeksPerWeek,
    );
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
      freshnessDelta: cfg.sponsor.freshness,
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
            disciplineBase: player.persona.disciplineBase ?? player.persona.discipline,
            discipline: clamp(player.persona.discipline + p.discipline, 0, 100),
          },
        },
      },
      rng,
      freshnessDelta: 0,
      party: out.report,
    };
  }
  return { state, rng, freshnessDelta: 0 };
}

/** La disciplina torna verso la sua base; senza base esplicita resta dov'è. */
export function driftDiscipline(player: Player, ctx: GameContext): Player {
  const d = player.persona.discipline;
  const base = player.persona.disciplineBase ?? d;
  return {
    ...player,
    persona: {
      ...player.persona,
      discipline: clamp(toward(d, base, ctx.config.progression.discipline.driftPerWeek), 0, 100),
    },
  };
}
