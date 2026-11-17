import type { KeyMoment, MatchEvent, Side } from '@outstanding/engine';

export type SceneKind = 'attack' | 'defence' | 'keeper' | 'bell' | 'pendulum' | 'press';
export type SceneResult = 'goal' | 'assist' | 'save' | 'winBall' | 'pass' | 'miss' | 'concede';
export interface StageModel {
  key: string;
  scene: SceneKind;
  phase: 'ready' | 'success' | 'failure';
  result?: SceneResult;
  homeColor?: string;
  awayColor?: string;
}

export function sceneForMoment(id: string): SceneKind {
  if (id === 'gk_distribution' || id === 'def_set_piece') return 'attack';
  return id.startsWith('gk_') ? 'keeper' : id.startsWith('def_') ? 'defence' : 'attack';
}

export function resolvedStage(
  moment: KeyMoment,
  side: Side,
  events: MatchEvent[],
  previousEvents: readonly MatchEvent[] = [],
): StageModel {
  // Il report finale riordina la cronaca: gli indici precedenti non individuano gli eventi nuovi.
  events = events.filter((event) => !previousEvents.includes(event));
  const base: StageModel = {
    key: `${moment.momentId}:${moment.minute}:resolved`,
    scene: sceneForMoment(moment.momentId),
    phase: 'ready',
  };
  const event = events.find(
    (e) => e.kind === 'moment' && e.minute === moment.minute && e.momentId === moment.momentId,
  );
  if (!event || event.kind !== 'moment') return base;
  const goals = events.filter((e) => e.kind === 'goal' && e.minute === moment.minute);
  let result: SceneResult = event.success ? 'pass' : 'miss';
  if (goals.some((e) => e.kind === 'goal' && e.side === side && e.byPlayer)) result = 'goal';
  else if (goals.some((e) => e.kind === 'goal' && e.side === side && e.assistByPlayer))
    result = 'assist';
  else if (goals.some((e) => e.kind === 'goal' && e.side !== side)) result = 'concede';
  else if (event.success && base.scene === 'keeper') result = 'save';
  else if (event.success && base.scene === 'defence') result = 'winBall';
  return { ...base, phase: event.success ? 'success' : 'failure', result };
}
