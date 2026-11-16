import { describe, expect, it } from 'vitest';
import {
  advanceWeek,
  computeStandings,
  continentalQualifiers,
  cupGroupTables,
  defaultContext,
  deserialize,
  endSeason,
  getLeagueByLevel,
  isSeasonOver,
  newCareer,
  playerFixture,
  playerFixtures,
  playMatch,
  seasonStartWeek,
  serialize,
  settleKnockout,
  tieWinner,
  Rng,
  type Fixture,
  type GameState,
} from '../src/index';
import { baseOptions } from './fixtures';

const ctx = defaultContext;
const cfg = ctx.config.cups;

function playSeason(state: GameState): GameState {
  let s = state;
  while (!isSeasonOver(s)) {
    while (playerFixture(s)) s = playMatch(s, () => 0).state;
    s = advanceWeek(s).state;
  }
  return s;
}

const fresh = newCareer(baseOptions, 7);
const played = playSeason(fresh);
const cupFixtures = (s: GameState, id: string) =>
  s.calendar.filter((f) => f.cup?.competitionId === id && f.season === s.season);

describe('club stranieri', () => {
  const foreign = fresh.world.foreignClubs;

  it('genera un club per fascia con nomi unici e paesi dei contenuti', () => {
    const total = cfg.foreign.tiers.reduce((sum, t) => sum + t.count, 0);
    expect(foreign).toHaveLength(total);
    expect(new Set(foreign.map((c) => c.name)).size).toBe(total);
    const countries = new Set(ctx.content.foreign.map((c) => c.id));
    for (const c of foreign) {
      expect(countries.has(c.country)).toBe(true);
      expect(c.roster.length).toBeGreaterThan(0);
    }
    const italianNames = new Set(fresh.world.clubs.map((c) => c.name));
    expect(foreign.some((c) => italianNames.has(c.name))).toBe(false);
  });

  it('le fasce alte sono più forti', () => {
    const avg = (tier: number) => {
      const r = foreign.filter((c) => c.tier === tier).map((c) => c.rating);
      return r.reduce((a, b) => a + b, 0) / r.length;
    };
    expect(avg(0)).toBeGreaterThan(avg(1));
  });
});

describe('sorteggi di inizio stagione', () => {
  it('la Coppa Tricolore ha tutti i professionisti e le migliori della Lega Interzonale', () => {
    const cup = fresh.cups.find((c) => c.competitionId === cfg.nationalCup.id)!;
    const pro = cfg.nationalCup.levels.flatMap((l) =>
      getLeagueByLevel(fresh.world, l).groups.flatMap((g) => g.clubIds),
    );
    expect(cup.participants).toHaveLength(pro.length + cfg.nationalCup.extra.count);
    expect(new Set(cup.participants).size).toBe(cup.participants.length);
    for (const id of pro) expect(cup.participants).toContain(id);
    // Il primo turno è già sorteggiato con le squadre più deboli.
    const r1 = cupFixtures(fresh, cup.competitionId);
    expect(r1).toHaveLength(cfg.nationalCup.rounds[0]!.entrants / 2);
    const weakest = new Set(cup.participants.slice(-cfg.nationalCup.rounds[0]!.entrants));
    for (const f of r1) {
      expect(weakest.has(f.homeId) && weakest.has(f.awayId)).toBe(true);
      expect(f.week).toBe(
        seasonStartWeek(1, ctx.config.calendar) + cfg.nationalCup.rounds[0]!.weekOfSeason,
      );
    }
  });

  it('le coppe europee hanno 32 squadre diverse, con le italiane più forti in Maior', () => {
    const [major, minor] = cfg.continental.cups.map((c) =>
      fresh.cups.find((x) => x.competitionId === c.id)!,
    );
    const all = [...major!.participants, ...minor!.participants];
    expect(new Set(all).size).toBe(cfg.continental.teams * 2);
    const top = [...getLeagueByLevel(fresh.world, 1).groups[0]!.clubIds].sort(
      (a, b) =>
        fresh.world.clubs.find((c) => c.id === b)!.rating -
          fresh.world.clubs.find((c) => c.id === a)!.rating || (a < b ? -1 : 1),
    );
    const italian = (ids: string[]) =>
      ids.filter((id) => fresh.world.clubs.some((c) => c.id === id));
    expect(italian(major!.participants).sort()).toEqual(top.slice(0, 4).sort());
    expect(italian(minor!.participants).sort()).toEqual(top.slice(4, 7).sort());
  });

  it('nei gironi non ci sono due club dello stesso paese', () => {
    for (const cup of fresh.cups.filter((c) => c.groups.length > 0)) {
      expect(cup.groups).toHaveLength(cfg.continental.groups);
      for (const g of cup.groups) {
        const countries = g.clubIds.map(
          (id) => fresh.world.foreignClubs.find((c) => c.id === id)?.country ?? 'it',
        );
        expect(new Set(countries).size).toBe(countries.length);
      }
      // Andata e ritorno nel girone: ogni squadra gioca una volta per giornata.
      const fx = cupFixtures(fresh, cup.competitionId);
      expect(fx).toHaveLength(cfg.continental.teams * (cfg.continental.groupWeeks.length / 2));
    }
  });
});

describe('una stagione completa', () => {
  it('ogni coppa ha una vincitrice e il numero giusto di partite', () => {
    for (const cup of played.cups) expect(cup.winnerId).toBeDefined();
    const national = cupFixtures(played, cfg.nationalCup.id);
    const teams = played.cups.find((c) => c.competitionId === cfg.nationalCup.id)!.participants;
    expect(national).toHaveLength(teams.length - 1);
    const groupGames = cfg.continental.teams * (cfg.continental.groupWeeks.length / 2);
    const koGames = cfg.continental.knockout.reduce(
      (sum, r, i) =>
        sum +
        ((cfg.continental.groups * cfg.continental.advancePerGroup) / 2 ** (i + 1)) *
          r.weeks.length,
      0,
    );
    for (const c of cfg.continental.cups) {
      expect(cupFixtures(played, c.id)).toHaveLength(groupGames + koGames);
    }
  });

  it('nessun club gioca due partite di coppa nella stessa settimana', () => {
    const seen = new Set<string>();
    for (const f of played.calendar.filter((x) => x.cup)) {
      for (const id of [f.homeId, f.awayId]) {
        const key = `${id}@${f.week}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });

  it('le sfide in parità si decidono ai supplementari o ai rigori', () => {
    const ties = new Map<string, Fixture[]>();
    for (const f of played.calendar) {
      if (f.cup?.tieId) ties.set(f.cup.tieId, [...(ties.get(f.cup.tieId) ?? []), f]);
    }
    let decided = 0;
    for (const legs of ties.values()) {
      legs.sort((a, b) => a.cup!.leg - b.cup!.leg);
      expect(() => tieWinner(legs)).not.toThrow();
      if (legs.some((l) => l.extraTime)) decided++;
      for (const l of legs.filter((x) => x.penalties)) {
        expect(l.penalties!.home).not.toBe(l.penalties!.away);
      }
    }
    expect(decided).toBeGreaterThan(0);
  });

  it('le vincitrici dei gironi giocano il ritorno in casa contro le seconde', () => {
    for (const c of cfg.continental.cups) {
      const cup = played.cups.find((x) => x.competitionId === c.id)!;
      const winners = new Set(cupGroupTables(cup, played.calendar).map((g) => g.table[0]!.clubId));
      const r16 = cupFixtures(played, c.id).filter((f) => f.cup!.round === 1 && f.cup!.leg === 2);
      expect(r16).toHaveLength(cfg.continental.groups);
      for (const f of r16) expect(winners.has(f.homeId)).toBe(true);
    }
  });

  it("a fine stagione si registrano le vincitrici e si qualificano le italiane per l'anno dopo", () => {
    const { state, seasonReport } = endSeason(played);
    expect(seasonReport.cupWinners).toHaveLength(played.cups.length);
    expect(state.cups.every((c) => c.season === 2 && !c.winnerId)).toBe(true);
    const top = getLeagueByLevel(played.world, 1).groups[0]!;
    const ranking = computeStandings(
      played.calendar.filter((f) => f.groupId === top.id),
      top.clubIds,
      ctx.config.world.points,
    ).map((r) => r.clubId);
    const major0 = state.cups.find((c) => c.competitionId === cfg.continental.cups[0]!.id)!;
    for (const id of ranking.slice(0, 4)) expect(major0.participants).toContain(id);
    const nationalWinner = seasonReport.cupWinners.find(
      (w) => w.competitionId === cfg.nationalCup.id,
    )!.clubId;
    const minor = state.cups.find((c) => c.competitionId === cfg.nationalCup.winnerQualifiesTo)!;
    const major = state.cups.find((c) => c.competitionId === cfg.continental.cups[0]!.id)!;
    expect(
      minor.participants.includes(nationalWinner) || major.participants.includes(nationalWinner),
    ).toBe(true);
    expect(state.calendar.some((f) => f.cup && f.season === 2)).toBe(true);
  });

  it('i trofei del club del giocatore finiscono nello storico', () => {
    const winner = played.cups.find((c) => c.competitionId === cfg.nationalCup.id)!.winnerId!;
    const s = { ...played, player: { ...played.player, clubId: winner } };
    if (!s.world.clubs.some((c) => c.id === winner)) return;
    const { seasonReport } = endSeason(s);
    expect(seasonReport.record.trophies).toContain(cfg.nationalCup.id);
  });

  it('è deterministica e sopravvive al salvataggio', () => {
    const again = playSeason(newCareer(baseOptions, 7));
    expect(again.cups.map((c) => c.winnerId)).toEqual(played.cups.map((c) => c.winnerId));
    expect(deserialize(serialize(played))).toEqual(played);
  });
});

describe('settimane con due partite', () => {
  it('il giocatore di un club europeo gioca campionato e coppa nella stessa settimana', () => {
    const major = fresh.cups.find((c) => c.competitionId === cfg.continental.cups[0]!.id)!;
    const club = major.participants.find((id) => fresh.world.clubs.some((c) => c.id === id))!;
    let s: GameState = { ...fresh, player: { ...fresh.player, clubId: club } };
    const target = seasonStartWeek(1, ctx.config.calendar) + cfg.continental.groupWeeks[0]!;
    while (s.week < target) {
      while (playerFixture(s)) s = playMatch(s, () => 0).state;
      s = advanceWeek(s).state;
    }
    expect(playerFixtures(s)).toHaveLength(2);
    s = playMatch(s, () => 0).state;
    expect(() => advanceWeek(s)).toThrow(/match/);
    const { state, matchReport } = playMatch(s, () => 0);
    expect(matchReport.competitionId).toBe(major.competitionId);
    expect(playerFixture(state)).toBeUndefined();
    expect(() => advanceWeek(state)).not.toThrow();
  });
});

describe('regole delle sfide', () => {
  const base: Fixture = {
    id: 'x2',
    season: 1,
    week: 10,
    matchday: 1,
    leagueId: 'cup',
    groupId: 'cup-K1',
    homeId: 'b',
    awayId: 'a',
    cup: {
      competitionId: 'cup',
      stage: 'qf',
      round: 1,
      tieId: 't',
      leg: 2,
      legs: 2,
      neutral: false,
    },
    result: { home: 1, away: 0 },
  };
  const first: Fixture = {
    ...base,
    id: 'x1',
    homeId: 'a',
    awayId: 'b',
    cup: { ...base.cup!, leg: 1 },
    result: { home: 2, away: 0 },
  };
  const ratings = new Map([
    ['a', 70],
    ['b', 70],
  ]);

  it("vince chi segna di più nelle due gare, senza supplementari se l'aggregato non è pari", () => {
    const out = settleKnockout(base, [first, base], ratings, Rng.fromSeed(1));
    expect(out.extraTime).toBeUndefined();
    expect(tieWinner([first, out])).toBe('a');
  });

  it('con aggregato pari si giocano supplementari ed eventualmente i rigori', () => {
    const level = { ...base, result: { home: 2, away: 0 } };
    for (let seed = 1; seed <= 30; seed++) {
      const out = settleKnockout(level, [first, level], ratings, Rng.fromSeed(seed));
      expect(out.extraTime).toBeDefined();
      expect(['a', 'b']).toContain(tieWinner([first, out]));
    }
  });

  it('le partite dei gironi non hanno supplementari', () => {
    const group: Fixture = { ...base, cup: { ...base.cup!, stage: 'group', leg: 1, legs: 1 } };
    const out = settleKnockout(
      { ...group, result: { home: 1, away: 1 } },
      [],
      ratings,
      Rng.fromSeed(1),
    );
    expect(out.extraTime).toBeUndefined();
  });

  it('la vincitrice della coppa nazionale già qualificata lascia il posto alla successiva', () => {
    const ranking = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'];
    const q = continentalQualifiers(ranking, 'c2');
    expect(q.get('continental_major')).toEqual(['c1', 'c2', 'c3', 'c4']);
    expect(q.get('continental_minor')).toEqual(['c5', 'c6', 'c7']);
    expect(continentalQualifiers(ranking, 'z9').get('continental_minor')).toEqual([
      'c5',
      'c6',
      'z9',
    ]);
  });
});
