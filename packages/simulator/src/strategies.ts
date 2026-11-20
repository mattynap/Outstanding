import {
  chapterOf,
  prudentMomentChoice,
  computeOvr,
  getOffers,
  getPlanOptions,
  LIFE_ACTIONS,
  LOADS,
  SKILLS,
  weekOfSeason,
  type GameContext,
  type GameState,
  type KeyMoment,
  type LifeAction,
  type MatchDecision,
  type OfferView,
  type Fixture,
  type Rng,
  type Skill,
  type WeekPlan,
} from '@outstanding/engine';

export type StrategyId = 'cautious' | 'aggressive' | 'random' | 'contextual';
export const STRATEGIES: readonly StrategyId[] = ['cautious', 'aggressive', 'random', 'contextual'];

/** Le decisioni che in partita prende il giocatore; il simulatore le affida a una strategia. */
export interface Strategy {
  id: StrategyId;
  planWeek(state: GameState, rng: Rng, ctx: GameContext): WeekPlan;
  /** Solo i piani fissi: capitoli pianificati e capitoli in cui la vita non era disponibile. */
  planStats?: { chapters: number; lifeFallbacks: number };
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

/** Probabilità che la strategia casuale giochi di persona una partita. */
const RANDOM_MANUAL_CHANCE = 0.5;
/** Probabilità settimanale con cui la strategia casuale firma un'offerta aperta. */
const RANDOM_SIGN_CHANCE = 0.3;
/** Probabilità che la strategia casuale aggiunga un focus al carico. */
const RANDOM_FOCUS_CHANCE = 0.5;

/** L'abilità con il peso maggiore per il ruolo: quella su cui concentrare l'allenamento. */
function keySkill(state: GameState, ctx: GameContext): Skill {
  const weights = ctx.config.ratings.roleWeights[state.player.role];
  return [...SKILLS].sort((a, b) => weights[b] - weights[a])[0]!;
}

/** Le azioni fuori dal campo disponibili adesso: `setChapterPlan` rifiuta le altre. */
function availableLife(state: GameState, ctx: GameContext): LifeAction[] {
  return getPlanOptions(state, ctx)
    .life.filter((l) => l.available)
    .map((l) => l.id);
}

/** Il piano con la vita solo se disponibile adesso. */
function withLife(state: GameState, plan: WeekPlan, life: LifeAction, ctx: GameContext): WeekPlan {
  return availableLife(state, ctx).includes(life) ? { ...plan, life } : plan;
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

/** Quota di partite di peso fra quelle ancora da giocare nel capitolo in corso. */
function bigMatchShare(state: GameState, ctx: GameContext): number {
  const cal = ctx.config.calendar;
  const own = state.player.clubId;
  if (!own) return 0;
  const seasonEnd = state.week - weekOfSeason(state.week, cal) + cal.weeksPerSeason;
  const left = state.calendar.filter(
    (f) =>
      !f.result &&
      f.week >= state.week &&
      f.week < seasonEnd &&
      (f.homeId === own || f.awayId === own) &&
      chapterOf(weekOfSeason(f.week, cal), cal) === state.chapter.id,
  );
  if (left.length === 0) return 0;
  return left.filter((f) => bigMatch(state, f)).length / left.length;
}

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
 * Prudente: Equilibrio e Famiglia, sceglie l'opzione più sicura nei momenti chiave, sale di un
 * livello alla volta e accetta i prestiti da giovane per giocare.
 */
const cautious: Strategy = {
  id: 'cautious',
  playsManually: (state, fixture) => bigMatch(state, fixture),
  // Da infortunato il carico non conta (recupero forzato): il piano resta lo stesso.
  planWeek: () => ({ load: 'balanced', life: 'family' }),
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
 * Aggressiva: Spinta con focus e Serata (Scarico se la freschezza è bassa), opzione più rischiosa
 * nei momenti chiave, firma sempre l'offerta del livello più alto e rifiuta i prestiti.
 */
const aggressive: Strategy = {
  id: 'aggressive',
  playsManually: (state, fixture) => bigMatch(state, fixture),
  planWeek(state, _rng, ctx) {
    const focus = keySkill(state, ctx);
    if (state.player.condition.energy < ctx.config.simulator.plan.aggressiveLowFreshness)
      return { load: 'rest', focus, life: 'party' };
    return { load: 'push', focus, life: 'party' };
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

/** Casuale: carico, vita, opzioni e offerte scelte a caso (ma sempre legali). */
const random: Strategy = {
  id: 'random',
  playsManually: (_state, _fixture, rng) => rng.chance(RANDOM_MANUAL_CHANCE),
  planWeek(state, rng, ctx) {
    const plan: WeekPlan = { load: rng.pick(LOADS) };
    if (rng.chance(RANDOM_FOCUS_CHANCE)) plan.focus = rng.pick(SKILLS);
    const life = availableLife(state, ctx);
    // Anche "nessuna azione" è una scelta possibile.
    const pick = rng.int(0, life.length);
    if (pick < life.length) plan.life = life[pick]!;
    return plan;
  },
  decideMoment: (moment, rng) => rng.int(0, moment.options.length - 1),
  chooseEvent: (n, rng) => rng.int(0, n - 1),
  pickOffer(state, offers, rng) {
    if (offers.length === 0) return undefined;
    if (!state.player.clubId || rng.chance(RANDOM_SIGN_CHANCE)) return rng.pick(offers);
    return undefined;
  },
};

/**
 * Adattiva (spec §5.10). Regole del piano congelate prima della taratura (Task 12): non si
 * ritoccano per farla vincere; le soglie stanno in `config/data/simulator.json > plan`.
 *  - Carico: Scarico se il capitolo ha partite di peso (quota >= heavyChapterShare) o la freschezza
 *    è sotto contextualLowFreshness; Spinta se la freschezza è >= contextualHighFreshness e il
 *    capitolo è leggero (quota <= lightChapterShare); altrimenti Equilibrio.
 *  - Vita, in quest'ordine: Sponsor con cassa sotto lowCash (se ha ingaggi), Svago con morale sotto
 *    lowMorale, Famiglia altrimenti. Nessun focus.
 */
export const contextualStrategy: Strategy = {
  ...cautious,
  id: 'contextual',
  planWeek(state, _rng, ctx) {
    const t = ctx.config.simulator.plan;
    const share = bigMatchShare(state, ctx);
    const freshness = state.player.condition.energy;
    const load =
      share >= t.heavyChapterShare || freshness < t.contextualLowFreshness
        ? 'rest'
        : freshness >= t.contextualHighFreshness && share <= t.lightChapterShare
          ? 'push'
          : 'balanced';
    const plan: WeekPlan = { load };
    if (state.player.money.cash < t.lowCash && availableLife(state, ctx).includes('sponsor')) {
      return { ...plan, life: 'sponsor' };
    }
    return withLife(
      state,
      plan,
      state.player.condition.morale < t.lowMorale ? 'leisure' : 'family',
      ctx,
    );
  },
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
const contextual = contextualStrategy;

/**
 * Piano fisso: ripete lo stesso piano a ogni capitolo; momenti, partite scelte, offerte ed eventi
 * sono quelli di `contextual` (le stesse funzioni), così nei confronti vince o perde solo il piano.
 * Se l'azione della vita non è disponibile quando il piano va impostato (Sponsor senza ingaggi),
 * si gioca lo stesso piano senza vita e il capitolo si conta in `planStats.lifeFallbacks`.
 */
export function fixedPlanStrategy(plan: WeekPlan): Strategy {
  const stats = { chapters: 0, lifeFallbacks: 0 };
  return {
    ...contextualStrategy,
    planStats: stats,
    planWeek(state, _rng, ctx) {
      stats.chapters++;
      if (plan.life === undefined || availableLife(state, ctx).includes(plan.life))
        return { ...plan };
      stats.lifeFallbacks++;
      const { life: _life, ...withoutLife } = plan;
      return withoutLife;
    },
  };
}

/** `push+none`, `balanced+family`, `rest+party+vision`: carico, vita (o none) e focus facoltativo. */
export function parsePlan(spec: string): WeekPlan {
  const [load, life, focus, ...extra] = spec.split('+');
  if (!LOADS.includes(load as never) || life === undefined || extra.length > 0) {
    throw new Error(`--plan deve essere <carico>+<vita|none>[+<abilità>] (ricevuto "${spec}")`);
  }
  if (life !== 'none' && !LIFE_ACTIONS.includes(life as LifeAction)) {
    throw new Error(`--plan: vita "${life}" sconosciuta (${LIFE_ACTIONS.join(', ')}, none)`);
  }
  if (focus !== undefined && !SKILLS.includes(focus as Skill)) {
    throw new Error(`--plan: abilità "${focus}" sconosciuta`);
  }
  return {
    load: load as WeekPlan['load'],
    ...(focus ? { focus: focus as Skill } : {}),
    ...(life !== 'none' ? { life: life as LifeAction } : {}),
  };
}

export function formatPlan(plan: WeekPlan): string {
  return [plan.load, plan.life ?? 'none', ...(plan.focus ? [plan.focus] : [])].join('+');
}

const GESTURE_QUALITY = { cautious: 0.5, aggressive: 0.5, contextual: 0.5 } as const;

export interface StrategyOptions {
  isolate?: boolean;
  quality?: number;
  /** Modalità delle partite giocate di persona (default completa). */
  mode?: 'full' | 'quick';
  /** Ciclo di carriera: a capitoli (default) o a settimane (quello della Parte A, per i confronti). */
  loop?: 'chapters' | 'weeks';
  /** Piano fisso al posto del piano della strategia (resto come `contextual`). */
  plan?: WeekPlan;
}

export function getStrategy(id: StrategyId, options: StrategyOptions = {}): Strategy {
  if (options.plan && options.isolate) throw new Error('--plan e --isolate non si combinano');
  const selected = options.plan
    ? fixedPlanStrategy(options.plan)
    : { cautious, aggressive, random, contextual }[id];
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
