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
} from '../src/index';
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

  it('debut: nessuna presenza nel livello', () => {
    const { state, fixture } = quiet(3);
    const s = {
      ...state,
      player: { ...state.player, seasonStats: { ...state.player.seasonStats, appearances: 0 } },
    };
    expect(matchSignals(s, fixture)).toEqual(['debut']);
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
