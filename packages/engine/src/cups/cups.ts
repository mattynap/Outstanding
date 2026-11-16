import { defaultContext, type GameContext } from '../context';
import type { Rng } from '../rng';
import { expectedGoals } from '../season/quickSim';
import { roundRobin } from '../season/schedule';
import { computeStandings, type StandingRow } from '../season/standings';
import { seasonStartWeek } from '../time';
import type { CupInfo, CupStage, CupState, Fixture, GameState, Score, World } from '../types';
import { clamp } from '../util';
import { levelOfClub } from '../world/queries';

const GROUP_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
/** Tentativi di sorteggio con i vincoli (niente due club dello stesso paese nel girone) prima di rinunciarvi. */
const DRAW_ATTEMPTS = 50;

/** Nome della fase in base al numero di squadre del turno. */
export function stageFor(teams: number, round: number): CupStage {
  switch (teams) {
    case 2:
      return 'final';
    case 4:
      return 'sf';
    case 8:
      return 'qf';
    case 16:
      return 'last16';
    case 32:
      return 'last32';
    default:
      return `r${clamp(round, 1, 3)}` as CupStage;
  }
}

function byRating(world: World): (a: string, b: string) => number {
  const rating = new Map([...world.clubs, ...world.foreignClubs].map((c) => [c.id, c.rating]));
  return (a, b) => (rating.get(b) ?? 0) - (rating.get(a) ?? 0) || (a < b ? -1 : a > b ? 1 : 0);
}

function countryOf(world: World, clubId: string): string {
  return world.foreignClubs.find((c) => c.id === clubId)?.country ?? 'it';
}

/**
 * Club italiani qualificati a ogni coppa europea. `ranking` è la classifica della massima serie
 * (o, nella prima stagione, i club ordinati per forza). La vincitrice della coppa nazionale prende
 * un posto nella sua coppa europea; se è già qualificata, il posto va alla prima non qualificata.
 */
export function continentalQualifiers(
  ranking: readonly string[],
  cupWinner: string | undefined,
  ctx: GameContext = defaultContext,
): Map<string, string[]> {
  const cfg = ctx.config.cups;
  const out = new Map<string, string[]>();
  const taken = new Set<string>();
  for (const cup of cfg.continental.cups) {
    const ids = cup.leaguePlaces.map((p) => ranking[p - 1]).filter((id): id is string => !!id);
    ids.forEach((id) => taken.add(id));
    out.set(cup.id, ids);
  }
  const extra =
    cupWinner && !taken.has(cupWinner) ? cupWinner : ranking.find((id) => !taken.has(id));
  if (extra) out.get(cfg.nationalCup.winnerQualifiesTo)!.push(extra);
  return out;
}

/** Vincitrice di una sfida (una o due gare), contando supplementari e rigori. */
export function tieWinner(legs: readonly Fixture[]): string {
  const first = legs[0];
  if (!first) throw new Error('A tie needs at least one leg');
  const goals = new Map<string, number>([
    [first.homeId, 0],
    [first.awayId, 0],
  ]);
  for (const f of legs) {
    if (!f.result) throw new Error(`Fixture ${f.id} has not been played`);
    const add = (id: string, n: number) => goals.set(id, (goals.get(id) ?? 0) + n);
    add(f.homeId, f.result.home + (f.extraTime?.home ?? 0));
    add(f.awayId, f.result.away + (f.extraTime?.away ?? 0));
  }
  const a = goals.get(first.homeId)!;
  const b = goals.get(first.awayId)!;
  if (a !== b) return a > b ? first.homeId : first.awayId;
  const last = legs.find((f) => f.cup && f.cup.leg === f.cup.legs) ?? legs[legs.length - 1]!;
  if (!last.penalties) throw new Error(`Tie of ${last.id} is level without penalties`);
  return last.penalties.home > last.penalties.away ? last.homeId : last.awayId;
}

/**
 * Completa una gara decisiva a eliminazione diretta appena giocata: se la sfida è in parità
 * (sommando l'eventuale andata) aggiunge supplementari e, se serve, rigori.
 */
export function settleKnockout(
  fixture: Fixture,
  calendar: readonly Fixture[],
  ratings: ReadonlyMap<string, number>,
  rng: Rng,
  ctx: GameContext = defaultContext,
): Fixture {
  const cup = fixture.cup;
  if (!cup || cup.stage === 'group' || cup.leg !== cup.legs || !fixture.result) return fixture;
  let home = fixture.result.home;
  let away = fixture.result.away;
  if (cup.legs === 2) {
    const first = calendar.find((f) => f.cup?.tieId === cup.tieId && f.cup?.leg === 1);
    if (!first?.result) throw new Error(`First leg of ${fixture.id} has not been played`);
    // All'andata la squadra di casa del ritorno giocava in trasferta.
    home += first.result.away;
    away += first.result.home;
  }
  if (home !== away) return fixture;

  const cfg = ctx.config.cups;
  const rh = ratings.get(fixture.homeId) ?? 0;
  const ra = ratings.get(fixture.awayId) ?? 0;
  const xg = expectedGoals(rh, ra, ctx.config.match.quickSim, cup.neutral);
  const extraTime: Score = {
    home: rng.poisson(xg.home * cfg.extraTime.xgFactor),
    away: rng.poisson(xg.away * cfg.extraTime.xgFactor),
  };
  if (extraTime.home !== extraTime.away) return { ...fixture, extraTime };

  const p = cfg.penalties;
  const homeWins = rng.chance(clamp(0.5 + p.ratingScale * (rh - ra), p.minChance, p.maxChance));
  const winner = rng.int(p.winnerGoals[0], p.winnerGoals[1]);
  const loser = Math.max(0, winner - rng.int(1, p.maxMargin));
  const penalties = homeWins ? { home: winner, away: loser } : { home: loser, away: winner };
  return { ...fixture, extraTime, penalties };
}

interface KnockoutRound {
  competitionId: string;
  season: number;
  round: number;
  /** Settimane della stagione: una (gara secca) o due (andata e ritorno). */
  weeks: readonly number[];
  neutral: boolean;
  /** Coppie [casa all'andata, casa al ritorno]. */
  pairs: [string, string][];
  /** Squadre totali del turno, per il nome della fase. */
  teams: number;
}

function knockoutFixtures(r: KnockoutRound, ctx: GameContext): Fixture[] {
  const start = seasonStartWeek(r.season, ctx.config.calendar);
  const legs = r.weeks.length as 1 | 2;
  const stage = stageFor(r.teams, r.round);
  const fixtures: Fixture[] = [];
  r.pairs.forEach(([a, b], i) => {
    const tieId = `${r.season}-${r.competitionId}-${r.round}-${i}`;
    r.weeks.forEach((week, l) => {
      const leg = (l + 1) as 1 | 2;
      const cup: CupInfo = {
        competitionId: r.competitionId,
        stage,
        round: r.round,
        tieId,
        leg,
        legs,
        neutral: r.neutral && legs === 1,
      };
      fixtures.push({
        id: `f${r.season}-${r.competitionId}-K${r.round}-${i}-${leg}`,
        season: r.season,
        week: start + week,
        matchday: r.round,
        leagueId: r.competitionId,
        groupId: `${r.competitionId}-K${r.round}`,
        homeId: leg === 1 ? a : b,
        awayId: leg === 1 ? b : a,
        cup,
      });
    });
  });
  return fixtures;
}

/** Coppie casuali; in coppa nazionale gioca in casa la squadra di categoria inferiore. */
function drawPairs(teams: readonly string[], world: World, rng: Rng, lowerHosts: boolean) {
  const order = rng.shuffle(teams);
  const pairs: [string, string][] = [];
  for (let i = 0; i + 1 < order.length; i += 2) {
    let a = order[i]!;
    let b = order[i + 1]!;
    if (lowerHosts && (levelOfClub(world, b) ?? 0) > (levelOfClub(world, a) ?? 0)) [a, b] = [b, a];
    pairs.push([a, b]);
  }
  return pairs;
}

/** Sorteggia il turno `index` (da 0) della coppa nazionale. */
function drawNationalRound(
  cup: CupState,
  winners: readonly string[],
  world: World,
  rng: Rng,
  ctx: GameContext,
): Fixture[] {
  const rounds = ctx.config.cups.nationalCup.rounds;
  const index = cup.nextRound;
  const round = rounds[index]!;
  // Entrano per prime le squadre più deboli: `participants` va dal più forte al più debole.
  const entered = rounds.slice(0, index).reduce((sum, r) => sum + r.entrants, 0);
  const n = cup.participants.length;
  const newcomers = cup.participants.slice(n - entered - round.entrants, n - entered);
  const teams = [...winners, ...newcomers];
  return knockoutFixtures(
    {
      competitionId: cup.competitionId,
      season: cup.season,
      round: index + 1,
      weeks: [round.weekOfSeason],
      neutral: round.neutral ?? false,
      pairs: drawPairs(teams, world, rng, true),
      teams: teams.length,
    },
    ctx,
  );
}

/** Gironi per fasce di forza, evitando se possibile due club dello stesso paese nello stesso girone. */
function drawGroups(participants: readonly string[], world: World, rng: Rng, groups: number) {
  const size = participants.length / groups;
  for (let attempt = 0; attempt <= DRAW_ATTEMPTS; attempt++) {
    const strict = attempt < DRAW_ATTEMPTS;
    const out: string[][] = Array.from({ length: groups }, () => []);
    let ok = true;
    for (let pot = 0; pot < size && ok; pot++) {
      const potTeams = rng.shuffle(participants.slice(pot * groups, (pot + 1) * groups));
      for (const team of potTeams) {
        const country = countryOf(world, team);
        const free = out.filter(
          (g) => g.length === pot && (!strict || !g.some((t) => countryOf(world, t) === country)),
        );
        if (free.length === 0) {
          ok = false;
          break;
        }
        rng.pick(free).push(team);
      }
    }
    if (ok) return out;
  }
  throw new Error('Group draw failed');
}

function groupFixtures(cup: CupState, rng: Rng, ctx: GameContext): Fixture[] {
  const weeks = ctx.config.cups.continental.groupWeeks;
  const start = seasonStartWeek(cup.season, ctx.config.calendar);
  const fixtures: Fixture[] = [];
  for (const group of cup.groups) {
    const firstLeg = roundRobin(rng.shuffle(group.clubIds));
    const rounds = [...firstLeg, ...firstLeg.map((r) => r.map(([h, a]) => [a, h] as const))];
    rounds.forEach((round, md) => {
      round.forEach(([homeId, awayId], i) => {
        fixtures.push({
          id: `f${cup.season}-${cup.competitionId}-${group.letter}-${md + 1}-${i}`,
          season: cup.season,
          week: start + weeks[md]!,
          matchday: md + 1,
          leagueId: cup.competitionId,
          groupId: group.id,
          homeId,
          awayId,
          cup: {
            competitionId: cup.competitionId,
            stage: 'group',
            round: 0,
            leg: 1,
            legs: 1,
            neutral: false,
          },
        });
      });
    });
  }
  return fixtures;
}

/** Classifiche dei gironi di una coppa europea. */
export function cupGroupTables(
  cup: CupState,
  calendar: readonly Fixture[],
  ctx: GameContext = defaultContext,
): { id: string; letter: string; table: StandingRow[] }[] {
  return cup.groups.map((g) => ({
    id: g.id,
    letter: g.letter,
    table: computeStandings(
      calendar.filter((f) => f.groupId === g.id && f.season === cup.season),
      g.clubIds,
      ctx.config.world.points,
    ),
  }));
}

/** Primo turno a eliminazione diretta dopo i gironi: le prime contro le seconde di un altro girone. */
function pairAfterGroups(
  tables: { table: StandingRow[] }[],
  advance: number,
  world: World,
  rng: Rng,
): [string, string][] {
  const qualified = tables.map((t, gi) =>
    t.table.slice(0, advance).map((r) => ({ id: r.clubId, gi })),
  );
  if (advance !== 2)
    return drawPairs(
      qualified.flat().map((q) => q.id),
      world,
      rng,
      false,
    );
  const winners = qualified.map((q) => q[0]!);
  const runners = qualified.map((q) => q[1]!);
  for (let attempt = 0; attempt <= DRAW_ATTEMPTS; attempt++) {
    const order = rng.shuffle(runners);
    if (attempt === DRAW_ATTEMPTS || order.every((r, i) => r.gi !== winners[i]!.gi)) {
      // La prima del girone gioca il ritorno in casa.
      return order.map((r, i) => [r.id, winners[i]!.id] as [string, string]);
    }
  }
  throw new Error('unreachable');
}

/**
 * Crea le coppe della stagione: Coppa Tricolore (primo turno sorteggiato) e coppe europee (gironi
 * sorteggiati con tutte le giornate). `ranking` è la classifica finale della massima serie della
 * stagione precedente (o i club per forza nella prima stagione).
 */
export function setupSeasonCups(
  world: World,
  season: number,
  ranking: readonly string[],
  cupWinner: string | undefined,
  rng: Rng,
  ctx: GameContext = defaultContext,
): { cups: CupState[]; fixtures: Fixture[] } {
  const cfg = ctx.config.cups;
  const strongest = byRating(world);
  const clubsAtLevel = (level: number) =>
    world.leagues.find((l) => l.level === level)?.groups.flatMap((g) => g.clubIds) ?? [];

  // Coppa nazionale: livelli interi più le migliori del livello extra, dal più forte al più debole.
  const national: string[] = [];
  for (const level of [...cfg.nationalCup.levels].sort((a, b) => a - b)) {
    national.push(...clubsAtLevel(level).sort(strongest));
  }
  national.push(
    ...clubsAtLevel(cfg.nationalCup.extra.level)
      .sort(strongest)
      .slice(0, cfg.nationalCup.extra.count),
  );
  const nationalCup: CupState = {
    competitionId: cfg.nationalCup.id,
    season,
    participants: national,
    groups: [],
    nextRound: 0,
  };
  const fixtures = drawNationalRound(nationalCup, [], world, rng, ctx);
  const cups: CupState[] = [{ ...nationalCup, nextRound: 1 }];

  // Coppe europee: italiane qualificate più le straniere più forti ancora libere.
  const qualifiers = continentalQualifiers(ranking, cupWinner, ctx);
  const foreign = world.foreignClubs.map((c) => c.id).sort(strongest);
  let next = 0;
  for (const c of cfg.continental.cups) {
    const italian = qualifiers.get(c.id) ?? [];
    const count = cfg.continental.teams - italian.length;
    const participants = [...italian, ...foreign.slice(next, next + count)].sort(strongest);
    next += count;
    const drawn = drawGroups(participants, world, rng, cfg.continental.groups);
    const cup: CupState = {
      competitionId: c.id,
      season,
      participants,
      groups: drawn.map((clubIds, i) => ({
        id: `${c.id}-${GROUP_LETTERS[i]}`,
        letter: GROUP_LETTERS[i]!,
        clubIds,
      })),
      nextRound: 0,
    };
    fixtures.push(...groupFixtures(cup, rng, ctx));
    cups.push(cup);
  }
  return { cups, fixtures };
}

const isNational = (cup: CupState, ctx: GameContext) =>
  cup.competitionId === ctx.config.cups.nationalCup.id;

/** Vincitrici delle sfide di un turno, nell'ordine del sorteggio. */
function roundWinners(fixtures: readonly Fixture[]): string[] {
  const ties = new Map<string, Fixture[]>();
  for (const f of fixtures) {
    const id = f.cup!.tieId!;
    ties.set(id, [...(ties.get(id) ?? []), f]);
  }
  return [...ties.values()].map((legs) => tieWinner(legs.sort((a, b) => a.cup!.leg - b.cup!.leg)));
}

/**
 * Fa avanzare le coppe dopo una settimana giocata: quando un turno è completo sorteggia il successivo
 * (o proclama la vincitrice). Va chiamata con il calendario che contiene già i risultati.
 */
export function progressCups(
  state: Pick<GameState, 'cups' | 'calendar' | 'world'>,
  rng: Rng,
  ctx: GameContext = defaultContext,
): { cups: CupState[]; fixtures: Fixture[] } {
  const fixtures: Fixture[] = [];
  const cups = state.cups.map((cup) => {
    if (cup.winnerId) return cup;
    const current = state.calendar.filter(
      (f) =>
        f.season === cup.season &&
        f.cup?.competitionId === cup.competitionId &&
        f.cup.round === cup.nextRound,
    );
    if (current.length === 0 || current.some((f) => !f.result)) return cup;

    if (isNational(cup, ctx)) {
      const winners = roundWinners(current);
      if (cup.nextRound >= ctx.config.cups.nationalCup.rounds.length) {
        return { ...cup, winnerId: winners[0]! };
      }
      fixtures.push(...drawNationalRound(cup, winners, state.world, rng, ctx));
      return { ...cup, nextRound: cup.nextRound + 1 };
    }

    const cont = ctx.config.cups.continental;
    let pairs: [string, string][];
    if (cup.nextRound === 0) {
      const tables = cupGroupTables(cup, state.calendar, ctx);
      pairs = pairAfterGroups(tables, cont.advancePerGroup, state.world, rng);
    } else {
      const winners = roundWinners(current);
      if (cup.nextRound >= cont.knockout.length) return { ...cup, winnerId: winners[0]! };
      pairs = drawPairs(winners, state.world, rng, false);
    }
    const round = cont.knockout[cup.nextRound]!;
    fixtures.push(
      ...knockoutFixtures(
        {
          competitionId: cup.competitionId,
          season: cup.season,
          round: cup.nextRound + 1,
          weeks: round.weeks,
          neutral: round.neutral ?? false,
          pairs,
          teams: pairs.length * 2,
        },
        ctx,
      ),
    );
    return { ...cup, nextRound: cup.nextRound + 1 };
  });
  return { cups, fixtures };
}

/** Coppe della stagione corrente a cui partecipa un club. */
export function clubCups(state: GameState, clubId: string): CupState[] {
  return state.cups.filter((c) => c.participants.includes(clubId));
}
