import type { Interest, PrivateActionConfig, PrivateConfig } from '@outstanding/config';
import type { EventTrigger } from '@outstanding/content';
import { defaultContext, type GameContext } from '../context';
import { Rng } from '../rng';
import { playerFixtures, playerFixture } from '../season/week';
import { ageAt } from '../time';
import type {
  Child,
  Gender,
  GameState,
  Partner,
  PartnerStage,
  Player,
  PrivateLife,
  PrivatePerson,
} from '../types';
import { clamp } from '../util';

/** Situazione sentimentale del giocatore. */
export type RelationshipState = 'single' | PartnerStage;

type ScaledCost = PrivateConfig['children']['cost'];

/** Vita privata iniziale: single, nessun figlio. */
export function createPrivateLife(
  interest?: Interest,
  ctx: GameContext = defaultContext,
): PrivateLife {
  return {
    interest: interest ?? ctx.config.private.defaultInterest,
    children: [],
    exes: [],
    actionWeek: -1,
  };
}

/** Vita privata della carriera (i salvataggi senza vita privata partono da single). */
export function privateOf(state: GameState, ctx: GameContext = defaultContext): PrivateLife {
  return state.privateLife ?? createPrivateLife(undefined, ctx);
}

export function relationshipState(state: GameState): RelationshipState {
  return state.privateLife?.partner?.stage ?? 'single';
}

const withLife = (state: GameState, privateLife: PrivateLife, player: Player = state.player) => ({
  ...state,
  player,
  privateLife,
});

/** Costo in euro scalato sullo stipendio attuale (mai sotto il minimo). */
export function scaledCost(cost: ScaledCost, player: Player): number {
  const salary = player.contract?.salaryWeekly ?? 0;
  return Math.max(cost.min, Math.round(cost.salaryWeeks * salary));
}

/** Somma variazioni a felicità, morale, energia, popolarità e reputazione (limitate 0–100). */
function adjust(
  p: Player,
  d: {
    happiness?: number;
    morale?: number;
    energy?: number;
    popularity?: number;
    reputation?: number;
    discipline?: number;
    cash?: number;
  },
): Player {
  return {
    ...p,
    money: { ...p.money, cash: Math.round(p.money.cash + (d.cash ?? 0)) },
    persona: {
      ...p.persona,
      happiness: clamp(p.persona.happiness + (d.happiness ?? 0), 0, 100),
      discipline: clamp(p.persona.discipline + (d.discipline ?? 0), 0, 100),
    },
    condition: {
      ...p.condition,
      morale: clamp(p.condition.morale + (d.morale ?? 0), 0, 100),
      energy: clamp(p.condition.energy + (d.energy ?? 0), 0, 100),
    },
    image: {
      ...p.image,
      popularity: clamp(p.image.popularity + (d.popularity ?? 0), 0, 100),
      reputation: clamp(p.image.reputation + (d.reputation ?? 0), 0, 100),
    },
  };
}

function shiftAffinity(life: PrivateLife, delta: number): PrivateLife {
  if (!life.partner) return life;
  return {
    ...life,
    partner: { ...life.partner, affinity: clamp(life.partner.affinity + delta, 0, 100) },
  };
}

// --- Persone ----------------------------------------------------------------------------------

function genderFor(interest: Interest, rng: Rng): Gender {
  if (interest === 'women') return 'f';
  if (interest === 'men') return 'm';
  return rng.chance(0.5) ? 'f' : 'm';
}

function firstNames(gender: Gender, ctx: GameContext): readonly string[] {
  return gender === 'f' ? ctx.content.private.femaleFirstNames : ctx.content.names.firstNames;
}

/** Una persona nuova, compatibile con l'orientamento del giocatore. */
function newPerson(interest: Interest, rng: Rng, ctx: GameContext): PrivatePerson {
  const gender = genderFor(interest, rng);
  const av = ctx.content.avatar;
  return {
    firstName: rng.pick(firstNames(gender, ctx)),
    lastName: rng.pick(ctx.content.names.lastNames),
    gender,
    job: rng.pick(ctx.content.private.jobs),
    skin: rng.int(0, av.skinTones.length - 1),
    hairColor: rng.int(0, av.hairColors.length - 1),
    hair: rng.pick(ctx.content.private.partnerHair[gender]),
  };
}

const personOf = (p: PrivatePerson): PrivatePerson => ({
  firstName: p.firstName,
  lastName: p.lastName,
  gender: p.gender,
  job: p.job,
  skin: p.skin,
  hairColor: p.hairColor,
  hair: p.hair,
});

/** Il giocatore conosce qualcuno (solo da single): resta disponibile per qualche settimana. */
export function meetSomeone(state: GameState, rng: Rng, ctx: GameContext): GameState {
  const life = privateOf(state, ctx);
  if (life.partner) return state;
  const prospect = {
    ...newPerson(life.interest, rng, ctx),
    expiresWeek: state.week + ctx.config.private.meeting.prospectWeeks,
  };
  return withLife(state, { ...life, prospect });
}

function childName(state: GameState, gender: Gender, rng: Rng, ctx: GameContext): string {
  const life = privateOf(state, ctx);
  const taken = new Set([state.player.firstName, ...life.children.map((c) => c.firstName)]);
  const names = firstNames(gender, ctx).filter((n) => !taken.has(n));
  return rng.pick(names.length > 0 ? names : firstNames(gender, ctx));
}

// --- Eventi del motore ------------------------------------------------------------------------

/** Mette in coda per la settimana dopo l'evento legato a un fatto della vita privata. */
function trigger(state: GameState, what: EventTrigger, ctx: GameContext): GameState {
  const events = ctx.content.events.filter((e) => e.trigger === what);
  if (events.length === 0) return state;
  // Scelta senza consumare il generatore: cambia con la settimana.
  const event = events[state.week % events.length]!;
  return {
    ...state,
    scheduled: [...state.scheduled, { eventId: event.id, atWeek: state.week + 1 }],
  };
}

// --- Fine di una relazione --------------------------------------------------------------------

export interface BreakupReport {
  name: string;
  stage: PartnerStage;
  /** Soldi andati all'ex coniuge (solo divorzio). */
  settlement: number;
  /** Figli che da ora vivono con l'ex. */
  childrenMoved: number;
}

/**
 * Chiude la relazione: l'ex finisce nell'elenco, la storia segreta finisce, i figli vanno a
 * vivere con l'altro genitore (si paga l'assegno) e, se c'era il matrimonio, una quota di cassa e
 * deposito va all'ex coniuge.
 */
export function breakUp(
  state: GameState,
  ctx: GameContext = defaultContext,
): { state: GameState; report: BreakupReport } {
  const life = privateOf(state, ctx);
  const partner = life.partner;
  if (!partner) throw new Error('There is no relationship to end');
  const cfg = ctx.config.private;
  let player = state.player;
  let finance = state.finance;
  let settlement = 0;
  if (partner.stage === 'married') {
    const cash = Math.max(0, player.money.cash);
    const deposit = finance?.deposit ?? 0;
    settlement = Math.round(cfg.divorce.liquidShare * (cash + deposit));
    const fromCash = Math.min(cash, settlement);
    player = adjust(player, { cash: -fromCash });
    if (finance && settlement > fromCash) {
      finance = { ...finance, deposit: Math.round(finance.deposit - (settlement - fromCash)) };
    }
  }
  const moved = life.children.filter((c) => c.withPlayer).length;
  player = adjust(player, cfg.breakup);
  const { partner: _gone, affair: _affair, ...rest } = life;
  const next: PrivateLife = {
    ...rest,
    children: life.children.map((c) => ({ ...c, withPlayer: false })),
    exes: [
      ...life.exes,
      {
        firstName: partner.firstName,
        lastName: partner.lastName,
        gender: partner.gender,
        endedWeek: state.week,
        stage: partner.stage,
      },
    ],
  };
  return {
    state: { ...state, player, privateLife: next, ...(finance ? { finance } : {}) },
    report: {
      name: partner.firstName,
      stage: partner.stage,
      settlement,
      childrenMoved: moved,
    },
  };
}

/** Il giocatore chiude da sé la storia segreta (senza costi). */
export function endAffair(state: GameState, ctx: GameContext = defaultContext): GameState {
  const life = privateOf(state, ctx);
  if (!life.affair) throw new Error('There is no affair');
  const { affair: _a, ...rest } = life;
  return withLife(state, rest);
}

/** Inizia una storia segreta (solo con un partner, una alla volta). */
export function startAffair(state: GameState, ctx: GameContext = defaultContext): GameState {
  const life = privateOf(state, ctx);
  if (!life.partner || life.affair) return state;
  return withLife(state, { ...life, affair: { sinceWeek: state.week } });
}

/** Cambia l'affinità con il partner (da single non fa nulla). */
export function shiftPartner(state: GameState, delta: number, ctx = defaultContext): GameState {
  const life = privateOf(state, ctx);
  if (!life.partner) return state;
  return withLife(state, shiftAffinity(life, delta));
}

/** Cambia l'orientamento (vale per le persone conosciute da ora in poi). */
export function setInterest(
  state: GameState,
  interest: Interest,
  ctx: GameContext = defaultContext,
): GameState {
  return withLife(state, { ...privateOf(state, ctx), interest });
}

// --- Azioni private ---------------------------------------------------------------------------

export interface PrivateActionView {
  id: string;
  nameKey: string;
  descKey: string;
  cost: number;
  available: boolean;
  reasonKey?: string;
  reasonParams?: Record<string, number>;
}

function actionConfig(id: string, ctx: GameContext): PrivateActionConfig {
  const a = ctx.config.private.actions.find((x) => x.id === id);
  if (!a) throw new Error(`Unknown private action "${id}"`);
  return a;
}

function blockReason(
  state: GameState,
  a: PrivateActionConfig,
  ctx: GameContext,
): { key: string; params?: Record<string, number> } | null {
  const life = privateOf(state, ctx);
  const p = state.player;
  const partner = life.partner;
  // Prima la situazione (un'azione fuori luogo non si mostra), poi i limiti di settimana ed età.
  switch (a.needs) {
    case 'single':
      if (partner) return { key: 'private.blocked.hasPartner' };
      if (life.prospect) return { key: 'private.blocked.hasProspect' };
      break;
    case 'prospect':
      if (partner) return { key: 'private.blocked.hasPartner' };
      if (!life.prospect) return { key: 'private.blocked.noProspect' };
      break;
    case 'partner':
      if (!partner) return { key: 'private.blocked.single' };
      break;
    case 'dating':
      if (partner?.stage !== 'dating') return { key: 'private.blocked.notDating' };
      break;
    case 'engaged':
      if (partner?.stage !== 'engaged') return { key: 'private.blocked.notEngaged' };
      break;
    case 'children':
      if (life.children.length === 0) return { key: 'private.blocked.noChildren' };
      break;
  }
  if (life.actionWeek === state.week) return { key: 'private.blocked.done' };
  if (ageAt(p.birthWeek, state.week, ctx.config.calendar) < a.minAge) {
    return { key: 'private.blocked.age', params: { age: a.minAge } };
  }
  if (partner && a.minWeeksTogether !== undefined) {
    const left = partner.sinceWeek + a.minWeeksTogether - state.week;
    if (left > 0) return { key: 'private.blocked.weeks', params: { weeks: left } };
  }
  if (partner && a.minWeeksInStage !== undefined) {
    const left = partner.stageWeek + a.minWeeksInStage - state.week;
    if (left > 0) return { key: 'private.blocked.weeks', params: { weeks: left } };
  }
  if (partner && a.minAffinity !== undefined && partner.affinity < a.minAffinity) {
    return { key: 'private.blocked.affinity' };
  }
  if (a.id === 'child') {
    if (life.expecting) return { key: 'private.blocked.expecting' };
    if (life.children.length >= ctx.config.private.children.max) {
      return { key: 'private.blocked.maxChildren' };
    }
  }
  if (a.freeWeekOnly && playerFixtures(state).length > 0) {
    return { key: 'private.blocked.matchWeek' };
  }
  if (scaledCost(a.cost, p) > Math.max(0, p.money.cash)) return { key: 'private.blocked.money' };
  return null;
}

/** Le azioni private della settimana (una sola a settimana, fuori dal piano di allenamento). */
export function getPrivateActions(
  state: GameState,
  ctx: GameContext = defaultContext,
): PrivateActionView[] {
  return ctx.config.private.actions.map((a) => {
    const reason = blockReason(state, a, ctx);
    return {
      id: a.id,
      nameKey: `private.actions.${a.id}.name`,
      descKey: `private.actions.${a.id}.desc`,
      cost: scaledCost(a.cost, state.player),
      available: reason === null,
      ...(reason ? { reasonKey: reason.key } : {}),
      ...(reason?.params ? { reasonParams: reason.params } : {}),
    };
  });
}

/** Com'è andata un'azione privata. */
export type PrivateOutcome = 'done' | 'met' | 'nobody' | 'yes' | 'no' | 'expecting' | 'notYet';

export interface PrivateActionReport {
  actionId: string;
  outcome: PrivateOutcome;
  cost: number;
  /** Nome della persona coinvolta (incontro, appuntamento, proposta). */
  name?: string;
}

/** Esegue un'azione privata della settimana. */
export function doPrivateAction(
  state: GameState,
  actionId: string,
  ctx: GameContext = defaultContext,
): { state: GameState; report: PrivateActionReport } {
  if (state.retired) throw new Error('The career is over');
  const a = actionConfig(actionId, ctx);
  const reason = blockReason(state, a, ctx);
  if (reason) throw new Error(`Private action "${actionId}" is not available: ${reason.key}`);

  const cfg = ctx.config.private;
  const rng = Rng.fromState(state.rngState);
  let life: PrivateLife = { ...privateOf(state, ctx), actionWeek: state.week };
  let player = state.player;
  let s: GameState = state;
  let cost = scaledCost(a.cost, player);
  let outcome: PrivateOutcome = 'done';
  let name: string | undefined;
  const popularity = player.image.popularity;

  switch (a.id) {
    case 'meet': {
      const chance = Math.min(0.95, cfg.meeting.chance + popularity * cfg.meeting.popularityBonus);
      if (rng.chance(chance)) {
        const met = meetSomeone(withLife(s, life, player), rng, ctx).privateLife!;
        life = met;
        outcome = 'met';
        name = met.prospect?.firstName;
      } else outcome = 'nobody';
      break;
    }
    case 'ask_out': {
      const prospect = life.prospect!;
      name = prospect.firstName;
      const chance = Math.min(0.95, cfg.askOut.chance + popularity * cfg.askOut.popularityBonus);
      const { prospect: _p, ...rest } = life;
      if (rng.chance(chance)) {
        const partner: Partner = {
          ...personOf(prospect),
          stage: 'dating',
          sinceWeek: state.week,
          stageWeek: state.week,
          affinity: cfg.affinity.start,
        };
        life = { ...rest, partner };
        player = adjust(player, { happiness: cfg.askOut.happinessOnYes });
        outcome = 'yes';
      } else {
        life = rest;
        player = adjust(player, { happiness: cfg.askOut.happinessOnNo });
        outcome = 'no';
      }
      break;
    }
    case 'propose': {
      const partner = life.partner!;
      name = partner.firstName;
      const chance = clamp(
        cfg.proposal.chanceAtMinAffinity +
          (partner.affinity - (a.minAffinity ?? 0)) * cfg.proposal.chancePerAffinityPoint,
        0.05,
        0.95,
      );
      if (rng.chance(chance)) {
        life = { ...life, partner: { ...partner, stage: 'engaged', stageWeek: state.week } };
        player = adjust(player, { happiness: cfg.proposal.happinessOnYes });
        outcome = 'yes';
      } else {
        // L'anello si compra solo se la risposta è sì.
        cost = 0;
        life = shiftAffinity(life, cfg.proposal.affinityOnNo);
        player = adjust(player, { happiness: cfg.proposal.happinessOnNo });
        outcome = 'no';
      }
      break;
    }
    case 'wedding': {
      const partner = life.partner!;
      name = partner.firstName;
      life = { ...life, partner: { ...partner, stage: 'married', stageWeek: state.week } };
      break;
    }
    case 'child': {
      if (rng.chance(cfg.children.conceiveChance)) {
        life = { ...life, expecting: { dueWeek: state.week + cfg.children.pregnancyWeeks } };
        outcome = 'expecting';
      } else outcome = 'notYet';
      break;
    }
    default:
      break;
  }

  if (a.affinity) life = shiftAffinity(life, a.affinity);
  player = adjust(player, { ...a.effects, cash: -cost });
  s = { ...withLife(s, life, player), rngState: rng.getState() };
  return { state: s, report: { actionId, outcome, cost, ...(name ? { name } : {}) } };
}

// --- Serate (azione del piano settimanale) ----------------------------------------------------

export interface PartyReport {
  /** Le foto della serata sono finite sui giornali. */
  gossip: boolean;
  /** Multa del club (0 = nessuna). */
  fine: number;
}

/**
 * Rischi di una serata: gossip (reputazione giù, popolarità su, il partner si arrabbia) e, se in
 * settimana c'è ancora una partita da giocare, la multa del club.
 */
export function applyParty(
  state: GameState,
  rng: Rng,
  ctx: GameContext = defaultContext,
  /** Probabilità e costi del piano settimanale (`progression.life.party`) al posto di quelli della serata singola. */
  over: {
    gossipChance?: number;
    fineChance?: number;
    partnerAffinity?: number;
    hasMatch?: boolean;
  } = {},
): { state: GameState; report: PartyReport } {
  const cfg = {
    ...ctx.config.private.party,
    ...(over.gossipChance !== undefined ? { gossipChance: over.gossipChance } : {}),
    ...(over.fineChance !== undefined ? { fineChance: over.fineChance } : {}),
    ...(over.partnerAffinity !== undefined ? { partnerAffinity: over.partnerAffinity } : {}),
  };
  let life = state.privateLife;
  let player = state.player;
  if (life?.partner) life = shiftAffinity(life, cfg.partnerAffinity);
  const gossip = rng.chance(cfg.gossipChance);
  if (gossip) {
    player = adjust(player, {
      reputation: cfg.gossip.reputation,
      popularity: cfg.gossip.popularity,
    });
    if (life?.partner) life = shiftAffinity(life, cfg.gossip.affinity);
  }
  let fine = 0;
  if (
    (over.hasMatch ?? Boolean(playerFixture(state))) &&
    player.clubId &&
    rng.chance(cfg.fineChance)
  ) {
    fine = scaledCost(cfg.fine, player);
    player = adjust(player, { cash: -fine });
    const club = state.world.clubs.find((c) => c.id === player.clubId);
    if (club) {
      const before = player.relationships[club.coachId] ?? 0;
      player = {
        ...player,
        relationships: {
          ...player.relationships,
          [club.coachId]: clamp(before + cfg.fineCoachRelationship, -100, 100),
        },
      };
    }
  }
  return {
    state: { ...state, player, ...(life ? { privateLife: life } : {}) },
    report: { gossip, fine },
  };
}

// --- Settimana --------------------------------------------------------------------------------

export interface PrivateWeek {
  /** Spese per i figli che vivono con il giocatore. */
  childCosts: number;
  /** Assegno per i figli che vivono con l'ex. */
  alimony: number;
  born: Child | null;
  affairDiscovered: boolean;
  partnerLeft: boolean;
  /** Soldi andati all'ex coniuge se il partner se n'è andato da sposato. */
  settlement: number;
}

const quietWeek = (): PrivateWeek => ({
  childCosts: 0,
  alimony: 0,
  born: null,
  affairDiscovered: false,
  partnerLeft: false,
  settlement: 0,
});

/**
 * La vita privata della settimana: l'intesa cala piano (in crisi cala la felicità), la storia
 * segreta può venire scoperta, i figli nascono, costano e rendono felici, gli assegni si pagano.
 * Senza partner e senza storia segreta non consuma il generatore.
 */
export function applyWeeklyPrivate(
  state: GameState,
  rng: Rng,
  ctx: GameContext = defaultContext,
  /** Famiglia: l'intesa col partner non cala (fattore 0). Default neutro. */
  lifeMods?: { affinityDriftFactor: number },
): { state: GameState; week: PrivateWeek } {
  if (!state.privateLife) return { state, week: quietWeek() };
  const cfg = ctx.config.private;
  const week = quietWeek();
  let s = state;
  let life = state.privateLife;
  let player = state.player;

  if (life.prospect && life.prospect.expiresWeek <= state.week) {
    const { prospect: _p, ...rest } = life;
    life = rest;
  }

  if (life.partner) {
    const drift =
      life.partner.stage === 'married'
        ? cfg.affinity.marriedDriftPerWeek
        : cfg.affinity.driftPerWeek;
    life = shiftAffinity(life, drift * (lifeMods?.affinityDriftFactor ?? 1));
    if (life.partner!.affinity < cfg.affinity.crisisBelow) {
      player = adjust(player, { happiness: cfg.affinity.crisisHappinessPerWeek });
    }
  }

  if (life.affair) {
    player = adjust(player, {
      happiness: cfg.affair.happinessPerWeek,
      discipline: cfg.affair.disciplinePerWeek,
    });
    const chance = Math.min(
      0.9,
      cfg.affair.discoveryChance + player.image.popularity * cfg.affair.discoveryPerPopularity,
    );
    if (rng.chance(chance)) {
      const d = cfg.affair.onDiscovery;
      const { affair: _a, ...rest } = life;
      life = shiftAffinity(rest, d.affinity);
      player = adjust(player, {
        popularity: d.popularity,
        reputation: d.reputation,
        happiness: d.happiness,
      });
      week.affairDiscovered = true;
    }
  }

  if (life.expecting && life.expecting.dueWeek <= state.week) {
    const gender: Gender = rng.chance(0.5) ? 'f' : 'm';
    const child: Child = {
      id: `ch${s.nextId}`,
      firstName: childName({ ...s, privateLife: life }, gender, rng, ctx),
      gender,
      birthWeek: state.week,
      withPlayer: Boolean(life.partner),
    };
    const { expecting: _e, ...rest } = life;
    life = shiftAffinity(
      { ...rest, children: [...rest.children, child] },
      cfg.children.birthAffinity,
    );
    player = adjust(player, { happiness: cfg.children.birthHappiness });
    s = { ...s, nextId: s.nextId + 1 };
    week.born = child;
  }

  const home = life.children.filter((c) => c.withPlayer).length;
  const away = life.children.length - home;
  week.childCosts = home * scaledCost(cfg.children.cost, player);
  week.alimony = away * scaledCost(cfg.divorce.alimonyPerChild, player);
  player = adjust(player, {
    cash: -(week.childCosts + week.alimony),
    happiness: Math.min(cfg.children.maxHappinessPerWeek, home * cfg.children.happinessPerWeek),
  });
  s = withLife(s, life, player);

  if (life.partner && life.partner.affinity <= cfg.affinity.leaveAtOrBelow) {
    const ended = breakUp(s, ctx);
    s = trigger(ended.state, 'partnerLeft', ctx);
    week.partnerLeft = true;
    week.settlement = ended.report.settlement;
  } else if (week.affairDiscovered) {
    s = trigger(s, 'affairDiscovered', ctx);
  }
  if (week.born) s = trigger(s, 'childBorn', ctx);
  return { state: s, week };
}

/** Valori dei segnaposto `{partner}` e `{child}` per i testi degli eventi. */
export function privateParams(state: GameState): Record<string, string> {
  const life = state.privateLife;
  const params: Record<string, string> = {};
  if (life?.partner) params['partner'] = life.partner.firstName;
  const youngest = life?.children.at(-1);
  if (youngest) params['child'] = youngest.firstName;
  return params;
}
