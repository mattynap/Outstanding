/**
 * Formato dei file di salvataggio: intestazione + JSON del motore compresso con gzip in base64.
 * Il contenuto (GameState, `saveVersion`, migrazioni) resta compito del motore: qui si decide solo
 * come scriverlo su disco. Funzioni pure, testabili con Vitest.
 */
import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate';
import { deserialize, serialize, type GameState } from '@outstanding/engine';

/** Intestazione del formato compresso; se un giorno cambia la compressione, si cambia questa. */
export const SAVE_HEADER = 'OSV1:';

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  // A blocchi, per non superare il limite di argomenti di String.fromCharCode.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function encodeSave(state: GameState): string {
  return SAVE_HEADER + toBase64(gzipSync(strToU8(serialize(state)), { level: 6 }));
}

/**
 * Legge un file di salvataggio: formato compresso oppure JSON semplice (salvataggi di M9).
 * Le migrazioni del motore portano il salvataggio alla versione attuale; un errore significa
 * file rovinato o creato da una versione più recente del gioco.
 */
export function decodeSave(text: string): GameState {
  const json = text.startsWith(SAVE_HEADER)
    ? strFromU8(gunzipSync(fromBase64(text.slice(SAVE_HEADER.length))))
    : text;
  return deserialize(json);
}
