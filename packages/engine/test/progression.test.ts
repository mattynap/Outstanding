import { flattenEffects } from '@outstanding/content';
import { describe, expect, it } from 'vitest';
import {
  advanceWeek,
  applyDecline,
  applyGrowth,
  computeOvr,
  defaultContext,
  deserialize,
  endSeason,
  getWeekOptions,
  isSeasonOver,
  newCareer,
  planWeek,
  playerFixture,
  playMatch,
  serialize,
  skipToNextMatch,
  type GameState,
  type Player,
} from '../src/index';
import { baseOptions } from './fixtures';

const ctx = defaultContext;
const start = () => newCareer(baseOptions, 77);
const ovr = (p: Player) => computeOvr(p.skills, p.role, ctx.config.ratings);

describe('testi e riferimenti', () => {
  it('ogni azione e ogni infortunio hanno un testo', () => {
    const t = ctx.content.i18n.it;
    for (const a of ctx.config.progression.actions) {
      expect(t[`week.actions.${a.id}.name`]).toBeDefined();
      expect(t[`week.actions.${a.id}.desc`]).toBeDefined();
    }
    for (const i of ctx.config.progression.injuries.types)
      expect(t[`injuries.${i.id}`]).toBeDefined();
  });

  it('gli infortuni citati dagli eventi esistono in config', () => {
    const known = new Set(ctx.config.progression.injuries.types.map((i) => i.id));
    for (const e of ctx.content.events) {
      for (const c of e.choices) {
        for (const eff of flattenEffects(c.effects)) {
          if (eff.type === 'injury') expect(known.has(eff.injuryType)).toBe(true);
        }
      }
    }
  });
});

describe('piano della settimana', () => {
  it("fa crescere le abilità del ruolo con l'allenamento", () => {
    const s = start();
    const { state, report } = planWeek(s, [{ actionId: 'train_normal' }, { actionId: 'rest' }]);
    expect(report.gains.shooting).toBeGreaterThan(0);
    expect(report.gains.goalkeeping).toBeUndefined();
    expect(state.player.skills.shooting).toBeGreaterThan(s.player.skills.shooting);
    expect(state.plannedWeek).toBe(s.week);
  });

  it("con l'allenamento mirato cresce solo l'abilità scelta, più in fretta", () => {
    const s = start();
    const normal = planWeek(s, [{ actionId: 'train_normal' }]).report.gains;
    const focus = planWeek(s, [{ actionId: 'train_focus', focus: 'pace' }]).report.gains;
    expect(Object.keys(focus)).toEqual(['pace']);
    expect(focus.pace!).toBeGreaterThan(normal.pace!);
  });

  it('applica gli effetti su energia e umore', () => {
    const s = start();
    const rest = planWeek(s, [{ actionId: 'rest' }]).state;
    expect(rest.player.condition.energy).toBeGreaterThanOrEqual(s.player.condition.energy);
    const fun = planWeek(s, [{ actionId: 'leisure' }]).state;
    expect(fun.player.persona.happiness).toBeGreaterThan(s.player.persona.happiness);
  });

  it('rifiuta piani non validi', () => {
    const s = start();
    expect(() => planWeek(s, [{ actionId: 'rest' }, { actionId: 'rest' }])).toThrow();
    expect(() =>
      planWeek(s, [{ actionId: 'rest' }, { actionId: 'family' }, { actionId: 'leisure' }]),
    ).toThrow();
    expect(() => planWeek(s, [{ actionId: 'train_focus' }])).toThrow(/focus/);
    expect(() => planWeek(s, [{ actionId: 'rest', focus: 'pace' }])).toThrow(/focus/);
    expect(() => planWeek(s, [{ actionId: 'inventata' }])).toThrow();
    const done = planWeek(s, []).state;
    expect(() => planWeek(done, [])).toThrow(/already/);
  });

  it('da infortunati niente allenamento, ma le cure possono accorciare lo stop', () => {
    const s = start();
    const hurt: GameState = {
      ...s,
      player: { ...s.player, injury: { type: 'stiramento', weeksLeft: 4 } },
    };
    const training = getWeekOptions(hurt).filter((o) => o.kind === 'training');
    expect(training.every((o) => !o.available && o.reasonKey === 'week.blocked.injured')).toBe(
      true,
    );
    expect(() => planWeek(hurt, [{ actionId: 'train_normal' }])).toThrow();
    let healed = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const h = { ...hurt, rngState: newCareer(baseOptions, seed).rngState };
      if (planWeek(h, [{ actionId: 'physio' }]).report.healed) healed++;
    }
    expect(healed).toBeGreaterThan(0);
    expect(healed).toBeLessThan(20);
  });

  it('è deterministico e sopravvive al salvataggio', () => {
    const s = deserialize(serialize(start()));
    const plan = [{ actionId: 'train_intense' }, { actionId: 'train_normal' }];
    expect(planWeek(s, plan)).toEqual(planWeek(start(), plan));
  });
});

describe('condizione e partite', () => {
  it('la partita consuma energia e muove forma e fiducia', () => {
    let s = start();
    while (!playerFixture(s)) s = advanceWeek(s).state;
    const before = s.player;
    const { state, matchReport } = playMatch(s, () => 0);
    if (matchReport.minutesPlayed > 0) {
      expect(state.player.condition.energy).toBeLessThan(before.condition.energy);
    }
    if (matchReport.rating !== null && matchReport.rating !== ctx.config.match.rating.base) {
      expect(state.player.condition.form).not.toBe(before.condition.form);
    }
  });

  it("a fine settimana l'energia si recupera e l'infortunio cala", () => {
    const s = start();
    const tired: GameState = {
      ...s,
      player: {
        ...s.player,
        condition: { ...s.player.condition, energy: 20 },
        injury: { type: 'contusione', weeksLeft: 2 },
      },
    };
    const next = advanceWeek(tired).state;
    expect(next.player.condition.energy).toBeGreaterThan(20);
    expect(next.player.injury?.weeksLeft).toBe(1);
  });
});

describe('crescita e declino', () => {
  it('rallenta vicino al potenziale e si ferma oltre', () => {
    const s = start();
    const p = s.player;
    const near: Player = { ...p, potential: ovr(p) + 1 };
    const far: Player = { ...p, potential: ovr(p) + 30 };
    const gNear = applyGrowth(near, 1, s.week, ctx).gains.shooting ?? 0;
    const gFar = applyGrowth(far, 1, s.week, ctx).gains.shooting ?? 0;
    expect(gFar).toBeGreaterThan(gNear);
    const capped: Player = { ...p, potential: ovr(p) - 1 };
    expect(applyGrowth(capped, 1, s.week, ctx).gains).toEqual({});
  });

  it('i giovani crescono più dei trentenni', () => {
    const s = start();
    const old: Player = { ...s.player, birthWeek: s.player.birthWeek - 14 * 52 };
    const young = applyGrowth(s.player, 1, s.week, ctx).gains.shooting ?? 0;
    const veteran = applyGrowth(old, 1, s.week, ctx).gains.shooting ?? 0;
    expect(young).toBeGreaterThan(veteran);
  });

  it('dopo i 31 anni le abilità calano, meno con tanta disciplina', () => {
    const p = start().player;
    expect(applyDecline(p, 25, ctx)).toBe(p);
    const lazy: Player = { ...p, persona: { ...p.persona, discipline: 0 } };
    const pro: Player = { ...p, persona: { ...p.persona, discipline: 100 } };
    const dLazy = p.skills.pace - applyDecline(lazy, 34, ctx).skills.pace;
    const dPro = p.skills.pace - applyDecline(pro, 34, ctx).skills.pace;
    expect(dLazy).toBeGreaterThan(dPro);
    expect(dPro).toBeGreaterThan(0);
  });

  it("una stagione di allenamento fa salire l'OVR di un sedicenne", () => {
    let s = start();
    const before = ovr(s.player);
    while (!isSeasonOver(s)) {
      if (s.plannedWeek !== s.week) {
        const ok = getWeekOptions(s).find((o) => o.id === 'train_normal')!.available;
        s = planWeek(
          s,
          ok ? [{ actionId: 'train_normal' }, { actionId: 'rest' }] : [{ actionId: 'rest' }],
        ).state;
      }
      if (playerFixture(s)) s = playMatch(s, () => 0).state;
      s = advanceWeek(s).state;
    }
    expect(ovr(s.player)).toBeGreaterThan(before + 2);
    expect(() => endSeason(s)).not.toThrow();
  });
});

describe('settimane senza partite', () => {
  it('si saltano fino alla prossima partita con il piano automatico', () => {
    const s = start();
    expect(playerFixture(s)).toBeUndefined();
    const { state, weeksSkipped } = skipToNextMatch(s);
    expect(weeksSkipped).toBeGreaterThan(0);
    expect(playerFixture(state)).toBeDefined();
    expect(state.week).toBe(s.week + weeksSkipped);
    expect(state.player.skills.shooting).toBeGreaterThan(s.player.skills.shooting);
    expect(skipToNextMatch(state).weeksSkipped).toBe(0);
  });
});
