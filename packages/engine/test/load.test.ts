import { describe, expect, it } from 'vitest';
import { defaultContext as ctx, newCareer, Rng, type Player } from '../src/index';
import {
  applyLoadWeek,
  closeWeekFreshness,
  effectiveLoad,
  formWhenNotPlaying,
} from '../src/season/load';
import { baseOptions } from './fixtures';

const week = 27 * ctx.config.calendar.weeksPerSeason;
const seed = newCareer(baseOptions, 77).player;
const base = (energy: number, over: Partial<Player> = {}): Player => {
  return { ...seed, condition: { ...seed.condition, energy }, ...over };
};
const injured = (energy: number): Player =>
  base(energy, { injury: { type: 'muscle', weeksLeft: 3 } });
const sum = (g: Partial<Record<string, number>>) =>
  Object.values(g).reduce<number>((a, b) => a + (b ?? 0), 0);
const loads = ctx.config.progression.loads;

describe('carico settimanale', () => {
  it('stesso stato e seme: stesso risultato', () => {
    const a = applyLoadWeek(base(80), week, 'push', undefined, Rng.fromSeed(5), ctx);
    const b = applyLoadWeek(base(80), week, 'push', undefined, Rng.fromSeed(5), ctx);
    expect(a.player).toEqual(b.player);
    expect(a.gains).toEqual(b.gains);
    expect(a.rng.getState()).toEqual(b.rng.getState());
  });

  it('non tocca la freschezza e restituisce il delta del carico', () => {
    const r = applyLoadWeek(base(80), week, 'balanced', undefined, Rng.fromSeed(1), ctx);
    expect(r.player.condition.energy).toBe(80);
    expect(r.freshnessDelta).toBe(loads.balanced.freshness);
  });

  it('Equilibrio con F0 100 e partita da 90 minuti: tetto 90; con F0 60: 60', () => {
    const delta = loads.balanced.freshness - ctx.config.progression.condition.freshnessPer90;
    expect(closeWeekFreshness(base(100), delta, 'balanced', ctx).condition.energy).toBe(90);
    expect(closeWeekFreshness(base(60), delta, 'balanced', ctx).condition.energy).toBe(60);
  });

  it('Spinta da 95 senza partita: 70', () => {
    const p = closeWeekFreshness(base(95), loads.push.freshness, 'push', ctx);
    expect(p.condition.energy).toBe(70);
  });

  it('infortunato con Spinta: Recupero, nessun guadagno, guarigione possibile', () => {
    expect(effectiveLoad(injured(80), 'push')).toBe('recovery');
    expect(effectiveLoad(base(80), 'push')).toBe('push');
    let healed = 0;
    for (let s = 0; s < 40; s++) {
      const r = applyLoadWeek(injured(80), week, 'push', undefined, Rng.fromSeed(s), ctx);
      expect(sum(r.gains)).toBe(0);
      expect(r.injury).toBeUndefined();
      expect(r.freshnessDelta).toBe(loads.recovery.freshness);
      if (r.healed) healed++;
    }
    expect(healed).toBeGreaterThan(0);
    expect(healed).toBeLessThan(40);
  });

  it('guarigione: ultima settimana toglie l infortunio', () => {
    const p = base(80, { injury: { type: 'muscle', weeksLeft: 1 } });
    for (let s = 0; s < 40; s++) {
      const r = applyLoadWeek(p, week, 'rest', undefined, Rng.fromSeed(s), ctx);
      if (r.healed) {
        expect(r.player.injury).toBeUndefined();
        return;
      }
    }
    throw new Error('mai guarito');
  });

  it('Scarico: sessionInjury 0, zero infortuni in 10000 settimane', () => {
    const rng = Rng.fromSeed(99);
    const p = base(10);
    let n = 0;
    for (let i = 0; i < 10000; i++) {
      if (applyLoadWeek(p, week, 'rest', undefined, rng, ctx).injury) n++;
    }
    expect(n).toBe(0);
  });

  it('Spinta stanca si infortuna più di Spinta fresca', () => {
    const count = (f: number) => {
      const rng = Rng.fromSeed(3);
      let n = 0;
      for (let i = 0; i < 20000; i++) {
        if (applyLoadWeek(base(f), week, 'push', undefined, rng, ctx).injury) n++;
      }
      return n;
    };
    expect(count(0)).toBeGreaterThan(count(100));
  });

  it('panchina 4 settimane: forma +1 Spinta, -2 Scarico, 0 Equilibrio', () => {
    for (const [load, per] of [
      ['push', 1],
      ['rest', -2],
      ['balanced', 0],
    ] as const) {
      let form = 50;
      for (let i = 0; i < 4; i++) form += formWhenNotPlaying(load, ctx);
      expect(form).toBe(50 + 4 * per);
    }
    expect(formWhenNotPlaying('recovery', ctx)).toBe(loads.recovery.formNotPlaying);
  });
});
