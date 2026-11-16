/**
 * Modalità di gioco: oggi solo la versione testuale; le partite animate 2D arriveranno con la fase 2
 * (l'impostazione le mostra già, disattivate).
 */
export const PLAY_MODES = ['text', 'animated'] as const;
export type PlayMode = (typeof PLAY_MODES)[number];
export const AVAILABLE_PLAY_MODES: readonly PlayMode[] = ['text'];
