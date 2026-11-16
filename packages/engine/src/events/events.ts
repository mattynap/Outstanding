import {
  eventTextKeys,
  type EventCategory,
  type EventConditions,
  type EventEffect,
  type GameEvent,
  type StatPath,
} from '@outstanding/content';
import { mainBusiness, shiftMainBusiness } from '../finance/finance';
import {
  breakUp,
  endAffair,
  meetSomeone,
  privateParams,
  relationshipState,
  shiftPartner,
  startAffair,
} from '../private/private';
import { defaultContext, type GameContext } from '../context';
import { computeOvr } from '../player/ratings';
import { Rng } from '../rng';
import { getTransferWindow } from '../season/week';
import { ageAt, weekOfSeason } from '../time';
import type { GameState, PendingEvent, TransferRequest } from '../types';
import { getClub, getGroup } from '../world/queries';
import { getStat, setStat } from './stats';

/** Categorie che hanno senso solo se il giocatore ha una squadra. */
const CLUB_CATEGORIES: ReadonlySet<EventCategory> = new Set([
  'dressing_room',
  'training',
  'transfer',
]);

/** Evento come lo vede l'interfaccia. */
export interface EventView {
  eventId: string;
  category: EventCategory;
  titleKey: string;
  textKey: string;
  /** Valori per i segnaposto dei testi. */
  params: Record<string, string>;
  choices: { textKey: string }[];
}

/** Una modifica applicata da una scelta, per mostrarla al giocatore. */
export type EventChange =
  | { kind: 'stat'; path: StatPath; before: number; after: number }
  | { kind: 'flag'; flag: string; value: boolean | number | string | null }
  | { kind: 'relationship'; npcId: string; before: number; after: number }
  | { kind: 'scheduled'; eventId: string; atWeek: number }
  | { kind: 'transferRequest'; to: TransferRequest['to'] }
  | { kind: 'injury'; injuryType: string; weeks: number }
  | { kind: 'trait'; traitId: string; action: 'add' | 'remove' }
  | { kind: 'business'; name: string; before: number; after: number }
  | { kind: 'partner'; name: string; before: number; after: number }
  | { kind: 'meet'; name: string }
  | { kind: 'affair'; action: 'start' | 'end' }
  | { kind: 'breakup'; name: string; settlement: number };

export interface EventReport {
  eventId: string;
  choiceIndex: number;
  changes: EventChange[];
}

export function getEvent(id: string, ctx: GameContext): GameEvent {
  const event = ctx.content.events.find((e) => e.id === id);
  if (!event) throw new Error(`Unknown event "${id}"`);
  return event;
}

const inRange = (v: number, r: { min?: number | undefined; max?: number | undefined }) =>
  (r.min === undefined || v >= r.min) && (r.max === undefined || v <= r.max);

/** Vero se lo stato soddisfa tutte le condizioni dell'evento. */
export function checkConditions(
  c: EventConditions | undefined,
  state: GameState,
  ctx: GameContext = defaultContext,
): boolean {
  if (!c) return true;
  const p = state.player;
  const cal = ctx.config.calendar;
  const club = p.clubId ? getClub(state.world, p.clubId) : undefined;
  const flag = (f: string) => Boolean(p.flags[f]);

  if (c.age && !inRange(ageAt(p.birthWeek, state.week, cal), c.age)) return false;
  if (
    c.stats?.some((s) => {
      const v = getStat(p, s.path);
      return (s.gte !== undefined && v < s.gte) || (s.lte !== undefined && v > s.lte);
    })
  ) {
    return false;
  }
  if (c.window && (getTransferWindow(state, ctx) ?? 'closed') !== c.window) return false;
  if (c.flags && !c.flags.every(flag)) return false;
  if (c.flagsNot?.some(flag)) return false;
  if (c.roles && !c.roles.includes(p.role)) return false;
  if (c.traits && !c.traits.every((t) => p.traits.includes(t))) return false;
  if (c.traitsNot?.some((t) => p.traits.includes(t))) return false;
  if (c.injured !== undefined && Boolean(p.injury && p.injury.weeksLeft > 0) !== c.injured) {
    return false;
  }
  if (c.seasonWeek && !inRange(weekOfSeason(state.week, cal), c.seasonWeek)) return false;
  if (c.business !== undefined && Boolean(mainBusiness(state)) !== c.business) return false;
  if (c.relationship) {
    const rel = relationshipState(state);
    if (c.relationship === 'partner' ? rel === 'single' : rel !== c.relationship) return false;
  }
  if (c.affinity) {
    const partner = state.privateLife?.partner;
    if (!partner || !inRange(partner.affinity, c.affinity)) return false;
  }
  const life = state.privateLife;
  if (c.children !== undefined && (life?.children.length ?? 0) > 0 !== c.children) return false;
  if (c.affair !== undefined && Boolean(life?.affair) !== c.affair) return false;
  if (c.level || c.professional !== undefined || c.coachRelationship) {
    if (!club) return false;
    const { league } = getGroup(state.world, club.groupId);
    if (c.level && !inRange(league.level, c.level)) return false;
    if (c.professional !== undefined && league.professional !== c.professional) return false;
    if (c.coachRelationship && !inRange(p.relationships[club.coachId] ?? 0, c.coachRelationship)) {
      return false;
    }
  }
  return true;
}

/** Vero se l'evento può essere estratto a caso questa settimana. */
function isAvailable(event: GameEvent, state: GameState, ctx: GameContext): boolean {
  if (event.chainOnly) return false;
  if (!state.player.clubId && CLUB_CATEGORIES.has(event.category)) return false;
  if ((state.cooldowns[event.id] ?? -Infinity) > state.week) return false;
  if (event.once && state.eventLog.some((l) => l.eventId === event.id)) return false;
  return checkConditions(event.conditions, state, ctx);
}

function pending(event: GameEvent, rng: Rng): PendingEvent {
  return { eventId: event.id, textVariant: rng.int(1, event.textVariants ?? 1) };
}

/**
 * Estrae gli eventi della settimana: prima quelli in catena arrivati a scadenza, poi quelli casuali
 * (numero e pesi in config/events.json), con al massimo `maxPerCategoryPerWeek` per categoria.
 * Chiamarla due volte nella stessa settimana restituisce gli stessi eventi.
 */
export function drawWeekEvents(
  state: GameState,
  ctx: GameContext = defaultContext,
): { state: GameState; events: EventView[] } {
  if (state.retired) throw new Error('The career is over');
  if (state.eventsWeek === state.week) return { state, events: getPendingEvents(state, ctx) };
  const cfg = ctx.config.events;
  const rng = Rng.fromState(state.rngState);
  const max = cfg.perWeekWeights.length - 1;
  const target = rng.weighted(
    cfg.perWeekWeights.map((_, i) => i),
    (i) => cfg.perWeekWeights[i]!,
  );

  const chosen: PendingEvent[] = [];
  const perCategory = new Map<string, number>();
  const take = (event: GameEvent) => {
    chosen.push(pending(event, rng));
    perCategory.set(event.category, (perCategory.get(event.category) ?? 0) + 1);
  };

  // Gli eventi in catena arrivano anche oltre il numero estratto, fino al massimo settimanale.
  const remaining: GameState['scheduled'] = [];
  for (const s of state.scheduled) {
    if (s.atWeek > state.week) {
      remaining.push(s);
      continue;
    }
    const event = getEvent(s.eventId, ctx);
    if (chosen.length >= Math.max(max, 1)) remaining.push(s);
    else if (checkConditions(event.conditions, state, ctx)) take(event);
  }

  let candidates = ctx.content.events.filter((e) => isAvailable(e, state, ctx));
  while (chosen.length < target) {
    candidates = candidates.filter(
      (e) =>
        !chosen.some((c) => c.eventId === e.id) &&
        (perCategory.get(e.category) ?? 0) < cfg.maxPerCategoryPerWeek,
    );
    if (candidates.length === 0) break;
    take(rng.weighted(candidates, (e) => e.weight));
  }

  const next: GameState = {
    ...state,
    scheduled: remaining,
    pendingEvents: chosen,
    eventsWeek: state.week,
    rngState: rng.getState(),
  };
  return { state: next, events: getPendingEvents(next, ctx) };
}

/** Valori dei segnaposto per i testi degli eventi. */
function eventParams(state: GameState): Record<string, string> {
  const p = state.player;
  const params: Record<string, string> = {
    firstName: p.firstName,
    lastName: p.lastName,
    hometown: p.hometown,
    city: p.hometown,
  };
  if (p.clubId) {
    const club = getClub(state.world, p.clubId);
    params['club'] = club.shortName;
    params['city'] = club.city;
    const coach = state.world.npcs.find((n) => n.id === club.coachId);
    if (coach) params['coach'] = `${coach.firstName} ${coach.lastName}`;
  }
  const agent = p.agentId ? state.world.npcs.find((n) => n.id === p.agentId) : undefined;
  if (agent) params['agent'] = `${agent.firstName} ${agent.lastName}`;
  const business = mainBusiness(state);
  if (business) params['business'] = business.name;
  return { ...params, ...privateParams(state) };
}

/** Eventi della settimana ancora senza risposta. */
export function getPendingEvents(state: GameState, ctx: GameContext = defaultContext): EventView[] {
  const params = eventParams(state);
  return state.pendingEvents.map((pe) => {
    const event = getEvent(pe.eventId, ctx);
    return {
      eventId: event.id,
      category: event.category,
      titleKey: event.titleKey,
      textKey: eventTextKeys(event)[pe.textVariant - 1] ?? event.textKey,
      params,
      choices: event.choices.map((c) => ({ textKey: c.textKey })),
    };
  });
}

/** Applica una lista di effetti, restituendo il nuovo stato e le modifiche fatte. */
function applyEffects(
  state: GameState,
  effects: readonly EventEffect[],
  rng: Rng,
  ctx: GameContext,
  changes: EventChange[],
): GameState {
  let s = state;
  const limits = ctx.config.events.statLimits;
  const stat = (path: StatPath, delta: number) => {
    const before = getStat(s.player, path);
    let value = before + delta;
    // Anche le abilità guadagnate con gli eventi rispettano il potenziale nascosto.
    if (path.startsWith('skills.') && delta > 0) {
      const g = ctx.config.progression.growth;
      const p = s.player;
      const ovr = computeOvr(p.skills, p.role, ctx.config.ratings);
      const gap = Math.min(1, Math.max(0, (p.potential - ovr) / g.potentialGapScale));
      const cap = Math.min(g.skillMax, p.potential + g.skillCapOverPotential);
      value = Math.max(before, Math.min(cap, before + delta * gap));
    }
    const player = setStat(s.player, path, value, limits);
    s = { ...s, player };
    changes.push({ kind: 'stat', path, before, after: getStat(player, path) });
  };

  for (const effect of effects) {
    switch (effect.type) {
      case 'stat':
        stat(effect.path, effect.delta);
        break;
      case 'money':
        stat('money.cash', effect.delta);
        break;
      case 'flag': {
        const value = effect.value === undefined ? true : effect.value;
        const flags = { ...s.player.flags };
        if (value === null) delete flags[effect.flag];
        else flags[effect.flag] = value;
        s = { ...s, player: { ...s.player, flags } };
        changes.push({ kind: 'flag', flag: effect.flag, value });
        break;
      }
      case 'relationship': {
        // Senza club o senza procuratore l'effetto non ha bersaglio.
        const npcId =
          effect.target === 'coach'
            ? s.player.clubId
              ? getClub(s.world, s.player.clubId).coachId
              : undefined
            : s.player.agentId;
        if (!npcId) break;
        const before = s.player.relationships[npcId] ?? 0;
        const after = Math.min(100, Math.max(-100, before + effect.delta));
        s = {
          ...s,
          player: { ...s.player, relationships: { ...s.player.relationships, [npcId]: after } },
        };
        changes.push({ kind: 'relationship', npcId, before, after });
        break;
      }
      case 'schedule': {
        const atWeek = s.week + effect.inWeeks;
        s = { ...s, scheduled: [...s.scheduled, { eventId: effect.eventId, atWeek }] };
        changes.push({ kind: 'scheduled', eventId: effect.eventId, atWeek });
        break;
      }
      case 'startTransfer':
        s = { ...s, transferRequests: [...s.transferRequests, { to: effect.to, week: s.week }] };
        changes.push({ kind: 'transferRequest', to: effect.to });
        break;
      case 'injury': {
        const weeks = rng.int(effect.weeks[0], effect.weeks[1]);
        const current = s.player.injury;
        if (!current || current.weeksLeft < weeks) {
          s = {
            ...s,
            player: { ...s.player, injury: { type: effect.injuryType, weeksLeft: weeks } },
          };
          changes.push({ kind: 'injury', injuryType: effect.injuryType, weeks });
        }
        break;
      }
      case 'trait': {
        const has = s.player.traits.includes(effect.traitId);
        if (effect.action === 'add' && !has) {
          s = { ...s, player: { ...s.player, traits: [...s.player.traits, effect.traitId] } };
        } else if (effect.action === 'remove' && has) {
          s = {
            ...s,
            player: { ...s.player, traits: s.player.traits.filter((t) => t !== effect.traitId) },
          };
        } else break;
        changes.push({ kind: 'trait', traitId: effect.traitId, action: effect.action });
        break;
      }
      case 'business': {
        const main = mainBusiness(s);
        if (!main) break;
        s = shiftMainBusiness(s, effect.health);
        const after = mainBusiness(s)!.health;
        changes.push({ kind: 'business', name: main.name, before: main.health, after });
        break;
      }
      case 'partner': {
        const partner = s.privateLife?.partner;
        if (!partner) break;
        s = shiftPartner(s, effect.affinity, ctx);
        const after = s.privateLife!.partner!.affinity;
        changes.push({ kind: 'partner', name: partner.firstName, before: partner.affinity, after });
        break;
      }
      case 'meet': {
        if (s.privateLife?.partner) break;
        s = meetSomeone(s, rng, ctx);
        const name = s.privateLife?.prospect?.firstName;
        if (name) changes.push({ kind: 'meet', name });
        break;
      }
      case 'affair': {
        const has = Boolean(s.privateLife?.affair);
        if (effect.action === 'start' && !has && s.privateLife?.partner) {
          s = startAffair(s, ctx);
        } else if (effect.action === 'end' && has) {
          s = endAffair(s, ctx);
        } else break;
        changes.push({ kind: 'affair', action: effect.action });
        break;
      }
      case 'breakup': {
        if (!s.privateLife?.partner) break;
        const ended = breakUp(s, ctx);
        s = ended.state;
        changes.push({
          kind: 'breakup',
          name: ended.report.name,
          settlement: ended.report.settlement,
        });
        break;
      }
      case 'chance': {
        const branch = rng.chance(effect.p) ? effect.effects : (effect.otherwise ?? []);
        s = applyEffects(s, branch, rng, ctx, changes);
        break;
      }
    }
  }
  return s;
}

/** Risolve un evento in attesa con la scelta del giocatore. */
export function resolveEvent(
  state: GameState,
  eventId: string,
  choiceIndex: number,
  ctx: GameContext = defaultContext,
): { state: GameState; report: EventReport } {
  if (!state.pendingEvents.some((p) => p.eventId === eventId)) {
    throw new Error(`Event "${eventId}" is not pending`);
  }
  const event = getEvent(eventId, ctx);
  const choice = event.choices[choiceIndex];
  if (!choice) throw new Error(`Invalid choice ${choiceIndex} for event "${eventId}"`);

  const rng = Rng.fromState(state.rngState);
  const changes: EventChange[] = [];
  let s = applyEffects(state, choice.effects, rng, ctx, changes);
  s = {
    ...s,
    pendingEvents: s.pendingEvents.filter((p) => p.eventId !== eventId),
    eventLog: [...s.eventLog, { eventId, week: state.week, choice: choiceIndex }],
    cooldowns:
      event.cooldownWeeks > 0
        ? { ...s.cooldowns, [eventId]: state.week + event.cooldownWeeks }
        : s.cooldowns,
    rngState: rng.getState(),
  };
  return { state: s, report: { eventId, choiceIndex, changes } };
}
