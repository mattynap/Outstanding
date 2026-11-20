import { describe, expect, it } from 'vitest';
import {
  advanceWeek,
  defaultContext as ctx,
  newCareer,
  planWeek,
  playerFixture,
  previewPlan,
  simulateMatch,
  type GameState,
  type WeekPlan,
} from '../src/index';
import { endOfWeekFreshness } from '../src/player/freshness';
import { baseOptions } from './fixtures';

const loads = ctx.config.progression.loads;
const cal = ctx.config.calendar;
const autumn = cal.chapters[1]!.fromWeek;

/** Avanza (simulando le partite) fino alla settimana assoluta indicata. */
function toWeek(state: GameState, week: number): GameState {
  let s = state;
  while (s.week < week) {
    while (playerFixture(s)) s = simulateMatch(s, ctx).state;
    s = advanceWeek(s, ctx).state;
  }
  return s;
}

function toMatchWeek(state: GameState): GameState {
  let s = state;
  while (!playerFixture(s)) s = advanceWeek(s, ctx).state;
  return s;
}

function toQuietWeek(state: GameState): GameState {
  let s = state;
  while (playerFixture(s)) {
    while (playerFixture(s)) s = simulateMatch(s, ctx).state;
    s = advanceWeek(s, ctx).state;
  }
  return s;
}

const withEnergy = (s: GameState, energy: number): GameState => ({
  ...s,
  player: { ...s.player, condition: { ...s.player.condition, energy } },
});

describe('anteprima del piano', () => {
  it('settimana senza partita: crescita e freschezza uguali a planWeek, su 3 seed', () => {
    const plans: WeekPlan[] = [
      { load: 'push', focus: 'shooting', life: 'party' },
      { load: 'balanced' },
      { load: 'rest', focus: 'pace', life: 'leisure' },
    ];
    for (const seed of [3, 11, 42]) {
      const s = toQuietWeek(toWeek(newCareer(baseOptions, seed), 8));
      for (const plan of plans) {
        const pre = previewPlan(s, plan, ctx);
        const real = planWeek(s, plan, ctx);
        expect(pre.weekly.gains).toEqual(real.report.gains);
        expect(pre.weekly.freshnessDelta).toBe(real.state.weekInProgress!.freshnessDelta);
        if (plan.life === 'party') {
          expect(pre.weekly.lifeEffects.popularityPerWeek).toBe(
            ctx.config.progression.life.party.popularity,
          );
        }
      }
    }
  });

  it('sponsor: soldi della settimana uguali a quelli accreditati da planWeek', () => {
    const s0 = toQuietWeek(newCareer(baseOptions, 5));
    const s: GameState = {
      ...s0,
      player: {
        ...s0.player,
        sponsors: [{ weeklyIncome: 1000 }, { weeklyIncome: 501 }] as never,
      },
    };
    const pre = previewPlan(s, { load: 'balanced', life: 'sponsor' }, ctx);
    const real = planWeek(s, { load: 'balanced', life: 'sponsor' }, ctx);
    expect(pre.weekly.lifeEffects.moneyPerWeek).toBe(real.report.sponsorIncome);
    expect(pre.weekly.freshnessDelta).toBe(real.state.weekInProgress!.freshnessDelta);
    expect(pre.chapter.moneyTotal).toBe(real.report.sponsorIncome! * pre.chapter.weeks);
  });

  it('settimana con partita da 90 minuti: freschezza di fine settimana = anteprima', () => {
    let checked = 0;
    for (let seed = 1; seed <= 25 && checked < 3; seed++) {
      const s = withEnergy(toMatchWeek(newCareer(baseOptions, seed)), 80);
      const plan: WeekPlan = { load: 'balanced' };
      const pre = previewPlan(s, plan, ctx);
      const planned = planWeek(s, plan, ctx).state;
      const played = simulateMatch(planned, ctx);
      if (played.matchReport.minutesPlayed !== 90) continue;
      checked++;
      const f0 = s.player.condition.energy;
      expect(pre.chapter.freshnessAtMatches[0]).toBe(f0);
      const previewEnd = endOfWeekFreshness(
        f0,
        pre.weekly.freshnessDelta - ctx.config.progression.condition.freshnessPer90,
        loads.balanced.freshnessCap,
      );
      expect(advanceWeek(played.state, ctx).state.player.condition.energy).toBeCloseTo(
        previewEnd,
        9,
      );
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('Spinta da 95 (settimana senza partita): freschezza alle partite al tetto 70', () => {
    const s = withEnergy(toQuietWeek(toWeek(newCareer(baseOptions, 7), autumn)), 95);
    const pre = previewPlan(s, { load: 'push' }, ctx);
    expect(pre.chapter.matches).toBeGreaterThan(0);
    for (const f of pre.chapter.freshnessAtMatches) expect(f).toBeLessThanOrEqual(70);
    expect(loads.push.freshnessCap).toBe(70);
  });

  it('Spinta da 95 con partita questa settimana: legge F0 95 e dichiara il calo al tetto', () => {
    const s = withEnergy(toMatchWeek(toWeek(newCareer(baseOptions, 7), autumn)), 95);
    const pre = previewPlan(s, { load: 'push' }, ctx);
    expect(pre.chapter.freshnessAtMatches[0]).toBe(95);
    expect(pre.weekly.freshnessEnd).toBeLessThanOrEqual(loads.push.freshnessCap);
    expect(pre.weekly.capDrop).toBeGreaterThan(0);
    expect(pre.weekly.freshnessEnd).toBe(
      endOfWeekFreshness(
        95,
        pre.weekly.freshnessDelta - ctx.config.progression.condition.freshnessPer90,
        loads.push.freshnessCap,
      ),
    );
  });

  it('Serata in 14 settimane: giornali = 1 - 0,95^14', () => {
    const start = toWeek(newCareer(baseOptions, 9), autumn);
    const pre = previewPlan(start, { load: 'balanced', life: 'party' }, ctx);
    expect(pre.chapter.weeks).toBe(14);
    expect(ctx.config.progression.life.party.gossipChance).toBe(0.05);
    expect(pre.chapter.gossipChance).toBeCloseTo(1 - Math.pow(0.95, 14), 12);
    expect(pre.chapter.fineChance).toBeGreaterThan(0);
    expect(pre.chapter.fineChance).toBeLessThan(1);
  });

  it('over 31 con Spinta: declino x0,7 e crescita ferma', () => {
    const s0 = newCareer(baseOptions, 2);
    const s: GameState = {
      ...s0,
      player: { ...s0.player, birthWeek: s0.week - 32 * cal.weeksPerSeason },
    };
    const pre = previewPlan(s, { load: 'push' }, ctx);
    expect(pre.chapter.declineFactor).toBe(loads.push.decline);
    expect(pre.chapter.declineFactor).toBe(0.7);
    expect(pre.chapter.pace).toBe('stopped');
    expect(pre.chapter.paceReason).toBe('age');
    expect(previewPlan(s0, { load: 'push' }, ctx).chapter.declineFactor).toBeUndefined();
  });

  it('infortunato: carico forzato a Recupero, nessuna crescita in settimana', () => {
    const s0 = newCareer(baseOptions, 4);
    const s: GameState = {
      ...s0,
      player: { ...s0.player, injury: { type: 'muscle', weeksLeft: 2 } },
    };
    const pre = previewPlan(s, { load: 'push' }, ctx);
    expect(pre.weekly.freshnessDelta).toBe(loads.recovery.freshness);
    expect(pre.weekly.gains).toEqual({});
  });

  it('fasce di rischio dalle soglie di config e rischio panchina', () => {
    const s = withEnergy(toWeek(newCareer(baseOptions, 6), autumn), 20);
    const pre = previewPlan(s, { load: 'push' }, ctx);
    const { medium, high } = ctx.config.progression.preview.riskBands;
    const p = pre.chapter.injuryChance;
    expect(pre.chapter.riskBand).toBe(p >= high ? 'high' : p >= medium ? 'medium' : 'low');
    expect(pre.chapter.benchRisk).toBe('some');
  });

  it('non modifica lo stato, non consuma il generatore, non mostra il potenziale', () => {
    const s = newCareer(baseOptions, 8);
    const before = JSON.stringify(s);
    const rng = [...s.rngState];
    const pre = previewPlan(s, { load: 'push', focus: 'pace', life: 'party' }, ctx);
    expect(JSON.stringify(s)).toBe(before);
    expect(s.rngState).toEqual(rng);
    expect(JSON.stringify(pre)).not.toMatch(/potential/i);
  });
});
