import { defaultContext, type GameContext } from '../context';
import { difficultyMods } from '../difficulty';
import {
  endOfWeekFreshness,
  growthFreshnessFactor,
  momentFreshnessModifier,
} from '../player/freshness';
import { matchFreshnessCost, matchInjuryChance } from '../player/condition';
import { growthFactors } from '../player/progression';
import { SKILLS } from '../player/ratings';
import { ageAt, seasonStartWeek, weekOfSeason } from '../time';
import type { EffectiveLoad, GameState, Player, Skill, Skills, WeekPlan } from '../types';
import { chapterOf } from './director';
import { lifeFreshness, sponsorWeekIncome } from './life';
import { effectiveLoad, loadFreshness, loadWeekGrowth, sessionInjuryChance } from './load';
import { assertWeekPlan, lifeAvailable } from './plan';

export interface PlanPreview {
  /**
   * Esatto per la settimana corrente, senza eventi: gli stessi numeri di `planWeek`. Se c'è una
   * partita, `freshnessEnd` la conta da titolare per 90 minuti; `freshnessDelta` no.
   */
  weekly: {
    /** Delta grezzo del piano (carico + vita), prima di partita e tetto: lo stesso di `planWeek`. */
    freshnessDelta: number;
    /** Freschezza a fine settimana, col tetto del carico e nell'ipotesi titolare 90' a ogni partita. */
    freshnessEnd: number;
    /** Freschezza persa solo per il tetto del carico (es. Spinta da 95: scende a 70). */
    capDrop: number;
    gains: Partial<Skills>;
    lifeEffects: { moneyPerWeek?: number; popularityPerWeek?: number; disciplinePerWeek?: number };
  };
  /** Proiezione fino al prossimo stop di capitolo, col piano ripetuto ogni settimana. */
  chapter: {
    weeks: number;
    matches: number;
    /** Ipotesi: titolare per 90 minuti a ogni partita. */
    freshnessAtMatches: number[];
    momentsModifier: number;
    injuryChance: number;
    riskBand: 'low' | 'medium' | 'high';
    benchRisk: 'none' | 'some';
    nextPoint?: { skill: Skill; weeks: number };
    pace: 'fast' | 'normal' | 'slow' | 'stopped';
    paceReason: 'age' | 'discipline' | 'freshness';
    declineFactor?: number;
    gossipChance?: number;
    fineChance?: number;
    moneyTotal?: number;
  };
}

/** Settimane dalla corrente (compresa) al prossimo cambio di capitolo o a fine stagione. */
export function chapterWeeksLeft(state: GameState, ctx: GameContext): number {
  const cal = ctx.config.calendar;
  const inSeason = weekOfSeason(state.week, cal);
  const id = chapterOf(inSeason, cal);
  const i = cal.chapters.findIndex((c) => c.id === id);
  const next = cal.chapters[i + 1];
  const end = next
    ? seasonStartWeek(state.season, cal) + next.fromWeek
    : seasonStartWeek(state.season + 1, cal);
  return Math.max(1, end - state.week);
}

/** Probabilità che l'evento accada almeno una volta, da una probabilità per ciascun tentativo. */
function atLeastOnce(perTry: number, tries: number): number {
  return 1 - Math.pow(1 - perTry, tries);
}

/**
 * Anteprima esatta di un piano, senza effetti: non estrae dal generatore e non tocca lo stato. Usa
 * gli stessi calcoli di `planWeek` (crescita, tiro d'infortunio, freschezza, vita) e li proietta
 * sulle settimane del capitolo. Il potenziale non esce mai: entra solo nel ritmo, come classe.
 */
export function previewPlan(
  state: GameState,
  plan: WeekPlan,
  ctx: GameContext = defaultContext,
): PlanPreview {
  assertWeekPlan(plan);
  const prog = ctx.config.progression;
  const mods = difficultyMods(state, ctx);
  const life =
    plan.life !== undefined && lifeAvailable(state, plan.life, ctx) ? plan.life : undefined;
  const lifeFresh = lifeFreshness(life, ctx);
  const weeks = chapterWeeksLeft(state, ctx);
  const clubId = state.player.clubId;
  const injuredWeeks = state.player.injury?.weeksLeft ?? 0;

  let sim: Player = state.player;
  let weekly: PlanPreview['weekly'] | undefined;
  const freshnessAtMatches: number[] = [];
  const history: { skills: Skills; gains: Partial<Skills> }[] = [];
  let survive = 1;
  let matchWeeks = 0;
  let freshnessSum = 0;

  for (let i = 0; i < weeks; i++) {
    const week = state.week + i;
    // L'infortunio in corso dura le sue settimane: poi il carico scelto torna valido.
    const { injury: _healed, ...healthy } = sim;
    const weekPlayer: Player = i < injuredWeeks ? sim : healthy;
    const eff: EffectiveLoad = effectiveLoad(weekPlayer, plan.load);
    const grown = loadWeekGrowth(weekPlayer, week, eff, plan.focus, mods.growth, ctx);
    const loadDelta = loadFreshness(eff, ctx);
    const f0 = weekPlayer.condition.energy;
    freshnessSum += f0;

    const played = eff === 'recovery' ? 0 : fixturesOf(state, clubId, week);
    for (let m = 0; m < played; m++) freshnessAtMatches.push(f0);
    if (played > 0) matchWeeks++;

    const sessionP = sessionInjuryChance(weekPlayer, eff, mods.injury, ctx);
    const matchP = matchInjuryChance(weekPlayer, 1, mods.injury, ctx);
    survive *= (1 - sessionP) * Math.pow(1 - matchP, played);

    const delta = loadDelta + lifeFresh - played * matchFreshnessCost(1, ctx);
    const f1 = endOfWeekFreshness(f0, delta, prog.loads[eff].freshnessCap);
    if (i === 0) {
      weekly = {
        freshnessDelta: loadDelta + lifeFresh,
        freshnessEnd: f1,
        capDrop: Math.max(0, f0 + delta - f1),
        gains: grown.gains,
        lifeEffects: lifeEffects(state.player, life, ctx),
      };
    }
    sim = {
      ...grown.player,
      condition: {
        ...grown.player.condition,
        energy: f1,
      },
    };
    history.push({ skills: sim.skills, gains: grown.gains });
  }

  const matches = freshnessAtMatches.length;
  const injuryChance = 1 - survive;
  const { medium, high } = prog.preview.riskBands;
  const eff0 = effectiveLoad(state.player, plan.load);
  const age = ageAt(state.player.birthWeek, state.week, ctx.config.calendar);
  const pace = paceOf(state.player, state.week, eff0, freshnessSum / weeks, ctx);
  const party = life === 'party' ? prog.life.party : undefined;
  const income = life === 'sponsor' ? sponsorWeekIncome(state.player, ctx) : 0;

  return {
    weekly: weekly!,
    chapter: {
      weeks,
      matches,
      freshnessAtMatches,
      momentsModifier:
        matches > 0
          ? freshnessAtMatches.reduce((s, f) => s + momentFreshnessModifier(f, ctx), 0) / matches
          : 0,
      injuryChance,
      riskBand: injuryChance >= high ? 'high' : injuryChance >= medium ? 'medium' : 'low',
      benchRisk: freshnessAtMatches.some((f) => f < ctx.config.match.selection.freshnessFrom)
        ? 'some'
        : 'none',
      ...nextPointOf(state.player.skills, history, plan.focus),
      pace: pace.pace,
      paceReason: pace.reason,
      ...(age >= prog.decline.startAge ? { declineFactor: prog.loads[eff0].decline } : {}),
      ...(party
        ? {
            gossipChance: atLeastOnce(party.gossipChance, weeks),
            fineChance: atLeastOnce(party.fineChance, matchWeeks),
          }
        : {}),
      ...(income > 0 ? { moneyTotal: income * weeks } : {}),
    },
  };
}

/** Partite ancora da giocare nella settimana per il club del giocatore. */
function fixturesOf(state: GameState, clubId: string | undefined, week: number): number {
  if (!clubId) return 0;
  return state.calendar.filter(
    (f) => f.week === week && !f.result && (f.homeId === clubId || f.awayId === clubId),
  ).length;
}

function lifeEffects(
  player: Player,
  life: WeekPlan['life'],
  ctx: GameContext,
): PlanPreview['weekly']['lifeEffects'] {
  const cfg = ctx.config.progression.life;
  if (life === 'sponsor') return { moneyPerWeek: sponsorWeekIncome(player, ctx) };
  if (life === 'party') {
    return { popularityPerWeek: cfg.party.popularity, disciplinePerWeek: cfg.party.discipline };
  }
  return {};
}

/**
 * Ritmo di crescita dal moltiplicatore effettivo (fattori × sedute del carico): fermo a zero, poi
 * soglie in config. Il motivo è il fattore che lo frena di più, ciascuno rapportato al suo massimo.
 */
function paceOf(
  player: Player,
  week: number,
  load: EffectiveLoad,
  avgFreshness: number,
  ctx: GameContext,
): { pace: PlanPreview['chapter']['pace']; reason: PlanPreview['chapter']['paceReason'] } {
  const prog = ctx.config.progression;
  const f = growthFactors(player, week, ctx);
  const m = f.age * f.gap * f.discipline * f.freshness * prog.loads[load].sessions;
  const maxAge = Math.max(...prog.growth.ageMultipliers.map((b) => b.value));
  const fresh = growthFreshnessFactor(avgFreshness, ctx);
  const ratios: [PlanPreview['chapter']['paceReason'], number][] = [
    ['age', f.age / maxAge],
    ['discipline', f.discipline / prog.growth.disciplineFactor.max],
    ['freshness', fresh],
  ];
  const reason = ratios.reduce((a, b) => (b[1] < a[1] ? b : a))[0];
  const { fast, slow } = prog.preview.pace;
  const pace = m <= 0 ? 'stopped' : m >= fast ? 'fast' : m < slow ? 'slow' : 'normal';
  return { pace, reason };
}

/** Settimane al prossimo +1 intero: dell'abilità in focus o della più vicina; oltre il capitolo si estrapola. */
function nextPointOf(
  start: Skills,
  history: { skills: Skills; gains: Partial<Skills> }[],
  focus: Skill | undefined,
): { nextPoint?: { skill: Skill; weeks: number } } {
  let best: { skill: Skill; weeks: number } | undefined;
  for (const skill of focus ? [focus] : SKILLS) {
    const step = history.findIndex((h) => Math.floor(h.skills[skill]) > Math.floor(start[skill]));
    let weeks: number | undefined;
    if (step >= 0) weeks = step + 1;
    else {
      const last = history[history.length - 1]!;
      const rate = last.gains[skill] ?? 0;
      if (rate > 0) {
        weeks =
          history.length +
          Math.ceil((Math.floor(last.skills[skill]) + 1 - last.skills[skill]) / rate);
      }
    }
    if (weeks !== undefined && (!best || weeks < best.weeks)) best = { skill, weeks };
  }
  return best ? { nextPoint: best } : {};
}
