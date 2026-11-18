import { describe, expect, it } from 'vitest';
import {
  advanceWeek,
  autoDecider,
  isSeasonOver,
  playMatch,
  beginMatch,
  defaultContext,
  deserialize,
  newCareer,
  playerFixture,
  serialize,
  type Fixture,
  type GameState,
  type ContractOffer,
  acceptOffer,
  getTransferWindow,
} from '../src/index';
import { levelOfClub } from '../src/world/queries';
import { keyOpponentOf, matchSignals, matchStakes } from '../src/match/stakes';
import { baseOptions } from './fixtures';

const cfg = defaultContext.config.match.stakes;

/** Porta la carriera alla prima partita del giocatore in campionato. */
function firstMatch(seed: number): { state: GameState; fixture: Fixture } {
  let s = newCareer(baseOptions, seed);
  for (let i = 0; i < 60; i++) {
    const f = playerFixture(s);
    if (f && !f.cup) return { state: s, fixture: f };
    s = advanceWeek(s).state;
  }
  throw new Error('no fixture');
}

/** Stato in cui nessun segnale è attivo per costruzione. */
function quiet(seed: number) {
  const { state, fixture } = firstMatch(seed);
  const clubId = state.player.clubId!;
  const coachId = state.world.clubs.find((c) => c.id === clubId)!.coachId;
  const s: GameState = {
    ...state,
    player: {
      ...state.player,
      seasonStats: { ...state.player.seasonStats, appearances: 5 },
      seasonLevelApps: { [levelOfClub(state.world, clubId)!]: 5 },
      relationships: { ...state.player.relationships, [coachId]: 0 },
      contract: state.player.contract && { ...state.player.contract, untilSeason: 99 },
    },
  };
  // Nessun avversario in rosa vicino al giocatore: la soglia è irraggiungibile.
  const oppId = fixture.homeId === clubId ? fixture.awayId : fixture.homeId;
  const world = {
    ...s.world,
    clubs: s.world.clubs.map((c) =>
      c.id === oppId ? { ...c, roster: c.roster.map((r) => ({ ...r, ovr: 0 })) } : c,
    ),
  };
  return { state: { ...s, world }, fixture: { ...fixture, matchday: 1 }, coachId };
}

describe('matchSignals', () => {
  it('nessun segnale: posta 0', () => {
    const { state, fixture } = quiet(3);
    expect(matchSignals(state, fixture)).toEqual([]);
    expect(matchStakes([], cfg)).toBe(0);
  });

  it('debut: nessuna presenza nel livello del club attuale', () => {
    const { state, fixture } = quiet(3);
    const level = levelOfClub(state.world, state.player.clubId!)!;
    const at = (apps: Record<string, number>, total: number) => ({
      ...state,
      player: {
        ...state.player,
        seasonLevelApps: apps,
        seasonStats: { ...state.player.seasonStats, appearances: total },
      },
    });
    expect(matchSignals(at({}, 0), fixture)).toEqual(['debut']);
    // Tre presenze, ma in un altro livello (trasferimento a stagione in corso): è un esordio.
    expect(matchSignals(at({ [level + 1]: 3 }, 3), fixture)).toEqual(['debut']);
    expect(matchSignals(at({ [level]: 1 }, 1), fixture)).toEqual([]);
  });

  it('contractExpiring', () => {
    const { state, fixture } = quiet(3);
    const s = {
      ...state,
      player: {
        ...state.player,
        contract: { ...state.player.contract!, untilSeason: state.season },
      },
    };
    expect(matchSignals(s, fixture)).toEqual(['contractExpiring']);
  });

  it('lowTrust: relazione col mister sotto soglia', () => {
    const { state, fixture, coachId } = quiet(3);
    const s = {
      ...state,
      player: {
        ...state.player,
        relationships: { ...state.player.relationships, [coachId]: cfg.lowTrustBelow - 1 },
      },
    };
    expect(matchSignals(s, fixture)).toEqual(['lowTrust']);
    const eq = { ...s, player: { ...s.player, relationships: { [coachId]: cfg.lowTrustBelow } } };
    expect(matchSignals(eq, fixture)).toEqual([]);
  });

  it('scout', () => {
    const { state, fixture } = quiet(3);
    expect(matchSignals(state, { ...fixture, scout: true })).toEqual(['scout']);
  });

  it('cup', () => {
    const { state, fixture } = quiet(3);
    const cupStage = defaultContext.config.media.press.finalStages[0]!;
    const f = { ...fixture, cup: { competitionId: 'x', stage: cupStage } } as unknown as Fixture;
    expect(matchSignals(state, f)).toEqual(['cup']);
  });

  it('derby: stessa città', () => {
    const { state, fixture } = quiet(3);
    const clubId = state.player.clubId!;
    const mine = state.world.clubs.find((c) => c.id === clubId)!;
    const oppId = fixture.homeId === clubId ? fixture.awayId : fixture.homeId;
    const world = {
      ...state.world,
      clubs: state.world.clubs.map((c) => (c.id === oppId ? { ...c, city: mine.city } : c)),
    };
    expect(matchSignals({ ...state, world }, fixture)).toEqual(['derby']);
  });

  it('top: due prime in classifica a giornata avanzata', () => {
    const { state, fixture } = quiet(3);
    const press = defaultContext.config.media.press;
    const clubId = state.player.clubId!;
    const oppId = fixture.homeId === clubId ? fixture.awayId : fixture.homeId;
    const group = state.world.leagues
      .flatMap((l) => l.groups)
      .find((g) => g.clubIds.includes(clubId))!;
    // Le due squadre vincono tutte le altre partite già giocate: in testa alla classifica.
    const played: Fixture[] = state.calendar
      .filter((f) => f.groupId === group.id && f.season === state.season && f !== fixture)
      .map((f) => {
        const top = [clubId, oppId];
        const homeTop = top.includes(f.homeId);
        const awayTop = top.includes(f.awayId);
        return {
          ...f,
          result: { home: homeTop && !awayTop ? 3 : 0, away: awayTop && !homeTop ? 3 : 0 },
        };
      });
    const calendar = state.calendar.map((f) => played.find((p) => p.id === f.id) ?? f);
    const f = { ...fixture, matchday: press.topFromMatchday };
    expect(matchSignals({ ...state, calendar }, f)).toEqual(['top']);
  });

  it('keyOpponent: rosa avversaria con un pari ruolo vicino al giocatore', () => {
    const { state, fixture } = quiet(3);
    const clubId = state.player.clubId!;
    const oppId = fixture.homeId === clubId ? fixture.awayId : fixture.homeId;
    const mk = (ovr: number) => ({
      ...state,
      world: {
        ...state.world,
        clubs: state.world.clubs.map((c) =>
          c.id === oppId
            ? {
                ...c,
                roster: [
                  {
                    id: 'k',
                    firstName: 'A',
                    lastName: 'B',
                    role: state.player.role,
                    birthWeek: 0,
                    ovr,
                  },
                ],
              }
            : c,
        ),
      },
    });
    expect(matchSignals(mk(200), fixture)).toEqual(['keyOpponent']);
    expect(keyOpponentOf(mk(200), fixture)?.id).toBe('k');
    expect(keyOpponentOf(mk(0), fixture)).toBeNull();
  });
});

describe('osservatore e trasferimento', () => {
  it('il segno segue il giocatore al nuovo club, senza nuove estrazioni', () => {
    const always = {
      ...defaultContext,
      config: {
        ...defaultContext.config,
        match: {
          ...defaultContext.config.match,
          stakes: { ...cfg, scoutChance: 1 },
        },
      },
    };
    let s = newCareer(baseOptions, 4);
    for (let i = 0; i < 80; i++) {
      if (playerFixture(s)) s = playMatch(s, autoDecider).state;
      s = advanceWeek(s, always).state;
      const old = s.player.clubId!;
      const mine = s.calendar.find((f) => f.week === s.week && f.scout);
      const other = s.calendar.find(
        (f) => f.week === s.week && !f.result && f.homeId !== old && f.awayId !== old && !f.cup,
      );
      if (!mine || !other || !getTransferWindow(s)) continue;
      const club = s.world.clubs.find((c) => c.id === other.homeId);
      if (!club) continue;
      const offer: ContractOffer = {
        id: 'o_t',
        kind: 'transfer',
        clubId: club.id,
        salaryWeekly: 100,
        seasons: 2,
        signingBonus: 0,
        expiresWeek: s.week + 1,
        maxSalary: 130,
        roundsLeft: 1,
      };
      const moved = acceptOffer({ ...s, offers: [offer] }, 'o_t');
      expect(moved.rngState).toEqual(s.rngState);
      const scouted = moved.calendar.filter((f) => f.week === s.week && f.scout);
      expect(scouted.map((f) => f.id)).toEqual([other.id]);
      expect(moved.calendar.find((f) => f.id === mine.id)?.scout).toBeUndefined();
      return;
    }
    throw new Error('nessuna finestra di mercato con partita osservata');
  });
});

describe('matchStakes', () => {
  it('è il massimo dei pesi, non la somma', () => {
    const v = matchStakes(['lowTrust', 'derby', 'contractExpiring'], cfg);
    expect(v).toBe(Math.max(cfg.lowTrust, cfg.derby, cfg.contractExpiring));
    expect(v).toBeLessThanOrEqual(1);
  });

  it('beginMatch salva la posta nello stato della partita', () => {
    for (let seed = 1; seed < 40; seed++) {
      const { state, fixture } = firstMatch(seed);
      const s0: GameState = {
        ...state,
        calendar: state.calendar.map((f) => (f.id === fixture.id ? { ...f, scout: true } : f)),
      };
      const m = beginMatch(s0).state.currentMatch;
      if (!m) continue;
      expect(m.stakes).toBeGreaterThanOrEqual(cfg.scout);
      expect(m.stakes).toBe(matchStakes(matchSignals(s0, fixture), cfg));
      return;
    }
    throw new Error('nessuna partita con momenti');
  });
});

describe('osservatore', () => {
  /** Gioca una stagione e raccoglie le partite con osservatore insieme alla settimana in cui sono state marcate. */
  function seasonScouts(seed: number) {
    let s = newCareer(baseOptions, seed);
    const out: { f: Fixture; markedAt: number; clubId: string | undefined }[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < 45 && !isSeasonOver(s); i++) {
      if (playerFixture(s)) s = playMatch(s, autoDecider).state;
      s = advanceWeek(s).state;
      for (const f of s.calendar.filter((x) => x.scout && !seen.has(x.id))) {
        seen.add(f.id);
        out.push({ f, markedAt: s.week, clubId: s.player.clubId });
      }
    }
    return out;
  }

  it('estratto in modo deterministico dal seme', () => {
    const a = seasonScouts(11);
    expect(seasonScouts(11)).toEqual(a);
  });

  it('solo sulla prossima partita del giocatore', () => {
    let total = 0;
    for (let seed = 1; seed <= 6; seed++) {
      for (const { f, markedAt, clubId } of seasonScouts(seed)) {
        total++;
        expect(f.week).toBe(markedAt);
        expect(f.homeId === clubId || f.awayId === clubId).toBe(true);
      }
    }
    expect(total).toBeGreaterThan(0);
  });

  it('il salvataggio accetta fixture con e senza scout', () => {
    const { state, fixture } = firstMatch(2);
    const withScout: GameState = {
      ...state,
      calendar: state.calendar.map((f) => (f.id === fixture.id ? { ...f, scout: true } : f)),
    };
    expect(deserialize(serialize(withScout)).calendar.find((f) => f.id === fixture.id)?.scout).toBe(
      true,
    );
    expect(
      deserialize(serialize(state)).calendar.find((f) => f.id === fixture.id)?.scout,
    ).toBeUndefined();
  });
});
