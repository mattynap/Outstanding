import { describe, expect, it } from 'vitest';
import {
  defaultContext,
  newCareer,
  previewPlan,
  type GameState,
  type PlanPreview,
  type WeekPlan,
} from '@outstanding/engine';
import {
  chanceWords,
  disciplineView,
  planIssuesView,
  planSheetView,
} from '../src/app/core/plan-sheet-view';
import { shownStatDelta } from '../src/app/core/text';

const ctx = defaultContext;
const start = newCareer(
  { firstName: 'Tommaso', lastName: 'Ferraro', hometown: 'Bergamo', role: 'ATT' },
  11,
  ctx,
);

/** Anteprima vera del motore, con i campi del capitolo sostituiti dove serve uno scenario preciso. */
function preview(
  s: GameState,
  plan: WeekPlan,
  chapter: Partial<PlanPreview['chapter']> = {},
): PlanPreview {
  const p = previewPlan(s, plan, ctx);
  return { ...p, chapter: { ...p.chapter, ...chapter } };
}

function sheet(s: GameState, plan: WeekPlan, chapter: Partial<PlanPreview['chapter']> = {}) {
  return planSheetView(preview(s, plan, chapter), plan, s, ctx);
}

describe('scheda del piano', () => {
  it('rischio "basso" sotto la soglia media, poi medio e alto', () => {
    const { medium, high } = ctx.config.progression.preview.riskBands;
    const plan: WeekPlan = { load: 'balanced' };
    const low = sheet(start, plan, { injuryChance: medium - 0.01, riskBand: 'low' });
    expect(low.risk.key).toBe('ui.plan.risk.low');
    expect(low.risk.pct).toBe(Math.round((medium - 0.01) * 100));
    expect(sheet(start, plan, { injuryChance: medium, riskBand: 'medium' }).risk.key).toBe(
      'ui.plan.risk.medium',
    );
    expect(sheet(start, plan, { injuryChance: high, riskBand: 'high' }).risk.key).toBe(
      'ui.plan.risk.high',
    );
  });

  it('la barra della freschezza ha la tacca al tetto del carico', () => {
    const caps = ctx.config.progression.loads;
    expect(sheet(start, { load: 'push' }).freshness.cap).toBe(caps.push.freshnessCap);
    expect(sheet(start, { load: 'balanced' }).freshness.cap).toBe(caps.balanced.freshnessCap);
    expect(sheet(start, { load: 'rest' }).freshness.cap).toBe(caps.rest.freshnessCap);
    // Partendo da 85, la Spinta scende al tetto: il calo si dichiara.
    const push = sheet(start, { load: 'push' });
    expect(push.freshness.now).toBe(85);
    expect(push.freshness.capFall).toBe(85 - caps.push.freshnessCap);
    expect(push.freshness.value).toBeLessThanOrEqual(caps.push.freshnessCap);
  });

  it('al tetto senza calo dichiara il recupero sprecato, non una perdita', () => {
    const cap = ctx.config.progression.loads.balanced.freshnessCap;
    const atCap: GameState = {
      ...start,
      player: { ...start.player, condition: { ...start.player.condition, energy: cap } },
    };
    const v = sheet(atCap, { load: 'balanced' });
    expect(v.freshness.capFall).toBe(0);
    expect(v.freshness.capWaste).toBe(ctx.config.progression.loads.balanced.freshness);
  });

  it('ogni carico dichiara freschezza a settimana e tetto, letti dalla configurazione', () => {
    const v = sheet(start, { load: 'balanced' });
    const push = v.loads.find((l) => l.id === 'push')!;
    expect(push.hintParams).toEqual({
      delta: `+${ctx.config.progression.loads.push.freshness}`,
      cap: ctx.config.progression.loads.push.freshnessCap,
    });
    expect(v.loads.find((l) => l.id === 'balanced')!.selected).toBe(true);
  });

  it('Serata: probabilità di giornali del capitolo arrotondata ("circa 1 su 2")', () => {
    const plan: WeekPlan = { load: 'balanced', life: 'party' };
    const p = 1 - Math.pow(1 - 0.05, 14);
    const v = sheet(start, plan, { weeks: 14, gossipChance: p, fineChance: 0, matches: 0 });
    const gossip = v.lifeLines.find((l) => l.key === 'ui.plan.life.gossip')!;
    expect(gossip.params).toMatchObject({ chance: 'circa 1 su 2', weeks: 14 });
    // Senza partite niente multa da dichiarare.
    expect(v.lifeLines.some((l) => l.key === 'ui.plan.life.fine')).toBe(false);
    const withMatches = sheet(start, plan, {
      weeks: 14,
      gossipChance: p,
      fineChance: 0.47,
      matches: 6,
    });
    expect(withMatches.lifeLines.find((l) => l.key === 'ui.plan.life.fine')!.params).toMatchObject({
      chance: 'circa 1 su 2',
    });
  });

  it('infortunato: carico mostrato "Recupero" e chip del carico bloccati', () => {
    const hurt: GameState = {
      ...start,
      player: { ...start.player, injury: { type: 'hamstring', weeksLeft: 3 } },
    };
    const v = sheet(hurt, { load: 'push' });
    expect(v.forced).toBe(true);
    expect(v.loadShownKey).toBe('week.load.recovery.name');
    expect(v.loads.every((l) => l.disabled)).toBe(true);
    expect(v.loads.some((l) => l.selected)).toBe(false);
    expect(v.freshness.cap).toBe(ctx.config.progression.loads.recovery.freshnessCap);
  });

  it('sponsor non disponibile: chip disattivato con il motivo, il piano non si conferma', () => {
    const v = sheet(start, { load: 'balanced' });
    const sponsor = v.life.find((l) => l.id === 'sponsor')!;
    expect(sponsor.disabled).toBe(true);
    expect(sponsor.reasonKey).toBe('week.blocked.no_sponsor');
    expect(v.canConfirm).toBe(true);
    expect(sheet(start, { load: 'balanced', life: 'sponsor' }).canConfirm).toBe(false);
    // "Nessuna" è in fondo, sempre disponibile.
    expect(v.life.at(-1)).toMatchObject({ id: 'none', disabled: false, selected: true });
  });

  it("l'azione ricordata non più disponibile si segnala e resta fuori dal piano", () => {
    const s: GameState = {
      ...start,
      chapterPlan: null,
      lastPlan: { load: 'push', life: 'sponsor' },
    };
    const v = sheet(s, { load: 'push' });
    expect(v.dropped).toEqual({
      nameKey: 'week.life.sponsor.name',
      reasonKey: 'week.blocked.no_sponsor',
    });
    expect(sheet(start, { load: 'push' }).dropped).toBeNull();
  });

  it('anteprima "se titolare" alle partite, fine settimana senza partite', () => {
    const plan: WeekPlan = { load: 'balanced' };
    const noMatch = sheet(start, plan);
    expect(noMatch.freshness.starter).toBe(false);
    expect(noMatch.freshness.labelKey).toBe('ui.plan.freshWeekEnd');
    expect(noMatch.freshness.moments).toBeNull();
    const v = sheet(start, plan, {
      matches: 2,
      freshnessAtMatches: [72, 68],
      momentsModifier: 0.024,
    });
    expect(v.freshness.starter).toBe(true);
    expect(v.freshness.labelKey).toBe('ui.plan.freshMatches');
    expect(v.freshness.value).toBe(70);
    expect(v.freshness.moments).toBe('+2%');
  });

  it("l'abilità in focus mostra valore intero, barra al prossimo +1 e settimane", () => {
    const plan: WeekPlan = { load: 'balanced', focus: 'shooting' };
    const v = sheet(start, plan, { nextPoint: { skill: 'shooting', weeks: 3 } });
    const value = start.player.skills.shooting;
    expect(v.skill).toMatchObject({
      nameKey: 'skills.shooting',
      value: Math.floor(value),
      next: Math.floor(value) + 1,
      weeks: 3,
    });
    expect(v.skill!.fraction).toBeCloseTo(value - Math.floor(value), 6);
    expect(v.pace.key).toMatch(/^ui\.plan\.pace\./);
  });

  it('dopo i 30 anni il declino si dichiara in percentuale', () => {
    const v = sheet(start, { load: 'push' }, { declineFactor: 0.7 });
    expect(v.decline).toBe('−30%');
    expect(sheet(start, { load: 'rest' }, { declineFactor: 1.2 }).decline).toBe('+20%');
    expect(sheet(start, { load: 'rest' }).decline).toBeNull();
  });

  it('il riepilogo per il lettore di schermo dice carico, freschezza e rischio', () => {
    const v = sheet(start, { load: 'push', life: 'family' });
    expect(v.summary.map((l) => l.key)).toEqual([
      'ui.plan.say.load',
      'ui.plan.say.fresh',
      'ui.plan.say.risk',
      'week.life.family.name',
    ]);
  });
});

describe('probabilità a parole', () => {
  it('arrotonda a frazioni semplici', () => {
    expect(chanceWords(0.512)).toBe('circa 1 su 2');
    expect(chanceWords(0.26)).toBe('circa 1 su 4');
    expect(chanceWords(0.1)).toBe('circa 1 su 10');
    expect(chanceWords(0.75)).toBe('circa 3 su 4');
    expect(chanceWords(0.004)).toBe('meno di 1 su 100');
    expect(chanceWords(0.97)).toBe('quasi certo');
  });
});

describe('problemi del piano allo stop', () => {
  it('raggruppa le settimane saltate per azione, con il motivo', () => {
    const v = planIssuesView([
      { week: 3, life: 'sponsor', reasonKey: 'week.blocked.no_sponsor' },
      { week: 4, life: 'sponsor', reasonKey: 'week.blocked.no_sponsor' },
    ]);
    expect(v).toEqual([
      { nameKey: 'week.life.sponsor.name', weeks: 2, reasonKey: 'week.blocked.no_sponsor' },
    ]);
    expect(planIssuesView([])).toEqual([]);
  });
});

describe('disciplina nel profilo', () => {
  it('mostra valore e base, con la riga "torna verso" solo se si discostano', () => {
    expect(disciplineView({ discipline: 52.4, disciplineBase: 70 })).toEqual({
      value: 52,
      base: 70,
      drift: 'up',
    });
    expect(disciplineView({ discipline: 80, disciplineBase: 70 }).drift).toBe('down');
    expect(disciplineView({ discipline: 69.8, disciplineBase: 70 }).drift).toBeNull();
  });
});

describe('variazioni mostrate degli eventi', () => {
  it('limita a 0–100 le statistiche percentuali, non i soldi', () => {
    expect(shownStatDelta('condition.energy', 95, 105)).toBe(5);
    expect(shownStatDelta('condition.energy', 3, -7)).toBe(-3);
    expect(shownStatDelta('money.cash', 100, -500)).toBe(-600);
  });
});
