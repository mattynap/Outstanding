import type { GameContext } from '../context';
import type { Rng } from '../rng';
import type { Player, Role, SeasonStats, Skills } from '../types';
import { clamp } from '../util';
import { SKILLS } from './ratings';

export interface NewPlayerOptions {
  firstName: string;
  lastName: string;
  /** Città italiana reale. */
  hometown: string;
  role: Role;
  /** Id dei tratti scelti alla creazione (al massimo `config.player.maxTraitsAtCreation`). */
  traits?: string[];
}

export const emptySeasonStats = (): SeasonStats => ({
  appearances: 0,
  starts: 0,
  minutes: 0,
  goals: 0,
  assists: 0,
  cleanSheets: 0,
  ratingSum: 0,
  ratingCount: 0,
});

/** Lancia un errore se le opzioni di creazione non sono valide per i contenuti/configurazione dati. */
export function validateNewPlayerOptions(opts: NewPlayerOptions, ctx: GameContext): void {
  if (!opts.firstName.trim() || !opts.lastName.trim()) {
    throw new Error('Player first and last name are required');
  }
  if (!opts.hometown.trim()) throw new Error('Player hometown is required');
  const traits = opts.traits ?? [];
  if (traits.length > ctx.config.player.maxTraitsAtCreation) {
    throw new Error(`At most ${ctx.config.player.maxTraitsAtCreation} traits at creation`);
  }
  if (new Set(traits).size !== traits.length) throw new Error('Duplicate traits');
  for (const id of traits) {
    const trait = ctx.content.traits.find((t) => t.id === id);
    if (!trait) throw new Error(`Unknown trait "${id}"`);
    if (!trait.selectableAtCreation) throw new Error(`Trait "${id}" is not selectable`);
    if (trait.roles && !trait.roles.includes(opts.role)) {
      throw new Error(`Trait "${id}" is not available for role ${opts.role}`);
    }
  }
}

/** Crea il giocatore umano all'inizio della carriera (settimana 0). */
export function createPlayer(
  opts: NewPlayerOptions,
  id: string,
  rng: Rng,
  ctx: GameContext,
): Player {
  validateNewPlayerOptions(opts, ctx);
  const cfg = ctx.config.player;
  const weeksPerYear = ctx.config.calendar.weeksPerSeason;

  const ranges = cfg.skillRanges[opts.role];
  const skills = {} as Skills;
  for (const s of SKILLS) {
    const [min, max] = ranges[s];
    skills[s] = rng.int(min, max);
  }

  const p = cfg.potential;
  const potential = Math.round(clamp(rng.normal(p.mean, p.sd), p.min, p.max));

  const init = cfg.initial;
  return {
    id,
    firstName: opts.firstName.trim(),
    lastName: opts.lastName.trim(),
    birthWeek: -(cfg.startAge * weeksPerYear) - rng.int(0, weeksPerYear - 1),
    hometown: opts.hometown.trim(),
    role: opts.role,
    skills,
    potential,
    condition: { ...init.condition },
    persona: {
      discipline: rng.int(...init.persona.discipline),
      temperament: rng.int(...init.persona.temperament),
      happiness: init.persona.happiness,
    },
    image: {
      popularity: init.image.popularity,
      reputation: init.image.reputation,
      followers: rng.int(...init.image.followers),
    },
    money: { ...init.money },
    traits: [...(opts.traits ?? [])],
    relationships: {},
    flags: {},
    seasonStats: emptySeasonStats(),
    history: [],
  };
}
