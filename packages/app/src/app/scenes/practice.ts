import { advanceWeek, beginMatch, newCareer, playerFixture, type Role } from '@outstanding/engine';

/** Una partita isolata: non usa GameService e non scrive negli slot della carriera. */
export function createPractice(role: Role) {
  let state = newCareer(
    { firstName: 'Luca', lastName: 'Ferri', hometown: 'Napoli', role, traits: [] },
    20261117,
  );
  state = {
    ...state,
    player: {
      ...state.player,
      skills: Object.fromEntries(
        Object.keys(state.player.skills).map((key) => [key, 80]),
      ) as typeof state.player.skills,
      condition: { ...state.player.condition, energy: 100, form: 80, morale: 80 },
    },
  };
  for (let week = 0; week < 52 && !playerFixture(state); week++) state = advanceWeek(state).state;
  return beginMatch(state);
}
