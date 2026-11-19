import {
  prudentMomentChoice,
  computeOvr,
  getOffers,
  getWeekOptions,
  SKILLS,
  type GameContext,
  type GameState,
  type KeyMoment,
  type MatchDecision,
  type OfferView,
  type Fixture,
  type Rng,
  type Skill,
  type WeekChoice,
} from '@outstanding/engine';

export type StrategyId = 'cautious' | 'aggressive' | 'random' | 'contextual';
export const STRATEGIES: readonly StrategyId[] = ['cautious', 'aggressive', 'random', 'contextual'];

/** Le decisioni che in partita prende il giocatore; il simulatore le affida a una strategia. */
export interface Strategy {
  id: StrategyId;
  planWeek(state: GameState, rng: Rng, ctx: GameContext): WeekChoice[];
  decideMoment(moment: KeyMoment, rng: Rng): number | MatchDecision;
  /**
   * Vero se la partita si gioca di persona (momenti chiave decisi dalla strategia), falso se si
   * simula (momenti con la scelta automatica prudente del motore).
   */
  playsManually(state: GameState, fixture: Fixture, rng: Rng): boolean;
  /** Scelta di un evento: nessuna strategia "sa" quale sia la migliore, quindi è casuale. */
  chooseEvent(choices: number, rng: Rng): number;
  /** Offerta da firmare tra quelle aperte (undefined = nessuna per ora). */
  pickOffer(
    state: GameState,
    offers: OfferView[],
    rng: Rng,
    ctx: GameContext,
  ): OfferView | undefined;
}

/** Soglia di energia sotto la quale anche la strategia aggressiva si riposa. */
const LOW_ENERGY = 35;
/** Probabilità che la strategia casuale giochi di persona una partita. */
const RANDOM_MANUAL_CHANCE = 0.5;
/** Probabilità settimanale con cui la strategia casuale firma un'offerta aperta. */
const RANDOM_SIGN_CHANCE = 0.3;

/** L'abilità con il peso maggiore per il ruolo: quella su cui concentrare l'allenamento. */
function keySkill(state: GameState, ctx: GameContext): Skill {
  const weights = ctx.config.ratings.roleWeights[state.player.role];
  return [...SKILLS].sort((a, b) => weights[b] - weights[a])[0]!;
}

function available(state: GameState, ctx: GameContext): Set<string> {
  return new Set(
    getWeekOptions(state, ctx)
      .filter((o) => o.available)
      .map((o) => o.id),
  );
}

/** Tiene solo le azioni disponibili, senza ripetizioni e nel limite settimanale. */
function feasible(state: GameState, wanted: WeekChoice[], ctx: GameContext): WeekChoice[] {
  const ok = available(state, ctx);
  const seen = new Set<string>();
  return wanted
    .filter((c) => ok.has(c.actionId) && !seen.has(c.actionId) && seen.add(c.actionId))
    .slice(0, ctx.config.progression.actionsPerWeek);
}

/**
 * Un giocatore attento gioca di persona le partite che contano: le coppe e quelle contro avversari
 * forti almeno quanto la propria squadra. Le altre le simula.
 */
function bigMatch(state: GameState, fixture: Fixture): boolean {
  if (fixture.cup) return true;
  const ratings = new Map(
    [...state.world.clubs, ...state.world.foreignClubs].map((c) => [c.id, c.rating]),
  );
  const own = state.player.clubId!;
  const opponent = fixture.homeId === own ? fixture.awayId : fixture.homeId;
  return (ratings.get(opponent) ?? 0) >= (ratings.get(own) ?? 0);
}

const injured = (s: GameState) => Boolean(s.player.injury && s.player.injury.weeksLeft > 0);
const level = (state: GameState, ctx: GameContext) => {
  const clubId = state.player.clubId;
  if (!clubId) return ctx.config.world.levels.length + 1;
  const club = state.world.clubs.find((c) => c.id === clubId)!;
  return state.world.leagues.find((l) => l.groups.some((g) => g.id === club.groupId))!.level;
};

/** Offerte di trasferimento, dal livello più alto (numero più basso) e poi dallo stipendio. */
const bestFirst = (offers: OfferView[]) =>
  [...offers].sort((a, b) => a.level - b.level || b.salaryWeekly - a.salaryWeekly);

/**
 * Prudente: allenamento normale e riposo, sceglie l'opzione più sicura nei momenti chiave, sale di
 * un livello alla volta e accetta i prestiti da giovane per giocare.
 */
const cautious: Strategy = {
  id: 'cautious',
  playsManually: (state, fixture) => bigMatch(state, fixture),
  planWeek(state, _rng, ctx) {
    if (injured(state)) return feasible(state, [{ actionId: 'physio' }, { actionId: 'rest' }], ctx);
    return feasible(state, [{ actionId: 'train_normal' }, { actionId: 'rest' }], ctx);
  },
  // Come le partite simulate: la più probabile, e "chiudi" solo se le altre sono in fascia bassa.
  decideMoment: (moment) => prudentMomentChoice(moment),
  chooseEvent: (n, rng) => rng.int(0, n - 1),
  pickOffer(state, offers, _rng, ctx) {
    const current = level(state, ctx);
    if (!state.player.clubId) return bestFirst(offers)[0];
    // Prima un passo in su (un solo livello), poi il rinnovo, poi il prestito per giocare.
    const stepUp = bestFirst(
      offers.filter((o) => o.kind === 'transfer' && o.level === current - 1),
    )[0];
    return (
      stepUp ?? offers.find((o) => o.kind === 'renewal') ?? offers.find((o) => o.kind === 'loan')
    );
  },
};

/**
 * Aggressiva: allenamento intenso e mirato, opzione più rischiosa nei momenti
 * chiave, firma sempre l'offerta del livello più alto e rifiuta i prestiti.
 */
const aggressive: Strategy = {
  id: 'aggressive',
  playsManually: (state, fixture) => bigMatch(state, fixture),
  planWeek(state, _rng, ctx) {
    if (injured(state)) return feasible(state, [{ actionId: 'physio' }, { actionId: 'rest' }], ctx);
    const focus: WeekChoice = { actionId: 'train_focus', focus: keySkill(state, ctx) };
    if (state.player.condition.energy < LOW_ENERGY) {
      return feasible(state, [{ actionId: 'train_intense' }, { actionId: 'rest' }], ctx);
    }
    return feasible(state, [{ actionId: 'train_intense' }, focus], ctx);
  },
  decideMoment(moment) {
    let pick = 0;
    moment.options.forEach((o, i) => {
      const best = moment.options[pick]!;
      const risks: KeyMoment['options'][number]['risk'][] = ['safe', 'balanced', 'risky'];
      if (
        risks.indexOf(o.risk) > risks.indexOf(best.risk) ||
        (o.risk === best.risk && o.chance > best.chance)
      )
        pick = i;
    });
    return pick;
  },
  chooseEvent: (n, rng) => rng.int(0, n - 1),
  pickOffer(state, offers, _rng, ctx) {
    const current = level(state, ctx);
    const transfers = bestFirst(offers.filter((o) => o.kind === 'transfer'));
    const best = transfers[0];
    if (best && (best.level < current || !state.player.clubId)) return best;
    return offers.find((o) => o.kind === 'renewal') ?? (state.player.clubId ? undefined : best);
  },
};

/** Casuale: azioni, opzioni e offerte scelte a caso (ma sempre legali). */
const random: Strategy = {
  id: 'random',
  playsManually: (_state, _fixture, rng) => rng.chance(RANDOM_MANUAL_CHANCE),
  planWeek(state, rng, ctx) {
    const ids = rng.shuffle([...available(state, ctx)]);
    const actions = ctx.config.progression.actions;
    return ids.slice(0, ctx.config.progression.actionsPerWeek).map((actionId) => {
      const needsFocus = Boolean(actions.find((a) => a.id === actionId)?.focus);
      return needsFocus ? { actionId, focus: rng.pick(SKILLS) } : { actionId };
    });
  },
  decideMoment: (moment, rng) => rng.int(0, moment.options.length - 1),
  chooseEvent: (n, rng) => rng.int(0, n - 1),
  pickOffer(state, offers, rng) {
    if (offers.length === 0) return undefined;
    if (!state.player.clubId || rng.chance(RANDOM_SIGN_CHANCE)) return rng.pick(offers);
    return undefined;
  },
};

const contextual: Strategy = {
  ...cautious,
  id: 'contextual',
  decideMoment(moment) {
    let pick = 0;
    moment.options.forEach((option, index) => {
      const best = moment.options[pick]!;
      if (option.value > best.value || (option.value === best.value && option.chance > best.chance))
        pick = index;
    });
    return pick;
  },
};

const GESTURE_QUALITY = { cautious: 0.5, aggressive: 0.5, contextual: 0.5 } as const;

export interface StrategyOptions {
  isolate?: boolean;
  quality?: number;
  /** Modalità delle partite giocate di persona (default completa). */
  mode?: 'full' | 'quick';
  /** Ciclo di carriera: a capitoli (default) o a settimane (quello della Parte A, per i confronti). */
  loop?: 'chapters' | 'weeks';
}

export function getStrategy(id: StrategyId, options: StrategyOptions = {}): Strategy {
  const selected = { cautious, aggressive, random, contextual }[id];
  const quality = options.quality ?? (id === 'random' ? undefined : GESTURE_QUALITY[id]);
  if (quality !== undefined && (!Number.isFinite(quality) || quality < 0 || quality > 1)) {
    throw new Error('--quality deve essere un numero tra 0 e 1');
  }
  return {
    ...(options.isolate ? cautious : selected),
    id,
    decideMoment(moment, rng) {
      const decision = selected.decideMoment(moment, rng);
      if (quality === undefined) return decision;
      return {
        optionIndex: typeof decision === 'number' ? decision : decision.optionIndex,
        quality,
      };
    },
  };
}

/** OVR attuale del giocatore (comodo per i report). */
export function playerOvr(state: GameState, ctx: GameContext): number {
  return computeOvr(state.player.skills, state.player.role, ctx.config.ratings);
}

export { getOffers };
