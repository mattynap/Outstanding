import {
  getPlanOptions,
  type EffectiveLoad,
  type GameContext,
  type GameState,
  type LifeAction,
  type Load,
  type PlanIssue,
  type PlanPreview,
  type Skill,
  type WeekPlan,
} from '@outstanding/engine';
import { formatDelta, formatMoney, type TextParams } from './text';
import { playerAge } from './views';

/** Una riga di testo già pronta: chiave e parametri (quelli che finiscono in `Key` vanno tradotti). */
export interface TextLine {
  key: string;
  params?: TextParams;
}

export interface LoadChip {
  id: Load;
  nameKey: string;
  descKey: string;
  /** "+22 a settimana · tetto 90", dai numeri della configurazione. */
  hintParams: { delta: string; cap: number };
  selected: boolean;
  disabled: boolean;
}

export interface LifeChip {
  id: LifeAction | 'none';
  nameKey: string;
  descKey: string;
  selected: boolean;
  disabled: boolean;
  /** Perché non si può scegliere adesso. */
  reasonKey?: string;
}

/** Le righe del bozzetto (spec §5.7), già tradotte in chiavi e numeri. */
export interface PlanSheetView {
  header: { chapterKey: string; weeks: number; matches: number };
  loads: LoadChip[];
  /** Da infortunato il carico è Recupero: i chip restano visibili ma bloccati. */
  forced: boolean;
  loadShownKey: string;
  freshness: {
    labelKey: 'ui.plan.freshMatches' | 'ui.plan.freshWeekEnd';
    /** Freschezza attesa: media alle partite (se titolare) o a fine settimana. */
    value: number;
    /** Freschezza di adesso, per il confronto sulla barra. */
    now: number;
    /** Tetto del carico: la tacca sulla barra. */
    cap: number;
    /** Calo vero a fine settimana rispetto ad adesso (partita da titolare compresa). */
    fall: number;
    /** Punti di recupero che il tetto del carico taglia questa settimana. */
    capCut: number;
    /** Ipotesi "se titolare 90 minuti": vale solo con partite nel capitolo. */
    starter: boolean;
    /** "+2%" nei momenti chiave alla freschezza attesa; nullo senza partite. */
    moments: string | null;
  };
  risk: { key: string; band: PlanPreview['chapter']['riskBand']; pct: number };
  /** Soglia di freschezza sotto cui si rischia la panchina, se il piano ci arriva. */
  bench: number | null;
  skill: {
    nameKey: string;
    value: number;
    next: number;
    /** Parte verso il prossimo +1 (0–1): la barra. */
    fraction: number;
    weeks: number | null;
  } | null;
  pace: { key: string; reasonKey: string; reasonParams: TextParams };
  /** Spostamento del declino di fine stagione ("−30%"), solo dopo i 30 anni. */
  decline: string | null;
  life: LifeChip[];
  /** Effetti e costi dell'azione fuori dal campo scelta. */
  lifeLines: TextLine[];
  /** L'azione del piano ricordato che adesso non è disponibile: tolta, e lo si dice. */
  dropped: { nameKey: string; reasonKey: string } | null;
  /** Mai confermare un piano con un'azione non disponibile. */
  canConfirm: boolean;
  /** Effetto principale per il lettore di schermo, aggiornato a ogni scelta. */
  summary: TextLine[];
}

const LOADS: readonly Load[] = ['rest', 'balanced', 'push'];

/**
 * Probabilità a parole, con frazioni semplici: 0,51 -> "circa 1 su 2", 0,75 -> "circa 3 su 4".
 * Restituisce parametri da fondere nella riga: `chanceKey` si traduce con `num` e `den`.
 */
export function chanceWords(p: number): TextParams {
  if (p < 0.01) return { chanceKey: 'ui.plan.chance.lt100' };
  if (p >= 0.95) return { chanceKey: 'ui.plan.chance.almost' };
  if (p < 2 / 3) return { chanceKey: 'ui.plan.chance.about', num: 1, den: Math.round(1 / p) };
  const den = Math.round(1 / (1 - p));
  return { chanceKey: 'ui.plan.chance.about', num: den - 1, den };
}

/**
 * Testo di una riga: i parametri che finiscono in `Key` sono chiavi, tradotte con gli altri
 * parametri della riga e passate senza il suffisso (`chanceKey` -> `{chance}`).
 */
export function lineText(t: (key: string, params?: TextParams) => string, l: TextLine): string {
  const plain: TextParams = {};
  const keys: [string, string][] = [];
  for (const [k, v] of Object.entries(l.params ?? {})) {
    if (k.endsWith('Key')) keys.push([k.slice(0, -3), String(v)]);
    else plain[k] = v;
  }
  const params: TextParams = { ...plain };
  for (const [name, key] of keys) params[name] = t(key, plain);
  return t(l.key, params);
}

/** La scheda del piano dall'anteprima del motore: nessun calcolo di gioco qui, solo presentazione. */
export function planSheetView(
  preview: PlanPreview,
  plan: WeekPlan,
  s: GameState,
  ctx: GameContext,
): PlanSheetView {
  const prog = ctx.config.progression;
  const options = getPlanOptions(s, ctx);
  const forced = options.forcedLoad === 'recovery';
  const eff: EffectiveLoad = forced ? 'recovery' : plan.load;
  const ch = preview.chapter;
  const w = preview.weekly;

  const loads: LoadChip[] = LOADS.map((id) => ({
    id,
    nameKey: `week.load.${id}.name`,
    descKey: `week.load.${id}.desc`,
    hintParams: { delta: formatDelta(prog.loads[id].freshness), cap: prog.loads[id].freshnessCap },
    selected: !forced && plan.load === id,
    disabled: !(options.loads.find((l) => l.id === id)?.available ?? false),
  }));

  const starter = ch.matches > 0;
  const value = Math.round(
    starter ? ch.freshnessAtMatches.reduce((a, b) => a + b, 0) / ch.matches : w.freshnessEnd,
  );
  const now = Math.round(clamp100(s.player.condition.energy));
  const cap = prog.loads[eff].freshnessCap;
  // capDrop del motore è solo il recupero tagliato dal tetto; il calo vero si misura dalla fine settimana.
  const fall = Math.max(0, now - Math.round(w.freshnessEnd));

  const skillId: Skill | undefined = plan.focus ?? ch.nextPoint?.skill;
  const skillValue = skillId ? s.player.skills[skillId] : 0;
  const skill = skillId
    ? {
        nameKey: `skills.${skillId}`,
        value: Math.floor(skillValue),
        next: Math.floor(skillValue) + 1,
        fraction: skillValue - Math.floor(skillValue),
        weeks: ch.nextPoint?.skill === skillId ? ch.nextPoint.weeks : null,
      }
    : null;

  const available = (id: LifeAction) => options.life.find((l) => l.id === id);
  const life: LifeChip[] = [
    ...options.life.map((o) => ({
      id: o.id,
      nameKey: `week.life.${o.id}.name`,
      descKey: `week.life.${o.id}.desc`,
      selected: plan.life === o.id,
      disabled: !o.available,
      ...(o.reasonKey ? { reasonKey: o.reasonKey } : {}),
    })),
    // "Nessuna" in fondo, come nel bozzetto: sempre disponibile.
    {
      id: 'none',
      nameKey: 'week.life.none.name',
      descKey: 'week.life.none.desc',
      selected: plan.life === undefined,
      disabled: false,
    },
  ];

  const remembered = (s.chapterPlan ?? s.lastPlan)?.life;
  const lost = remembered ? available(remembered) : undefined;
  const dropped =
    remembered && lost && !lost.available
      ? {
          nameKey: `week.life.${remembered}.name`,
          reasonKey: lost.reasonKey ?? 'ui.plan.unavailable',
        }
      : null;
  const canConfirm = plan.life === undefined || (available(plan.life)?.available ?? false);

  const riskKey = `ui.plan.risk.${ch.riskBand}`;
  const lines = lifeLines(preview, plan.life, s, ctx);
  const loadShownKey = `week.load.${eff}.name`;
  return {
    header: { chapterKey: `ui.chapter.name.${s.chapter.id}`, weeks: ch.weeks, matches: ch.matches },
    loads,
    forced,
    loadShownKey,
    freshness: {
      labelKey: starter ? 'ui.plan.freshMatches' : 'ui.plan.freshWeekEnd',
      value,
      now,
      cap,
      fall,
      capCut: Math.round(w.capDrop),
      starter,
      moments: starter ? `${formatDelta(Math.round(ch.momentsModifier * 100))}%` : null,
    },
    risk: { key: riskKey, band: ch.riskBand, pct: Math.round(ch.injuryChance * 100) },
    bench: ch.benchRisk === 'some' ? ctx.config.match.selection.freshnessFrom : null,
    skill,
    pace: {
      key: `ui.plan.pace.${ch.pace}`,
      reasonKey: `ui.plan.paceReason.${ch.paceReason}`,
      reasonParams: { age: playerAge(s, ctx) },
    },
    decline:
      ch.declineFactor !== undefined
        ? `${formatDelta(Math.round((ch.declineFactor - 1) * 100))}%`
        : null,
    life,
    lifeLines: lines,
    dropped,
    canConfirm,
    summary: [
      { key: 'ui.plan.say.load', params: { loadKey: loadShownKey } },
      { key: 'ui.plan.say.fresh', params: { value } },
      { key: 'ui.plan.say.risk', params: { riskKey } },
      { key: plan.life ? `week.life.${plan.life}.name` : 'week.life.none.name' },
      // L'effetto principale dell'azione, non solo il nome.
      ...(plan.life && lines[0] ? [lines[0]] : []),
    ],
  };
}

function lifeLines(
  preview: PlanPreview,
  life: LifeAction | undefined,
  s: GameState,
  ctx: GameContext,
): TextLine[] {
  const cfg = ctx.config.progression.life;
  const ch = preview.chapter;
  const fx = preview.weekly.lifeEffects;
  switch (life) {
    case 'family':
      return [
        {
          key: 'ui.plan.life.family',
          params: { pct: Math.round(cfg.family.moraleLossFactor * 100) },
        },
      ];
    case 'leisure':
      return [
        { key: 'ui.plan.life.leisure', params: { factor: cfg.leisure.moraleRecoveryFactor } },
      ];
    case 'sponsor':
      return [
        {
          key: 'ui.plan.life.sponsor',
          params: { money: formatMoney(ch.moneyTotal ?? 0), weeks: ch.weeks },
        },
        { key: 'ui.plan.life.sponsorCost', params: { fresh: formatDelta(cfg.sponsor.freshness) } },
      ];
    case 'party': {
      const lines: TextLine[] = [
        {
          key: 'ui.plan.life.party',
          params: {
            popularity: formatDelta(fx.popularityPerWeek ?? 0, 1),
            discipline: formatDelta(fx.disciplinePerWeek ?? 0, 1),
          },
        },
      ];
      if (s.privateLife?.partner) {
        lines.push({
          key: 'ui.plan.life.partyPartner',
          params: { affinity: formatDelta(cfg.party.partnerAffinity, 1) },
        });
      }
      lines.push({
        key: 'ui.plan.life.gossip',
        params: { ...chanceWords(ch.gossipChance ?? 0), weeks: ch.weeks },
      });
      if (ch.matches > 0 && (ch.fineChance ?? 0) > 0) {
        lines.push({
          key: 'ui.plan.life.fine',
          params: { ...chanceWords(ch.fineChance ?? 0), matches: ch.matches },
        });
      }
      return lines;
    }
    default:
      return [{ key: 'ui.plan.life.none' }];
  }
}

/** Le settimane in cui l'azione del piano è saltata, una riga per azione. */
export function planIssuesView(
  issues: readonly PlanIssue[],
): { nameKey: string; weeks: number; reasonKey: string }[] {
  const rows = new Map<LifeAction, { nameKey: string; weeks: number; reasonKey: string }>();
  for (const i of issues) {
    const row = rows.get(i.life);
    if (row) row.weeks++;
    else
      rows.set(i.life, { nameKey: `week.life.${i.life}.name`, weeks: 1, reasonKey: i.reasonKey });
  }
  return [...rows.values()];
}

/** Disciplina nel profilo: il valore torna verso la base a ogni settimana (la Serata lo abbassa). */
export function disciplineView(p: { discipline: number; disciplineBase: number }): {
  value: number;
  base: number;
  drift: 'up' | 'down' | null;
} {
  const value = Math.round(clamp100(p.discipline));
  const base = Math.round(clamp100(p.disciplineBase));
  return { value, base, drift: value < base ? 'up' : value > base ? 'down' : null };
}

/** I valori di stato possono uscire da 0–100 a metà settimana: a schermo si limitano. */
export function clamp100(n: number): number {
  return Math.max(0, Math.min(100, n));
}
