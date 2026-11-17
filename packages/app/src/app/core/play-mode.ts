/** Le scene animate visualizzano gli esiti del motore; il testo resta sempre disponibile. */
export const PLAY_MODES = ['text', 'animated'] as const;
export type PlayMode = (typeof PLAY_MODES)[number];
export const AVAILABLE_PLAY_MODES: readonly PlayMode[] = ['text', 'animated'];
