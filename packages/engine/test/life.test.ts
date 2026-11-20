import type { GameEvent } from '@outstanding/content';
import { describe, expect, it } from 'vitest';
import {
  defaultContext as ctx,
  drawWeekEvents,
  newCareer,
  resolveEvent,
  Rng,
  type GameContext,
  type GameState,
  type Partner,
  type Player,
} from '../src/index';
import { applyMatchAftermath, weeklyRecovery } from '../src/player/condition';
import { applyWeeklyPrivate } from '../src/private/private';
import { applyLifeWeek, driftDiscipline, lifeModifiers } from '../src/season/life';
import { baseOptions } from './fixtures';

const start = () => newCareer(baseOptions, 321);
const withMorale = (p: Player, morale: number): Player => ({
  ...p,
  condition: { ...p.condition, morale },
});
const partner = (affinity: number): Partner => ({
  firstName: 'Giulia',
  lastName: 'Rinaldi',
  gender: 'f',
  job: 'architect',
  skin: 0,
  hairColor: 0,
  hair: 'long',
  stage: 'dating',
  sinceWeek: -100,
  stageWeek: -100,
  affinity,
});
const lossOutcome = {
  selection: 'starter',
  minutesPlayed: 90,
  rating: ctx.config.match.rating.base,
  result: 'loss',
} as const;

describe('modificatori della vita', () => {
  it('default neutro e valori da config', () => {
    expect(lifeModifiers(undefined, ctx)).toEqual({
      moraleLossFactor: 1,
      moraleRecoveryFactor: 1,
      affinityDriftFactor: 1,
    });
    expect(lifeModifiers('family', ctx)).toEqual({
      moraleLossFactor: 0.5,
      moraleRecoveryFactor: 1,
      affinityDriftFactor: 0,
    });
    expect(lifeModifiers('leisure', ctx).moraleRecoveryFactor).toBe(2);
    expect(lifeModifiers('party', ctx)).toEqual(lifeModifiers(undefined, ctx));
  });

  it('Famiglia: i cali di morale si dimezzano, i rialzi no', () => {
    const p = withMorale(start().player, 50);
    const neutral = applyMatchAftermath(p, undefined, lossOutcome, 0, Rng.fromSeed(1), ctx);
    const family = applyMatchAftermath(
      p,
      undefined,
      lossOutcome,
      0,
      Rng.fromSeed(1),
      ctx,
      undefined,
      lifeModifiers('family', ctx),
    );
    const base = applyMatchAftermath(p, undefined, lossOutcome, 0, Rng.fromSeed(1), ctx);
    expect(neutral.player.condition.morale).toBe(base.player.condition.morale);
    const lossN = 50 - neutral.player.condition.morale;
    const lossF = 50 - family.player.condition.morale;
    expect(lossN).toBeGreaterThan(0);
    expect(lossF).toBeCloseTo(lossN / 2, 9);

    const win = { ...lossOutcome, result: 'win' } as const;
    const winN = applyMatchAftermath(p, undefined, win, 0, Rng.fromSeed(1), ctx);
    const winF = applyMatchAftermath(
      p,
      undefined,
      win,
      0,
      Rng.fromSeed(1),
      ctx,
      undefined,
      lifeModifiers('family', ctx),
    );
    expect(winF.player.condition.morale).toBe(winN.player.condition.morale);
  });

  it('Famiglia: affinità col partner invariata dopo 14 settimane, senza famiglia cala', () => {
    const s0: GameState = {
      ...start(),
      privateLife: { ...start().privateLife!, partner: partner(70) },
    };
    let fam = s0;
    let none = s0;
    const mods = lifeModifiers('family', ctx);
    for (let i = 0; i < 14; i++) {
      fam = applyWeeklyPrivate(fam, Rng.fromSeed(i), ctx, mods).state;
      none = applyWeeklyPrivate(none, Rng.fromSeed(i), ctx).state;
    }
    expect(fam.privateLife!.partner!.affinity).toBe(70);
    expect(none.privateLife!.partner!.affinity).toBeLessThan(70);
  });

  it('Famiglia senza partner: nessun errore', () => {
    const s = start();
    expect(s.privateLife?.partner).toBeUndefined();
    const mods = lifeModifiers('family', ctx);
    expect(() => applyWeeklyPrivate(s, Rng.fromSeed(1), ctx, mods)).not.toThrow();
    const r = applyLifeWeek(s, 'family', false, Rng.fromSeed(1), ctx);
    expect(r.freshnessDelta).toBe(0);
  });

  it('Svago: morale 40, riferimento 60, dopo una settimana 44 contro 42', () => {
    const p = withMorale(start().player, 40);
    expect(weeklyRecovery(p, ctx).condition.morale).toBeCloseTo(42, 9);
    expect(weeklyRecovery(p, ctx, lifeModifiers('leisure', ctx)).condition.morale).toBeCloseTo(
      44,
      9,
    );
    // Sopra il riferimento lo svago non fa scendere più in fretta.
    const high = withMorale(start().player, 80);
    expect(weeklyRecovery(high, ctx, lifeModifiers('leisure', ctx)).condition.morale).toBeCloseTo(
      weeklyRecovery(high, ctx).condition.morale,
      9,
    );
  });
});

describe('azioni della settimana', () => {
  it('Sponsor senza contratti: niente soldi e nessun errore', () => {
    const s = start();
    expect(s.player.sponsors).toHaveLength(0);
    const r = applyLifeWeek(s, 'sponsor', false, Rng.fromSeed(1), ctx);
    expect(r.sponsorIncome ?? 0).toBe(0);
    expect(r.state.player.money.cash).toBe(s.player.money.cash);
    expect(r.freshnessDelta).toBe(ctx.config.progression.life.sponsor.freshness);
  });

  it('Sponsor con contratti: metà della somma degli ingaggi', () => {
    const s = start();
    const deal = (weeklyIncome: number) => ({ weeklyIncome });
    const st: GameState = {
      ...s,
      player: { ...s.player, sponsors: [deal(1000), deal(500)] as never },
    };
    const r = applyLifeWeek(st, 'sponsor', false, Rng.fromSeed(1), ctx);
    expect(r.sponsorIncome).toBe(750);
    expect(r.state.player.money.cash).toBe(s.player.money.cash + 750);
  });

  it('senza azione, Famiglia e Svago: nessun effetto diretto e generatore intatto', () => {
    const s = start();
    for (const a of [undefined, 'family', 'leisure'] as const) {
      const rng = Rng.fromSeed(3);
      const r = applyLifeWeek(s, a, true, rng, ctx);
      expect(r.state).toBe(s);
      expect(r.freshnessDelta).toBe(0);
      expect(r.rng.getState()).toEqual(Rng.fromSeed(3).getState());
    }
  });

  it('Serata: popolarità +0,5 e disciplina -1 a settimana, il partner cala di 2', () => {
    const s0 = start();
    const s: GameState = {
      ...s0,
      privateLife: { ...s0.privateLife!, partner: partner(70) },
    };
    // Scelgo un seme senza giornali: così si vedono solo i costi fissi.
    let r = applyLifeWeek(s, 'party', false, Rng.fromSeed(1), ctx);
    for (let seed = 2; r.party?.gossip; seed++) {
      r = applyLifeWeek(s, 'party', false, Rng.fromSeed(seed), ctx);
    }
    expect(r.state.player.image.popularity).toBeCloseTo(s.player.image.popularity + 0.5, 9);
    expect(r.state.player.persona.discipline).toBeCloseTo(s.player.persona.discipline - 1, 9);
    expect(r.state.privateLife!.partner!.affinity).toBe(70 - 2);
    expect(r.party!.fine).toBe(0);
  });

  it('Serata: giornali con frequenza ~0,05 e disciplina a base - 20', () => {
    let s = start();
    s = { ...s, player: { ...s.player, persona: { ...s.player.persona, discipline: 60 } } };
    const base = 60;
    expect(s.player.persona.disciplineBase ?? s.player.persona.discipline).toBe(base);
    const rng = Rng.fromSeed(2024);
    let gossip = 0;
    let p = s.player;
    const weeks = 200;
    for (let i = 0; i < weeks; i++) {
      const r = applyLifeWeek({ ...s, player: p }, 'party', false, rng, ctx);
      if (r.party!.gossip) gossip++;
      p = driftDiscipline(r.state.player, ctx);
    }
    // Binomiale(200; 0,05): media 10, sigma ~3,1; con seme fisso accetto 4 sigma (da 1 a 22).
    expect(gossip / weeks).toBeGreaterThan(0.005);
    expect(gossip / weeks).toBeLessThan(0.11);
    // Punto fisso: d = (d - 1) + 0,05 (base - d + 1) -> d = base - 19; 200 settimane bastano a
    // convergere. Il "base - 20 ± 1" del brief include -19; lo stato visibile a fine settimana.
    expect(p.persona.discipline).toBeGreaterThan(base - 21);
    expect(p.persona.discipline).toBeLessThan(base - 18.9);
  });

  it('Serata: multa solo nelle settimane con partita', () => {
    const s = start();
    let fines = 0;
    let finesNoMatch = 0;
    for (let seed = 0; seed < 300; seed++) {
      if (applyLifeWeek(s, 'party', true, Rng.fromSeed(seed), ctx).party!.fine > 0) fines++;
      if (applyLifeWeek(s, 'party', false, Rng.fromSeed(seed), ctx).party!.fine > 0) finesNoMatch++;
    }
    expect(finesNoMatch).toBe(0);
    // Atteso 30 su 300 (p 0,1): finestra larga, seme per seme deterministica.
    expect(fines).toBeGreaterThan(10);
    expect(fines).toBeLessThan(60);
  });
});

describe('disciplina', () => {
  const withDiscipline = (p: Player, d: number, base?: number): Player => ({
    ...p,
    persona: {
      ...p.persona,
      discipline: d,
      ...(base !== undefined ? { disciplineBase: base } : {}),
    },
  });

  it('torna verso la base del 5% della distanza', () => {
    const p = withDiscipline(start().player, 40, 60);
    expect(driftDiscipline(p, ctx).persona.discipline).toBeCloseTo(41, 9);
  });

  it('senza base ferma al valore corrente', () => {
    const p = withDiscipline(start().player, 40);
    expect(driftDiscipline(p, ctx).persona.discipline).toBe(40);
  });

  it('un evento con disciplina -5 sposta valore e base', () => {
    const e: GameEvent = {
      id: 'ammonizione',
      category: 'life',
      weight: 1,
      cooldownWeeks: 0,
      titleKey: 'x.title',
      textKey: 'x.text',
      choices: [
        { textKey: 'x.c1', effects: [{ type: 'stat', path: 'persona.discipline', delta: -5 }] },
      ],
    };
    const c: GameContext = {
      config: { ...ctx.config, events: { ...ctx.config.events, perWeekWeights: [0, 1] } },
      content: { ...ctx.content, events: [e] },
    };
    const s0 = start();
    const s = { ...s0, player: withDiscipline(s0.player, 50, 60) };
    const drawn = drawWeekEvents(s, c).state;
    const after = resolveEvent(drawn, 'ammonizione', 0, c).state.player.persona;
    expect(after.discipline).toBe(45);
    expect(after.disciplineBase).toBe(55);
    // Senza base esplicita, la base parte dal valore corrente.
    const s2 = { ...s0, player: withDiscipline(s0.player, 50) };
    const after2 = resolveEvent(drawWeekEvents(s2, c).state, 'ammonizione', 0, c).state.player
      .persona;
    expect(after2.discipline).toBe(45);
    expect(after2.disciplineBase).toBe(45);
  });
});
